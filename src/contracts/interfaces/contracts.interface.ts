import { CaseContractStatus } from '../enums/case-contract-status.enum';

export interface StartCaseContractContext {
  readonly caseRow: CaseForContractRow;
  readonly offerRow: CaseOfferRow;
  readonly caseContract: CaseContractRow;
}

export interface StartCaseContractResponse {
  readonly caseId: string;
  readonly caseContractId: string;
  readonly status: CaseContractStatus;
  readonly externalDocumentId: string;
  readonly externalSignatureId: string;
  readonly signatureUrl: string | null;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
}

export interface CaseContractStatusResponse {
  readonly caseId: string;
  readonly caseContractId: string;
  readonly status: CaseContractStatus;
  readonly providerDocumentStatus: string | null;
  readonly providerSignatureStatus: string | null;
  readonly signatureUrl: string | null;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly signedAt: string | null;
  readonly canceledAt: string | null;
  readonly failedAt: string | null;
  readonly failureReason: string | null;
}

export interface SignaturaWebhookResult {
  readonly accepted: true;
  readonly contractFound: boolean;
  readonly caseContractId: string | null;
  readonly status: CaseContractStatus | null;
  readonly loanId: string | null;
}

/** Cuerpo enviado al webhook n8n tras crear un loan nuevo por contrato firmado. */
export interface PostSignatureN8nPayload {
  readonly case_id: string;
  readonly loan_id: string;
  readonly user_id: string;
  readonly phone: string;
  readonly case_type: string;
  readonly trigger_source: 'CONTRACT_SIGNED';
}

/** Payload normalizado del webhook de Signatura (snake_case y camelCase). */
export interface SignaturaWebhookParsed {
  readonly documentId: string | null;
  readonly signatureId: string | null;
  readonly notificationId: string | null;
  readonly notificationAction: string | null;
  readonly newStatus: string | null;
  readonly providerDocumentStatus: string | null;
  readonly providerSignatureStatus: string | null;
  readonly signatureUrl: string | null;
  readonly signedDocumentUrl: string | null;
  readonly auditCertificateUrl: string | null;
  readonly evidenceZipUrl: string | null;
  readonly biometricStatus: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly providerPayload: Record<string, unknown> | null;
  readonly raw: Record<string, unknown>;
}

export interface CaseForContractRow {
  readonly id: string;
  readonly user_id: string;
  readonly phone: string;
  readonly status: string;
  readonly case_type: string;
  readonly refinances_loan_id: string | null;
  readonly current_offer_id: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly dni: string | null;
  readonly cuit: string | null;
}

export interface CaseOfferRow {
  readonly id: string;
  readonly case_id: string;
  readonly status: string;
  readonly amount: number;
  readonly installments: number;
  readonly tasa_nominal_anual: number;
}

export interface CaseContractRow {
  readonly id: string;
  readonly case_id: string;
  readonly offer_id: string;
  readonly provider: string;
  readonly status: CaseContractStatus;
  readonly contract_version: string | null;
  readonly template_code: string | null;
  readonly external_document_id: string | null;
  readonly external_signature_id: string | null;
  readonly provider_document_status: string | null;
  readonly provider_signature_status: string | null;
  readonly signature_url: string | null;
  readonly issued_at: string | null;
  readonly expires_at: string | null;
  readonly signed_at: string | null;
  readonly canceled_at: string | null;
  readonly failed_at: string | null;
  readonly failure_reason: string | null;
  readonly biometric_status: string | null;
  readonly biometric_payload: Record<string, unknown> | null;
  readonly biometric_fetched_at: string | null;
  readonly signed_document_url: string | null;
  readonly audit_certificate_url: string | null;
  readonly evidence_zip_url: string | null;
  readonly provider_payload: Record<string, unknown> | null;
  readonly provider_last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ExpiredCaseContractRow {
  readonly id: string;
  readonly provider: string;
  readonly external_document_id: string | null;
}

export interface LoanRow {
  readonly id: string;
  readonly case_id: string;
  readonly offer_id: string;
  readonly user_id: string;
  readonly loan_type: string;
  readonly refinances_loan_id: string | null;
  readonly status: string;
}

export interface ContractTemplateInput {
  readonly contractId: string;
  readonly caseId: string;
  readonly offerId: string;
  readonly amount: number;
  readonly installments: number;
  readonly tasaNominalAnual: number;
  readonly userFullName: string;
  readonly userDni: string | null;
  readonly userCuit: string | null;
  readonly userPhone: string;
}

export interface ContractPdfOutput {
  readonly fileName: string;
  readonly pdfBase64: string;
  readonly contractVersion: string;
  readonly templateCode: string;
}
