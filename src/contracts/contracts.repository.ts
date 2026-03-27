/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { DbClient, DbService } from '../db/db.service';
import { CaseContractStatus } from './enums/case-contract-status.enum';
import { SignProvider } from './enums/sign-provider.enum';
import {
  CaseForContractRow,
  CaseOfferRow,
  CaseContractRow,
  ExpiredCaseContractRow,
  LoanRow,
} from './interfaces/contracts.interface';

@Injectable()
export class ContractsRepository {
  public constructor(private readonly dbService: DbService) {}

  public async findCaseByIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseForContractRow | null> {
    const result = await client.query<CaseForContractRow>(
      `
      SELECT c.id, c.user_id, c.phone, c.status, c.case_type, c.refinances_loan_id,
             c.current_offer_id, u.first_name, u.last_name, u.dni, u.cuit
      FROM cases c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async findAcceptedOfferByCaseIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseOfferRow | null> {
    const result = await client.query<CaseOfferRow>(
      `
      SELECT co.id, co.case_id, co.status, co.amount, co.installments, co.tasa_nominal_anual
      FROM case_offers co
      INNER JOIN cases c ON c.id = co.case_id
      WHERE co.case_id = $1
        AND co.status = 'ACCEPTED'
      ORDER BY
        CASE WHEN c.current_offer_id = co.id THEN 0 ELSE 1 END,
        co.accepted_at DESC NULLS LAST,
        co.created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async findActiveCaseContractByCaseIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseContractRow | null> {
    const result = await client.query<CaseContractRow>(
      `
      SELECT *
      FROM case_contracts
      WHERE case_id = $1
        AND status IN ($2, $3)
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [caseId, CaseContractStatus.CREATED, CaseContractStatus.SIGN_PENDING],
    );
    return this.normalizeCaseContractRow(result.rows[0] ?? null);
  }

  public async insertCaseContractCreated(
    client: DbClient,
    input: {
      readonly caseId: string;
      readonly offerId: string;
      readonly provider: SignProvider;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      INSERT INTO case_contracts (
        case_id, offer_id, provider, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, now(), now()
      )
      RETURNING *
      `,
      [input.caseId, input.offerId, input.provider, CaseContractStatus.CREATED],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo crear case_contracts.');
    }

    return row;
  }

  public async markCaseContractSignPending(
    client: DbClient,
    input: {
      readonly contractId: string;
      readonly contractVersion: string;
      readonly templateCode: string;
      readonly externalDocumentId: string;
      readonly externalSignatureId: string;
      readonly providerDocumentStatus: string | null;
      readonly providerSignatureStatus: string | null;
      readonly signatureUrl: string | null;
      readonly issuedAt: Date;
      readonly expiresAt: Date;
      readonly providerPayload: Record<string, unknown>;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      UPDATE case_contracts
      SET status = $2,
          contract_version = $3,
          template_code = $4,
          external_document_id = $5,
          external_signature_id = $6,
          provider_document_status = $7,
          provider_signature_status = $8,
          signature_url = $9,
          issued_at = $10,
          expires_at = $11,
          provider_payload = $12::jsonb,
          provider_last_error = NULL,
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contractId,
        CaseContractStatus.SIGN_PENDING,
        input.contractVersion,
        input.templateCode,
        input.externalDocumentId,
        input.externalSignatureId,
        input.providerDocumentStatus,
        input.providerSignatureStatus,
        input.signatureUrl,
        input.issuedAt.toISOString(),
        input.expiresAt.toISOString(),
        JSON.stringify(input.providerPayload),
      ],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo actualizar case_contracts a SIGN_PENDING.');
    }

    return row;
  }

  public async markCaseContractFailed(
    client: DbClient,
    input: {
      readonly contractId: string;
      readonly reason: string;
      readonly providerDocumentStatus?: string | null;
      readonly providerSignatureStatus?: string | null;
      readonly biometricStatus?: string | null;
      readonly biometricPayload?: Record<string, unknown> | null;
      readonly signedDocumentUrl?: string | null;
      readonly auditCertificateUrl?: string | null;
      readonly evidenceZipUrl?: string | null;
      readonly providerPayload?: Record<string, unknown> | null;
      readonly providerLastError?: string | null;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      UPDATE case_contracts
      SET status = $2,
          failed_at = now(),
          failure_reason = $3,
          provider_document_status = COALESCE($4, provider_document_status),
          provider_signature_status = COALESCE($5, provider_signature_status),
          biometric_status = COALESCE($6, biometric_status),
          biometric_payload = COALESCE($7::jsonb, biometric_payload),
          biometric_fetched_at = CASE WHEN $7::jsonb IS NOT NULL THEN now() ELSE biometric_fetched_at END,
          signed_document_url = COALESCE($8, signed_document_url),
          audit_certificate_url = COALESCE($9, audit_certificate_url),
          evidence_zip_url = COALESCE($10, evidence_zip_url),
          provider_payload = COALESCE($11::jsonb, provider_payload),
          provider_last_error = COALESCE($12, provider_last_error),
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contractId,
        CaseContractStatus.FAILED,
        input.reason,
        input.providerDocumentStatus ?? null,
        input.providerSignatureStatus ?? null,
        input.biometricStatus ?? null,
        input.biometricPayload ? JSON.stringify(input.biometricPayload) : null,
        input.signedDocumentUrl ?? null,
        input.auditCertificateUrl ?? null,
        input.evidenceZipUrl ?? null,
        input.providerPayload ? JSON.stringify(input.providerPayload) : null,
        input.providerLastError ?? null,
      ],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo actualizar case_contracts a FAILED.');
    }

    return row;
  }

  public async markCaseContractCanceled(
    client: DbClient,
    input: {
      readonly contractId: string;
      readonly reason: string;
      readonly providerDocumentStatus?: string | null;
      readonly providerSignatureStatus?: string | null;
      readonly providerPayload?: Record<string, unknown> | null;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      UPDATE case_contracts
      SET status = $2,
          canceled_at = now(),
          failure_reason = $3,
          provider_document_status = COALESCE($4, provider_document_status),
          provider_signature_status = COALESCE($5, provider_signature_status),
          provider_payload = COALESCE($6::jsonb, provider_payload),
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contractId,
        CaseContractStatus.CANCELED,
        input.reason,
        input.providerDocumentStatus ?? null,
        input.providerSignatureStatus ?? null,
        input.providerPayload ? JSON.stringify(input.providerPayload) : null,
      ],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo actualizar case_contracts a CANCELED.');
    }

    return row;
  }

  public async markCaseContractSigned(
    client: DbClient,
    input: {
      readonly contractId: string;
      readonly providerDocumentStatus: string | null;
      readonly providerSignatureStatus: string | null;
      readonly biometricStatus: string | null;
      readonly biometricPayload: Record<string, unknown> | null;
      readonly signedDocumentUrl: string | null;
      readonly auditCertificateUrl: string | null;
      readonly evidenceZipUrl: string | null;
      readonly signatureUrl: string | null;
      readonly providerPayload: Record<string, unknown>;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      UPDATE case_contracts
      SET status = $2,
          signed_at = now(),
          failure_reason = NULL,
          provider_last_error = NULL,
          provider_document_status = $3,
          provider_signature_status = $4,
          biometric_status = $5,
          biometric_payload = $6::jsonb,
          biometric_fetched_at = now(),
          signed_document_url = $7,
          audit_certificate_url = $8,
          evidence_zip_url = $9,
          signature_url = COALESCE($10, signature_url),
          provider_payload = $11::jsonb,
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contractId,
        CaseContractStatus.SIGNED,
        input.providerDocumentStatus,
        input.providerSignatureStatus,
        input.biometricStatus,
        input.biometricPayload ? JSON.stringify(input.biometricPayload) : null,
        input.signedDocumentUrl,
        input.auditCertificateUrl,
        input.evidenceZipUrl,
        input.signatureUrl,
        JSON.stringify(input.providerPayload),
      ],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo actualizar case_contracts a SIGNED.');
    }

    return row;
  }

  public async updateProviderTracking(
    client: DbClient,
    input: {
      readonly contractId: string;
      readonly providerDocumentStatus: string | null;
      readonly providerSignatureStatus: string | null;
      readonly signatureUrl: string | null;
      readonly providerPayload: Record<string, unknown> | null;
      readonly providerLastError?: string | null;
    },
  ): Promise<CaseContractRow> {
    const result = await client.query<CaseContractRow>(
      `
      UPDATE case_contracts
      SET provider_document_status = COALESCE($2, provider_document_status),
          provider_signature_status = COALESCE($3, provider_signature_status),
          signature_url = COALESCE($4, signature_url),
          provider_payload = COALESCE($5::jsonb, provider_payload),
          provider_last_error = COALESCE($6, provider_last_error),
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contractId,
        input.providerDocumentStatus,
        input.providerSignatureStatus,
        input.signatureUrl,
        input.providerPayload ? JSON.stringify(input.providerPayload) : null,
        input.providerLastError ?? null,
      ],
    );

    const row = this.normalizeCaseContractRow(result.rows[0] ?? null);
    if (!row) {
      throw new Error('No se pudo actualizar tracking del proveedor.');
    }

    return row;
  }

  public async findCaseContractByCaseId(
    caseId: string,
  ): Promise<CaseContractRow | null> {
    return this.dbService.withTransaction(
      async (client: DbClient): Promise<CaseContractRow | null> => {
        const result = await client.query<CaseContractRow>(
          `
          SELECT *
          FROM case_contracts
          WHERE case_id = $1
          ORDER BY
            CASE WHEN status IN ($2, $3) THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 1
          `,
          [caseId, CaseContractStatus.CREATED, CaseContractStatus.SIGN_PENDING],
        );

        return this.normalizeCaseContractRow(result.rows[0] ?? null);
      },
    );
  }

  public async findCaseContractByExternalIdsForUpdate(
    client: DbClient,
    externalDocumentId: string | null,
    externalSignatureId: string | null,
  ): Promise<CaseContractRow | null> {
    const result = await client.query<CaseContractRow>(
      `
      SELECT *
      FROM case_contracts
      WHERE (
        ($1::text IS NOT NULL AND external_document_id = $1::text)
        OR
        ($2::text IS NOT NULL AND external_signature_id = $2::text)
      )
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [externalDocumentId, externalSignatureId],
    );

    return this.normalizeCaseContractRow(result.rows[0] ?? null);
  }

  public async findLoanByCaseIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<LoanRow | null> {
    const result = await client.query<LoanRow>(
      `
      SELECT id, case_id, offer_id, user_id, loan_type, refinances_loan_id, status
      FROM loans
      WHERE case_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async findLoanByRefinancesLoanIdForUpdate(
    client: DbClient,
    refinancesLoanId: string,
  ): Promise<LoanRow | null> {
    const result = await client.query<LoanRow>(
      `
      SELECT id, case_id, offer_id, user_id, loan_type, refinances_loan_id, status
      FROM loans
      WHERE refinances_loan_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [refinancesLoanId],
    );
    return result.rows[0] ?? null;
  }

  public async insertLoan(
    client: DbClient,
    input: {
      readonly userId: string;
      readonly phone: string;
      readonly loanType: string;
      readonly refinancesLoanId: string | null;
      readonly caseId: string;
      readonly offerId: string;
    },
  ): Promise<LoanRow> {
    const result = await client.query<LoanRow>(
      `
      INSERT INTO loans (
        user_id,
        phone,
        status,
        loan_type,
        refinances_loan_id,
        case_id,
        offer_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, 'CREATED', $3, $4, $5, $6, now(), now()
      )
      RETURNING id, case_id, offer_id, user_id, loan_type, refinances_loan_id, status
      `,
      [
        input.userId,
        input.phone,
        input.loanType,
        input.refinancesLoanId,
        input.caseId,
        input.offerId,
      ],
    );

    const loan = result.rows[0];
    if (!loan) {
      throw new Error('No se pudo crear el loan.');
    }

    return loan;
  }

  public async expirePendingContracts(): Promise<ExpiredCaseContractRow[]> {
    return this.dbService.withTransaction(
      async (client: DbClient): Promise<ExpiredCaseContractRow[]> => {
        const result = await client.query<ExpiredCaseContractRow>(
          `
          UPDATE case_contracts
          SET status = $1,
              canceled_at = now(),
              failure_reason = COALESCE(failure_reason, 'CONTRACT_EXPIRED'),
              updated_at = now()
          WHERE status = $2
            AND expires_at IS NOT NULL
            AND expires_at < now()
          RETURNING id, provider, external_document_id
          `,
          [CaseContractStatus.CANCELED, CaseContractStatus.SIGN_PENDING],
        );

        return result.rows;
      },
    );
  }

  private normalizeCaseContractRow(
    row: CaseContractRow | null,
  ): CaseContractRow | null {
    if (!row) return null;

    return {
      ...row,
      biometric_payload:
        row.biometric_payload && typeof row.biometric_payload === 'object'
          ? row.biometric_payload
          : null,
      provider_payload:
        row.provider_payload && typeof row.provider_payload === 'object'
          ? row.provider_payload
          : null,
    };
  }
}
