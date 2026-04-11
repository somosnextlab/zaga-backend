import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ContractsRepository } from './contracts.repository';
import { SignaturaWebhookDto } from './dto/signatura-webhook.dto';
import { CaseContractStatus } from './enums/case-contract-status.enum';
import { SignProvider } from './enums/sign-provider.enum';
import type { SignProviderInterface } from './interfaces/sign-provider.interface';
import type {
  SignaturaBiometricResponse,
  SignaturaDocumentResponse,
} from './interfaces/signatura.types';
import {
  isProviderCanceled,
  isProviderRejected,
  isProviderSigned,
  normalizeProviderStatus,
} from './mappers/signatura.mapper';
import { SignaturaService } from './providers/signatura.service';
import { ContractPdfService } from './templates/contract-pdf.service';
import { ContractsErrors } from './utils/contracts-errors';
import { isActiveCaseContractUniqueViolation } from './utils/postgres-active-contract.util';
import { DbClient, DbService } from '../db/db.service';
import {
  StartCaseContractResponse,
  StartCaseContractContext,
  CaseContractStatusResponse,
  SignaturaWebhookResult,
  CaseContractRow,
  LoanRow,
} from './interfaces/contracts.interface';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly signProvider: SignProviderInterface;

  public constructor(
    private readonly contractsRepository: ContractsRepository,
    private readonly contractPdfService: ContractPdfService,
    private readonly signaturaService: SignaturaService,
    private readonly configService: ConfigService,
    private readonly dbService: DbService,
  ) {
    this.signProvider = this.signaturaService;
  }

  public async startCaseContract(
    caseId: string,
  ): Promise<StartCaseContractResponse> {
    const provider = this.readSignProvider();

    const context = await this.dbService.withTransaction(
      async (client: DbClient): Promise<StartCaseContractContext> => {
        const caseRow = await this.contractsRepository.findCaseByIdForUpdate(
          client,
          caseId,
        );
        if (!caseRow) {
          throw new NotFoundException(ContractsErrors.CASE_NOT_FOUND);
        }

        if (caseRow.status !== 'APROBADO_FINAL') {
          throw new BadRequestException(
            ContractsErrors.CASE_NOT_READY_FOR_CONTRACT,
          );
        }

        const offerRow =
          await this.contractsRepository.findAcceptedOfferByCaseIdForUpdate(
            client,
            caseId,
          );
        if (!offerRow) {
          throw new BadRequestException(
            ContractsErrors.ACCEPTED_OFFER_NOT_FOUND,
          );
        }

        const activeContract =
          await this.contractsRepository.findActiveCaseContractByCaseIdForUpdate(
            client,
            caseId,
          );
        if (activeContract) {
          throw new ConflictException(
            ContractsErrors.ACTIVE_CONTRACT_ALREADY_EXISTS,
          );
        }

        let caseContract: CaseContractRow;
        try {
          caseContract =
            await this.contractsRepository.insertCaseContractCreated(client, {
              caseId,
              offerId: offerRow.id,
              provider,
            });
        } catch (error: unknown) {
          if (isActiveCaseContractUniqueViolation(error)) {
            throw new ConflictException(
              ContractsErrors.ACTIVE_CONTRACT_ALREADY_EXISTS,
            );
          }
          throw error;
        }

        return { caseRow, offerRow, caseContract };
      },
    );

    const userFullName = this.buildFullName(
      context.caseRow.first_name,
      context.caseRow.last_name,
    );
    const pdf = await this.contractPdfService.generateContractPdf({
      contractId: context.caseContract.id,
      caseId: context.caseRow.id,
      offerId: context.offerRow.id,
      amount: context.offerRow.amount,
      installments: context.offerRow.installments,
      tasaNominalAnual: context.offerRow.tasa_nominal_anual,
      userFullName,
      userDni: context.caseRow.dni,
      userCuit: context.caseRow.cuit,
      userPhone: context.caseRow.phone,
    });

    try {
      const signaturaResponse = await this.signProvider.createDocument({
        contractId: context.caseContract.id,
        fileName: pdf.fileName,
        pdfBase64: pdf.pdfBase64,
        signer: {
          fullName: userFullName,
          documentNumber: context.caseRow.dni,
          cuit: context.caseRow.cuit,
          phone: context.caseRow.phone,
        },
        metadata: {
          caseId: context.caseRow.id,
          offerId: context.offerRow.id,
          contractId: context.caseContract.id,
        },
      });

      const issuedAt = this.parseIsoDateOrNow(signaturaResponse.issuedAt);
      const expiresAt = this.parseIsoDateOrDefault(
        signaturaResponse.expiresAt,
        new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000),
      );

      const updatedContract = await this.dbService.withTransaction(
        async (client: DbClient): Promise<CaseContractRow> => {
          return this.contractsRepository.markCaseContractSignPending(client, {
            contractId: context.caseContract.id,
            contractVersion: pdf.contractVersion,
            templateCode: pdf.templateCode,
            externalDocumentId: signaturaResponse.externalDocumentId,
            externalSignatureId: signaturaResponse.externalSignatureId,
            providerDocumentStatus: normalizeProviderStatus(
              signaturaResponse.documentStatus,
            ),
            providerSignatureStatus: normalizeProviderStatus(
              signaturaResponse.signatureStatus,
            ),
            signatureUrl: signaturaResponse.signatureUrl,
            issuedAt,
            expiresAt,
            providerPayload: signaturaResponse.raw,
          });
        },
      );

      return {
        caseId: context.caseRow.id,
        caseContractId: updatedContract.id,
        status: updatedContract.status,
        externalDocumentId: updatedContract.external_document_id ?? '',
        externalSignatureId: updatedContract.external_signature_id ?? '',
        signatureUrl: updatedContract.signature_url,
        issuedAt: updatedContract.issued_at,
        expiresAt: updatedContract.expires_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`startCaseContract failed: ${message}`);

      await this.dbService.withTransaction(async (client: DbClient) => {
        await this.contractsRepository.markCaseContractFailed(client, {
          contractId: context.caseContract.id,
          reason: ContractsErrors.PROVIDER_BLOCKING_ERROR,
          providerLastError: message,
        });
      });

      throw new InternalServerErrorException(
        'No fue posible iniciar la firma.',
      );
    }
  }

  /**
   * Estado contractual para consulta: contrato activo si existe; si no, el último por fecha de creación.
   * El campo `status` indica si aplica flujo de firma (`CREATED` / `SIGN_PENDING`) u otro resultado.
   */
  public async getCaseContractStatus(
    caseId: string,
  ): Promise<CaseContractStatusResponse> {
    const contract =
      await this.contractsRepository.findCaseContractByCaseId(caseId);
    if (!contract) {
      throw new NotFoundException(ContractsErrors.CASE_CONTRACT_NOT_FOUND);
    }

    return {
      caseId,
      caseContractId: contract.id,
      status: contract.status,
      providerDocumentStatus: contract.provider_document_status,
      providerSignatureStatus: contract.provider_signature_status,
      signatureUrl: contract.signature_url,
      issuedAt: contract.issued_at,
      expiresAt: contract.expires_at,
      signedAt: contract.signed_at,
      canceledAt: contract.canceled_at,
      failedAt: contract.failed_at,
      failureReason: contract.failure_reason,
    };
  }

  public async handleSignaturaWebhook(
    signatureHeader: string | undefined,
    payloadRaw: Buffer | undefined,
    dto: SignaturaWebhookDto,
  ): Promise<SignaturaWebhookResult> {
    this.validateWebhookSignature(signatureHeader, payloadRaw);

    console.log('=== HANDLE SIGNATURA WEBHOOK START ===');
    console.log({
      hasSignatureHeader: !!signatureHeader,
      rawBodyLength: payloadRaw?.length ?? 0,
      secretConfigured: !!this.configService.get<string>(
        'SIGNATURA_WEBHOOK_SECRET',
      ),
    });
    console.log('Webhook body:', JSON.stringify(dto, null, 2));

    const documentId = dto.externalDocumentId ?? dto.document_id ?? null;
    const signatureId = dto.externalSignatureId ?? dto.signature_id ?? null;
    const providerStatuses = this.resolveProviderStatuses(dto);
    const providerDocumentStatus = providerStatuses.providerDocumentStatus;
    const providerSignatureStatus = providerStatuses.providerSignatureStatus;

    return this.dbService.withTransaction(
      async (client: DbClient): Promise<SignaturaWebhookResult> => {
        const contract =
          await this.contractsRepository.findCaseContractByExternalIdsForUpdate(
            client,
            documentId,
            signatureId,
          );

        if (!contract) {
          return {
            accepted: true,
            contractFound: false,
            caseContractId: null,
            status: null,
            loanId: null,
          };
        }

        if (contract.status === CaseContractStatus.SIGNED) {
          const existingLoan =
            await this.contractsRepository.findLoanByCaseIdForUpdate(
              client,
              contract.case_id,
            );
          return {
            accepted: true,
            contractFound: true,
            caseContractId: contract.id,
            status: contract.status,
            loanId: existingLoan?.id ?? null,
          };
        }

        const trackedContract =
          await this.contractsRepository.updateProviderTracking(client, {
            contractId: contract.id,
            providerDocumentStatus,
            providerSignatureStatus,
            signatureUrl: dto.signatureUrl ?? null,
            providerPayload: dto.providerPayload ?? null,
            providerLastError: dto.errorMessage ?? null,
          });

        const effectiveDocumentStatus =
          providerDocumentStatus ?? trackedContract.provider_document_status;
        const effectiveSignatureStatus =
          providerSignatureStatus ?? trackedContract.provider_signature_status;

        if (
          trackedContract.status === CaseContractStatus.CANCELED ||
          trackedContract.status === CaseContractStatus.FAILED
        ) {
          return {
            accepted: true,
            contractFound: true,
            caseContractId: trackedContract.id,
            status: trackedContract.status,
            loanId: null,
          };
        }

        if (
          isProviderCanceled(effectiveDocumentStatus, effectiveSignatureStatus)
        ) {
          const canceled =
            await this.contractsRepository.markCaseContractCanceled(client, {
              contractId: trackedContract.id,
              reason: 'PROVIDER_CANCELED_OR_EXPIRED',
              providerDocumentStatus: effectiveDocumentStatus,
              providerSignatureStatus: effectiveSignatureStatus,
              providerPayload: dto.providerPayload ?? null,
            });
          return {
            accepted: true,
            contractFound: true,
            caseContractId: canceled.id,
            status: canceled.status,
            loanId: null,
          };
        }

        if (
          isProviderRejected(effectiveDocumentStatus, effectiveSignatureStatus)
        ) {
          const failed = await this.contractsRepository.markCaseContractFailed(
            client,
            {
              contractId: trackedContract.id,
              reason: ContractsErrors.PROVIDER_BLOCKING_ERROR,
              providerDocumentStatus: effectiveDocumentStatus,
              providerSignatureStatus: effectiveSignatureStatus,
              providerPayload: dto.providerPayload ?? null,
              providerLastError: dto.errorMessage ?? dto.errorCode ?? null,
            },
          );
          return {
            accepted: true,
            contractFound: true,
            caseContractId: failed.id,
            status: failed.status,
            loanId: null,
          };
        }

        if (
          !isProviderSigned(effectiveDocumentStatus, effectiveSignatureStatus)
        ) {
          return {
            accepted: true,
            contractFound: true,
            caseContractId: trackedContract.id,
            status: trackedContract.status,
            loanId: null,
          };
        }

        const externalDocumentId = trackedContract.external_document_id;
        if (!externalDocumentId) {
          const failed = await this.contractsRepository.markCaseContractFailed(
            client,
            {
              contractId: trackedContract.id,
              reason: ContractsErrors.SIGNATURA_RESPONSE_INVALID,
              providerDocumentStatus: effectiveDocumentStatus,
              providerSignatureStatus: effectiveSignatureStatus,
              providerPayload: dto.providerPayload ?? null,
            },
          );
          return {
            accepted: true,
            contractFound: true,
            caseContractId: failed.id,
            status: failed.status,
            loanId: null,
          };
        }

        const externalSignatureId = trackedContract.external_signature_id;
        if (!externalSignatureId) {
          const failed = await this.contractsRepository.markCaseContractFailed(
            client,
            {
              contractId: trackedContract.id,
              reason: ContractsErrors.SIGNATURA_RESPONSE_INVALID,
              providerDocumentStatus: effectiveDocumentStatus,
              providerSignatureStatus: effectiveSignatureStatus,
              providerPayload: dto.providerPayload ?? null,
            },
          );
          return {
            accepted: true,
            contractFound: true,
            caseContractId: failed.id,
            status: failed.status,
            loanId: null,
          };
        }

        const [documentData, biometricData] = await Promise.all([
          this.signProvider.getDocument(externalDocumentId),
          this.signProvider.getBiometrics(externalSignatureId),
        ]);

        const biometricValidation = this.evaluateBiometricStatus(biometricData);
        const identityValidation = await this.evaluateIdentityCoherence(
          client,
          trackedContract,
          biometricData,
        );
        const evidenceValidation = this.evaluateEvidence(documentData, dto);

        if (
          !biometricValidation.ok ||
          !identityValidation.ok ||
          !evidenceValidation.ok
        ) {
          const failed = await this.contractsRepository.markCaseContractFailed(
            client,
            {
              contractId: trackedContract.id,
              reason:
                biometricValidation.reason ??
                identityValidation.reason ??
                evidenceValidation.reason ??
                ContractsErrors.PROVIDER_BLOCKING_ERROR,
              providerDocumentStatus:
                normalizeProviderStatus(documentData.documentStatus) ??
                effectiveDocumentStatus,
              providerSignatureStatus:
                normalizeProviderStatus(documentData.signatureStatus) ??
                effectiveSignatureStatus,
              biometricStatus: biometricData.biometricStatus,
              biometricPayload: biometricData.raw,
              signedDocumentUrl:
                dto.signedDocumentUrl ?? documentData.signedDocumentUrl,
              auditCertificateUrl:
                dto.auditCertificateUrl ?? documentData.auditCertificateUrl,
              evidenceZipUrl: dto.evidenceZipUrl ?? documentData.evidenceZipUrl,
              providerPayload: {
                webhook: dto.providerPayload ?? {},
                document: documentData.raw,
                biometrics: biometricData.raw,
              },
            },
          );

          return {
            accepted: true,
            contractFound: true,
            caseContractId: failed.id,
            status: failed.status,
            loanId: null,
          };
        }

        const signed = await this.contractsRepository.markCaseContractSigned(
          client,
          {
            contractId: trackedContract.id,
            providerDocumentStatus:
              normalizeProviderStatus(documentData.documentStatus) ??
              effectiveDocumentStatus,
            providerSignatureStatus:
              normalizeProviderStatus(documentData.signatureStatus) ??
              effectiveSignatureStatus,
            biometricStatus: biometricData.biometricStatus,
            biometricPayload: biometricData.raw,
            signedDocumentUrl:
              dto.signedDocumentUrl ?? documentData.signedDocumentUrl,
            auditCertificateUrl:
              dto.auditCertificateUrl ?? documentData.auditCertificateUrl,
            evidenceZipUrl: dto.evidenceZipUrl ?? documentData.evidenceZipUrl,
            signatureUrl: dto.signatureUrl ?? documentData.signatureUrl,
            providerPayload: {
              webhook: dto.providerPayload ?? {},
              document: documentData.raw,
              biometrics: biometricData.raw,
            },
          },
        );

        const loan = await this.createLoanIfEligible(client, signed);

        return {
          accepted: true,
          contractFound: true,
          caseContractId: signed.id,
          status: signed.status,
          loanId: loan?.id ?? null,
        };
      },
    );
  }

  private async createLoanIfEligible(
    client: DbClient,
    contract: CaseContractRow,
  ): Promise<LoanRow | null> {
    if (contract.status !== CaseContractStatus.SIGNED) {
      return null;
    }

    const existingLoan =
      await this.contractsRepository.findLoanByCaseIdForUpdate(
        client,
        contract.case_id,
      );
    if (existingLoan) {
      return existingLoan;
    }

    const caseData = await this.contractsRepository.findCaseByIdForUpdate(
      client,
      contract.case_id,
    );
    if (!caseData) {
      throw new NotFoundException(ContractsErrors.CASE_NOT_FOUND);
    }

    const loanType = caseData.case_type === 'REFINANCE' ? 'REFINANCE' : 'NEW';
    if (loanType === 'REFINANCE') {
      if (!caseData.refinances_loan_id) {
        throw new BadRequestException(ContractsErrors.REFINANCE_RULE_BROKEN);
      }

      const refinanceLoan =
        await this.contractsRepository.findLoanByRefinancesLoanIdForUpdate(
          client,
          caseData.refinances_loan_id,
        );
      if (refinanceLoan) {
        throw new ConflictException(ContractsErrors.REFINANCE_RULE_BROKEN);
      }
    }

    return this.contractsRepository.insertLoan(client, {
      userId: caseData.user_id,
      phone: caseData.phone,
      loanType,
      refinancesLoanId: caseData.refinances_loan_id,
      caseId: contract.case_id,
      offerId: contract.offer_id,
    });
  }

  private evaluateBiometricStatus(input: SignaturaBiometricResponse): {
    readonly ok: boolean;
    readonly reason: string | null;
  } {
    const status = (input.biometricStatus ?? '').trim().toUpperCase();
    const approvedStatuses = ['APPROVED', 'VALID', 'OK', 'SUCCESS', 'CO'];
    const isApproved = status.length === 0 || approvedStatuses.includes(status);
    const scoreOk = input.identityScore === null || input.identityScore >= 0.8;
    const hasIdentityFields =
      !!input.fullName &&
      !!input.documentNumber &&
      input.documentNumber.length > 0;

    if (!isApproved || !scoreOk || !hasIdentityFields) {
      return {
        ok: false,
        reason: ContractsErrors.BIOMETRIC_VALIDATION_FAILED,
      };
    }

    return { ok: true, reason: null };
  }

  private async evaluateIdentityCoherence(
    client: DbClient,
    contract: CaseContractRow,
    biometricData: SignaturaBiometricResponse,
  ): Promise<{ readonly ok: boolean; readonly reason: string | null }> {
    const caseData = await this.contractsRepository.findCaseByIdForUpdate(
      client,
      contract.case_id,
    );
    if (!caseData) {
      return { ok: false, reason: ContractsErrors.CASE_NOT_FOUND };
    }

    if (biometricData.cuit && caseData.cuit) {
      if (
        this.normalizeDigits(biometricData.cuit) !==
        this.normalizeDigits(caseData.cuit)
      ) {
        return {
          ok: false,
          reason: ContractsErrors.IDENTITY_VALIDATION_FAILED,
        };
      }
    }

    if (biometricData.documentNumber && caseData.dni) {
      if (
        this.normalizeDigits(biometricData.documentNumber) !==
        this.normalizeDigits(caseData.dni)
      ) {
        return {
          ok: false,
          reason: ContractsErrors.IDENTITY_VALIDATION_FAILED,
        };
      }
    }

    const expectedFullName = this.buildFullName(
      caseData.first_name,
      caseData.last_name,
    );
    if (biometricData.fullName && expectedFullName) {
      const normalizedExpected = this.normalizeText(expectedFullName);
      const normalizedReceived = this.normalizeText(biometricData.fullName);
      if (
        normalizedExpected.length > 0 &&
        normalizedReceived.length > 0 &&
        normalizedExpected !== normalizedReceived
      ) {
        return {
          ok: false,
          reason: ContractsErrors.IDENTITY_VALIDATION_FAILED,
        };
      }
    }

    return { ok: true, reason: null };
  }

  private evaluateEvidence(
    documentData: SignaturaDocumentResponse,
    dto: SignaturaWebhookDto,
  ): { readonly ok: boolean; readonly reason: string | null } {
    const signedDocumentUrl =
      dto.signedDocumentUrl ?? documentData.signedDocumentUrl;
    const auditCertificateUrl =
      dto.auditCertificateUrl ?? documentData.auditCertificateUrl;
    const evidenceZipUrl = dto.evidenceZipUrl ?? documentData.evidenceZipUrl;

    if (!signedDocumentUrl || !auditCertificateUrl || !evidenceZipUrl) {
      return { ok: false, reason: ContractsErrors.EVIDENCE_INCOMPLETE };
    }

    return { ok: true, reason: null };
  }

  private validateWebhookSignature(
    signatureHeader: string | undefined,
    payloadRaw: Buffer | undefined,
  ): void {
    const secret = this.configService.get<string>('SIGNATURA_WEBHOOK_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'SIGNATURA_WEBHOOK_SECRET no está configurada.',
      );
    }

    if (!signatureHeader || signatureHeader.trim().length === 0) {
      throw new BadRequestException(ContractsErrors.WEBHOOK_NOT_AUTHENTIC);
    }

    const webhookBody = payloadRaw ?? Buffer.alloc(0);
    const signatureCandidates =
      this.extractSignatureCandidates(signatureHeader);
    if (signatureCandidates.length === 0) {
      throw new BadRequestException(ContractsErrors.WEBHOOK_NOT_AUTHENTIC);
    }

    const expectedHmac = createHmac('sha256', secret)
      .update(webhookBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHmac, 'utf8');

    for (const candidate of signatureCandidates) {
      const providedBuffer = Buffer.from(candidate, 'utf8');
      if (
        providedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(providedBuffer, expectedBuffer)
      ) {
        return;
      }
    }

    throw new BadRequestException(ContractsErrors.WEBHOOK_NOT_AUTHENTIC);
  }

  private extractSignatureCandidates(signatureHeader: string): string[] {
    const parts = signatureHeader
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const candidates: string[] = [];
    for (const part of parts) {
      const equalIndex = part.indexOf('=');
      if (equalIndex <= 0) {
        candidates.push(part);
        continue;
      }

      const key = part.slice(0, equalIndex).trim().toLowerCase();
      const value = part.slice(equalIndex + 1).trim();
      if (!value) continue;

      if (key === 'sha256' || key === 'v1' || key === 'signature') {
        candidates.push(value);
      } else {
        candidates.push(part);
      }
    }

    return candidates;
  }

  private resolveProviderStatuses(dto: SignaturaWebhookDto): {
    readonly providerDocumentStatus: string | null;
    readonly providerSignatureStatus: string | null;
  } {
    const action = (dto.notification_action ?? '').trim().toUpperCase();

    const baseDocumentStatus = normalizeProviderStatus(
      dto.providerDocumentStatus ?? dto.new_status,
    );
    const baseSignatureStatus = normalizeProviderStatus(
      dto.providerSignatureStatus,
    );

    if (action === 'DS') {
      return {
        providerDocumentStatus: baseDocumentStatus ?? 'CO',
        providerSignatureStatus: baseSignatureStatus ?? 'CO',
      };
    }

    if (action === 'SD') {
      return {
        providerDocumentStatus: baseDocumentStatus,
        providerSignatureStatus: baseSignatureStatus ?? 'DE',
      };
    }

    if (action === 'DC') {
      return {
        providerDocumentStatus: baseDocumentStatus,
        providerSignatureStatus: baseSignatureStatus,
      };
    }

    return {
      providerDocumentStatus: baseDocumentStatus,
      providerSignatureStatus: baseSignatureStatus,
    };
  }

  private readSignProvider(): SignProvider {
    const configuredProviderRaw =
      this.configService.get<string>('SIGN_PROVIDER');

    const configuredProvider = this.parseSignProvider(configuredProviderRaw);
    if (configuredProvider !== SignProvider.SIGNATURA) {
      throw new BadRequestException(ContractsErrors.INVALID_SIGN_PROVIDER);
    }

    return SignProvider.SIGNATURA;
  }

  private parseSignProvider(value: string | undefined): SignProvider {
    const normalized = (value ?? 'SIGNATURA').trim().toUpperCase();
    if (normalized === 'SIGNATURA') {
      return SignProvider.SIGNATURA;
    }
    throw new BadRequestException(ContractsErrors.INVALID_SIGN_PROVIDER);
  }

  private buildFullName(
    firstName: string | null,
    lastName: string | null,
  ): string {
    const first = (firstName ?? '').trim();
    const last = (lastName ?? '').trim();
    const fullName = `${first} ${last}`.trim();
    return fullName.length > 0 ? fullName : 'SOLICITANTE ZAGA';
  }

  private parseIsoDateOrNow(value: string | null): Date {
    return this.parseIsoDateOrDefault(value, new Date());
  }

  private parseIsoDateOrDefault(value: string | null, fallback: Date): Date {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed;
  }

  private normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }
}
