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
  SignaturaWebhookParsed,
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
    body: unknown,
  ): Promise<SignaturaWebhookResult> {
    const secretConfigured = !!this.configService.get<string>(
      'SIGNATURA_WEBHOOK_SECRET',
    );
    this.logger.log(
      `Signatura webhook: inicio rawBodyBytes=${payloadRaw?.length ?? 0} hasSignatureHeader=${Boolean(signatureHeader?.trim())} secretConfigured=${secretConfigured}`,
    );

    this.assertValidWebhookSignature(signatureHeader, payloadRaw);
    this.logger.log('Signatura webhook: firma HMAC verificada correctamente');

    const parsed = this.parseSignaturaWebhookBody(body);

    const actionNorm = (parsed.notificationAction ?? '').trim().toUpperCase();
    this.logger.log(
      `Signatura webhook: resumen payload evento=${actionNorm || '—'} documentId=${parsed.documentId ?? '—'} signatureId=${parsed.signatureId ?? '—'} notificationId=${parsed.notificationId ?? '—'}`,
    );

    const knownActions = new Set(['', 'DS', 'SD', 'DC']);
    if (actionNorm.length > 0 && !knownActions.has(actionNorm)) {
      this.logger.warn(
        `Signatura webhook: notification_action ajena al mapping conocido (DS, SD, DC): ${actionNorm}`,
      );
    }

    const documentId = parsed.documentId;
    const signatureId = parsed.signatureId;
    const providerStatuses = this.resolveProviderStatuses(parsed);
    const providerDocumentStatus = providerStatuses.providerDocumentStatus;
    const providerSignatureStatus = providerStatuses.providerSignatureStatus;
    const storedPayload = this.signaturaWebhookStoredPayload(parsed);

    const result = await this.dbService.withTransaction(
      async (client: DbClient): Promise<SignaturaWebhookResult> => {
        const contract =
          await this.contractsRepository.findCaseContractByExternalIdsForUpdate(
            client,
            documentId,
            signatureId,
          );

        if (!contract) {
          this.logger.warn(
            'Signatura webhook: contrato no encontrado para document_id/signature_id recibidos',
          );
          return {
            accepted: true,
            contractFound: false,
            caseContractId: null,
            status: null,
            loanId: null,
          };
        }

        this.logger.log(
          `Signatura webhook: contrato encontrado caseContractId=${contract.id} estado=${contract.status}`,
        );

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
            signatureUrl: parsed.signatureUrl,
            providerPayload: storedPayload,
            providerLastError: parsed.errorMessage,
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
              providerPayload: storedPayload,
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
              providerPayload: storedPayload,
              providerLastError:
                parsed.errorMessage ?? parsed.errorCode ?? null,
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
          this.logger.log(
            `Signatura webhook: evento registrado sin firma completa en proveedor (contrato sigue ${trackedContract.status})`,
          );
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
              providerPayload: storedPayload,
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
              providerPayload: storedPayload,
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
        const evidenceValidation = this.evaluateEvidence(documentData, parsed);

        if (
          !biometricValidation.ok ||
          !identityValidation.ok ||
          !evidenceValidation.ok
        ) {
          const failReason =
            biometricValidation.reason ??
            identityValidation.reason ??
            evidenceValidation.reason ??
            ContractsErrors.PROVIDER_BLOCKING_ERROR;
          this.logger.warn(
            `Signatura webhook: validación interna fallida → FAILED motivo=${failReason}`,
          );
          const failed = await this.contractsRepository.markCaseContractFailed(
            client,
            {
              contractId: trackedContract.id,
              reason: failReason,
              providerDocumentStatus:
                normalizeProviderStatus(documentData.documentStatus) ??
                effectiveDocumentStatus,
              providerSignatureStatus:
                normalizeProviderStatus(documentData.signatureStatus) ??
                effectiveSignatureStatus,
              biometricStatus: biometricData.biometricStatus,
              biometricPayload: biometricData.raw,
              signedDocumentUrl:
                parsed.signedDocumentUrl ?? documentData.signedDocumentUrl,
              auditCertificateUrl:
                parsed.auditCertificateUrl ?? documentData.auditCertificateUrl,
              evidenceZipUrl:
                parsed.evidenceZipUrl ?? documentData.evidenceZipUrl,
              providerPayload: {
                webhook: storedPayload,
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
              parsed.signedDocumentUrl ?? documentData.signedDocumentUrl,
            auditCertificateUrl:
              parsed.auditCertificateUrl ?? documentData.auditCertificateUrl,
            evidenceZipUrl:
              parsed.evidenceZipUrl ?? documentData.evidenceZipUrl,
            signatureUrl: parsed.signatureUrl ?? documentData.signatureUrl,
            providerPayload: {
              webhook: storedPayload,
              document: documentData.raw,
              biometrics: biometricData.raw,
            },
          },
        );

        const loan = await this.createLoanIfEligible(client, signed);

        this.logger.log(
          `Signatura webhook: contrato SIGNED loanCreado=${loan ? 'sí' : 'no'} loanId=${loan?.id ?? '—'}`,
        );

        return {
          accepted: true,
          contractFound: true,
          caseContractId: signed.id,
          status: signed.status,
          loanId: loan?.id ?? null,
        };
      },
    );

    this.logger.log(
      `Signatura webhook: fin contractFound=${result.contractFound} status=${result.status ?? '—'} loanId=${result.loanId ?? '—'}`,
    );

    return result;
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
    parsed: SignaturaWebhookParsed,
  ): { readonly ok: boolean; readonly reason: string | null } {
    const signedDocumentUrl =
      parsed.signedDocumentUrl ?? documentData.signedDocumentUrl;
    const auditCertificateUrl =
      parsed.auditCertificateUrl ?? documentData.auditCertificateUrl;
    const evidenceZipUrl = parsed.evidenceZipUrl ?? documentData.evidenceZipUrl;

    if (!signedDocumentUrl || !auditCertificateUrl || !evidenceZipUrl) {
      return { ok: false, reason: ContractsErrors.EVIDENCE_INCOMPLETE };
    }

    return { ok: true, reason: null };
  }

  private parseSignaturaWebhookBody(body: unknown): SignaturaWebhookParsed {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException(ContractsErrors.WEBHOOK_PAYLOAD_INVALID);
    }
    const o = body as Record<string, unknown>;
    const optString = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const t = value.trim();
      return t.length > 0 ? t : null;
    };

    const documentId =
      optString(o.document_id) ?? optString(o.externalDocumentId);
    const signatureId =
      optString(o.signature_id) ?? optString(o.externalSignatureId);

    if (!documentId && !signatureId) {
      throw new BadRequestException(ContractsErrors.WEBHOOK_PAYLOAD_INVALID);
    }

    let providerPayload: Record<string, unknown> | null = null;
    if (
      o.providerPayload !== undefined &&
      o.providerPayload !== null &&
      typeof o.providerPayload === 'object' &&
      !Array.isArray(o.providerPayload)
    ) {
      providerPayload = o.providerPayload as Record<string, unknown>;
    }

    const raw = { ...o } as Record<string, unknown>;

    return {
      documentId,
      signatureId,
      notificationId: optString(o.notification_id),
      notificationAction: optString(o.notification_action),
      newStatus: optString(o.new_status),
      providerDocumentStatus: optString(o.providerDocumentStatus),
      providerSignatureStatus: optString(o.providerSignatureStatus),
      signatureUrl: optString(o.signatureUrl),
      signedDocumentUrl: optString(o.signedDocumentUrl),
      auditCertificateUrl: optString(o.auditCertificateUrl),
      evidenceZipUrl: optString(o.evidenceZipUrl),
      biometricStatus: optString(o.biometricStatus),
      errorCode: optString(o.errorCode),
      errorMessage: optString(o.errorMessage),
      providerPayload,
      raw,
    };
  }

  private signaturaWebhookStoredPayload(
    parsed: SignaturaWebhookParsed,
  ): Record<string, unknown> {
    return parsed.providerPayload ?? parsed.raw;
  }

  private assertValidWebhookSignature(
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
      throw new BadRequestException(
        ContractsErrors.WEBHOOK_SIGNATURE_HEADER_MISSING,
      );
    }

    const webhookBody = payloadRaw ?? Buffer.alloc(0);
    const trimmedHeader = signatureHeader.trim();
    const signatureCandidates = this.extractSignatureCandidates(trimmedHeader);
    if (signatureCandidates.length === 0) {
      throw new BadRequestException(ContractsErrors.WEBHOOK_SIGNATURE_INVALID);
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

    throw new BadRequestException(ContractsErrors.WEBHOOK_SIGNATURE_INVALID);
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

  private resolveProviderStatuses(parsed: SignaturaWebhookParsed): {
    readonly providerDocumentStatus: string | null;
    readonly providerSignatureStatus: string | null;
  } {
    const action = (parsed.notificationAction ?? '').trim().toUpperCase();

    const baseDocumentStatus = normalizeProviderStatus(
      parsed.providerDocumentStatus ?? parsed.newStatus,
    );
    const baseSignatureStatus = normalizeProviderStatus(
      parsed.providerSignatureStatus,
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
