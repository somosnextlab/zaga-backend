import { CaseContractStatus } from '../enums/case-contract-status.enum';

export interface StartCaseContractContext {
  readonly caseRow: CaseForContractRow;
  readonly offerRow: CaseOfferRow;
  readonly caseContract: CaseContractRow;
  readonly kind: ContractKind;
  readonly guarantor: ContractGuarantorRow | null;
  readonly refinancedLoan: RefinancedLoanRow | null;
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

/** Cuerpo enviado al webhook n8n cuando un contrato queda FAILED. */
export interface ContractFailedN8nPayload {
  readonly trigger_source: 'CONTRACT_VALIDATION_FAILED';
  readonly case_id: string;
  readonly case_contract_id: string;
  readonly fail_reason: string;
}

export type N8nNotifyPayload =
  | PostSignatureN8nPayload
  | ContractFailedN8nPayload;

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
  readonly requires_guarantor: boolean;
  readonly refinances_loan_id: string | null;
  readonly current_offer_id: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly dni: string | null;
  readonly cuit: string | null;
  readonly email: string | null;
  readonly domicilio_calle: string | null;
  readonly domicilio_numero: string | null;
  readonly domicilio_localidad: string | null;
  readonly domicilio_provincia: string | null;
}

/** Datos del codeudor (case_guarantors APPROVED) necesarios para el contrato. */
export interface ContractGuarantorRow {
  readonly id: string;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly dni: string | null;
  readonly cuit: string | null;
  readonly domicilio_calle: string | null;
  readonly domicilio_numero: string | null;
  readonly domicilio_localidad: string | null;
  readonly domicilio_provincia: string | null;
}

/** Préstamo refinanciado: datos que el contrato de refinanciación referencia. */
export interface RefinancedLoanRow {
  readonly id: string;
  readonly public_loan_number: string | null;
}

export interface CaseOfferRow {
  readonly id: string;
  readonly case_id: string;
  readonly status: string;
  readonly amount: number;
  readonly installments: number;
  readonly tasa_nominal_anual: number;
  readonly tasa_moratoria: number | null;
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

/** Tipo de contrato a emitir según la operación. */
export type ContractKind = 'MUTUO' | 'MUTUO_CODEUDOR' | 'REFINANCIACION';

export interface ContractTemplateInput {
  readonly kind: ContractKind;
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
  readonly userDomicilio?: string;
  readonly tasaMoratoria?: number | null;
  readonly userEmail?: string;
  // Codeudor (MUTUO_CODEUDOR y REFINANCIACION).
  readonly codeudorFullName?: string | null;
  readonly codeudorDni?: string | null;
  readonly codeudorCuit?: string | null;
  readonly codeudorDomicilio?: string | null;
  // Refinanciación.
  readonly refinancedLoanNumber?: string | null;
  readonly periodicidad?: string | null;
}

export interface ContractPdfOutput {
  readonly fileName: string;
  readonly pdfBase64: string;
  readonly contractVersion: string;
  readonly templateCode: string;
}
