import type {
  SignaturaBiometricResponse,
  SignaturaCancelDocumentResponse,
  SignaturaCreateDocumentRequest,
  SignaturaCreateDocumentResponse,
  SignaturaDocumentResponse,
} from './signatura.types';

export interface SignProviderInterface {
  createDocument(
    input: SignaturaCreateDocumentRequest,
  ): Promise<SignaturaCreateDocumentResponse>;
  getDocument(externalDocumentId: string): Promise<SignaturaDocumentResponse>;
  getBiometrics(
    externalSignatureId: string,
  ): Promise<SignaturaBiometricResponse>;
  cancelDocument(
    externalDocumentId: string,
  ): Promise<SignaturaCancelDocumentResponse>;
}
