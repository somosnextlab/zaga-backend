const SIGNED_SIGNATURE_STATUSES = ['SIGNED', 'COMPLETED', 'APPROVED', 'CO'];
const REJECTED_SIGNATURE_STATUSES = ['REJECTED', 'DECLINED', 'FAILED', 'DE'];
const CANCELED_SIGNATURE_STATUSES = ['CANCELED', 'CANCELLED', 'EXPIRED', 'CA'];

const ERROR_DOCUMENT_STATUSES = ['ERROR', 'FAILED'];
const CANCELED_DOCUMENT_STATUSES = ['CANCELED', 'CANCELLED', 'EXPIRED', 'CA'];
const SIGNED_DOCUMENT_STATUSES = ['CO'];

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toUpperCase();
}

export function isProviderSigned(
  documentStatus: string | null | undefined,
  signatureStatus: string | null | undefined,
): boolean {
  const normalizedDocumentStatus = normalizeStatus(documentStatus);
  const normalizedSignatureStatus = normalizeStatus(signatureStatus);
  return (
    SIGNED_SIGNATURE_STATUSES.includes(normalizedSignatureStatus) ||
    SIGNED_DOCUMENT_STATUSES.includes(normalizedDocumentStatus)
  );
}

export function isProviderRejected(
  documentStatus: string | null | undefined,
  signatureStatus: string | null | undefined,
): boolean {
  const normalizedSignatureStatus = normalizeStatus(signatureStatus);
  const normalizedDocumentStatus = normalizeStatus(documentStatus);

  return (
    REJECTED_SIGNATURE_STATUSES.includes(normalizedSignatureStatus) ||
    ERROR_DOCUMENT_STATUSES.includes(normalizedDocumentStatus)
  );
}

export function isProviderCanceled(
  documentStatus: string | null | undefined,
  signatureStatus: string | null | undefined,
): boolean {
  const normalizedSignatureStatus = normalizeStatus(signatureStatus);
  const normalizedDocumentStatus = normalizeStatus(documentStatus);

  return (
    CANCELED_SIGNATURE_STATUSES.includes(normalizedSignatureStatus) ||
    CANCELED_DOCUMENT_STATUSES.includes(normalizedDocumentStatus)
  );
}

export function normalizeProviderStatus(
  status: string | null | undefined,
): string | null {
  const normalized = normalizeStatus(status);
  return normalized.length > 0 ? normalized : null;
}
