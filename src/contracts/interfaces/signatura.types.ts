export interface SignaturaCreateDocumentRequest {
  readonly contractId: string;
  readonly fileName: string;
  readonly pdfBase64: string;
  readonly signer: {
    readonly fullName: string;
    readonly documentNumber: string | null;
    readonly cuit: string | null;
    readonly phone: string;
  };
  readonly metadata: Record<string, string>;
}

export interface SignaturaCreateDocumentResponse {
  readonly externalDocumentId: string;
  readonly externalSignatureId: string;
  readonly documentStatus: string;
  readonly signatureStatus: string;
  readonly signatureUrl: string | null;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly raw: Record<string, unknown>;
}

export interface SignaturaDocumentResponse {
  readonly externalDocumentId: string;
  readonly documentStatus: string | null;
  readonly signatureStatus: string | null;
  readonly signatureUrl: string | null;
  readonly signedDocumentUrl: string | null;
  readonly auditCertificateUrl: string | null;
  readonly evidenceZipUrl: string | null;
  readonly raw: Record<string, unknown>;
}

export interface SignaturaBiometricResponse {
  readonly biometricStatus: string | null;
  readonly identityScore: number | null;
  readonly fullName: string | null;
  readonly documentNumber: string | null;
  readonly cuit: string | null;
  readonly raw: Record<string, unknown>;
}

export interface SignaturaCancelDocumentResponse {
  readonly canceled: boolean;
  readonly raw: Record<string, unknown>;
}
