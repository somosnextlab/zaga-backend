import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SignProviderInterface } from '../interfaces/sign-provider.interface';
import type {
  SignaturaBiometricResponse,
  SignaturaCancelDocumentResponse,
  SignaturaCreateDocumentRequest,
  SignaturaCreateDocumentResponse,
  SignaturaDocumentResponse,
} from '../interfaces/signatura.types';

@Injectable()
export class SignaturaService implements SignProviderInterface {
  private readonly logger = new Logger(SignaturaService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  public constructor(private readonly configService: ConfigService) {
    const apiBaseUrl = this.configService.get<string>('SIGNATURA_API_BASE_URL');
    const apiKey = this.configService.get<string>('SIGNATURA_API_KEY');

    if (!apiBaseUrl || !apiKey) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno de Signatura.',
      );
    }

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  public async createDocument(
    input: SignaturaCreateDocumentRequest,
  ): Promise<SignaturaCreateDocumentResponse> {
    const response = await this.request(
      '/documents/create',
      'POST',
      JSON.stringify({
        title: input.fileName,
        file_content: input.pdfBase64,
        signatures: [
          {
            validations: {
              AF: this.normalizeDigits(input.signer.cuit),
              PH: this.normalizePhone(input.signer.phone),
              BI: this.buildBiometricValidation(input.signer.documentNumber),
            },
            invite_channel: ['PH'],
          },
        ],
      }),
    );

    const raw = this.ensureObject(response);
    const firstSignature = this.getFirstSignature(raw);

    return {
      externalDocumentId: this.readString(raw, ['id'], true),
      externalSignatureId: this.readString(firstSignature, ['id'], true),
      documentStatus: this.readString(raw, ['status'], false),
      signatureStatus: this.readString(firstSignature, ['status'], false),
      signatureUrl: this.readNullableString(firstSignature, ['url']),
      issuedAt: this.readNullableString(raw, ['creation_date']),
      expiresAt: null,
      raw,
    };
  }

  public async getDocument(
    externalDocumentId: string,
  ): Promise<SignaturaDocumentResponse> {
    const response = await this.request(
      `/documents/${externalDocumentId}`,
      'GET',
    );
    const raw = this.ensureObject(response);

    const firstSignature = this.getFirstSignature(raw);

    return {
      externalDocumentId,
      documentStatus: this.readNullableString(raw, ['status']),
      signatureStatus: this.readNullableString(firstSignature, ['status']),
      signatureUrl: this.readNullableString(firstSignature, ['url']),
      signedDocumentUrl: `${this.apiBaseUrl}/documents/${externalDocumentId}/download/document`,
      auditCertificateUrl: `${this.apiBaseUrl}/documents/${externalDocumentId}/download/pdf-certificate`,
      evidenceZipUrl: `${this.apiBaseUrl}/documents/${externalDocumentId}/download/zipfile`,
      raw,
    };
  }

  public async getBiometrics(
    externalSignatureId: string,
  ): Promise<SignaturaBiometricResponse> {
    const response = await this.request(
      `/signatures/${externalSignatureId}/biometrics`,
      'GET',
    );
    const raw = this.ensureObject(response);

    return {
      biometricStatus: this.readNullableString(raw, ['status']),
      identityScore: null,
      fullName: this.readNullableString(raw, ['full_name']),
      documentNumber: this.readNullableString(raw, ['document_number']),
      cuit: this.readNullableString(raw, ['cuit']),
      raw,
    };
  }

  public async cancelDocument(
    externalDocumentId: string,
  ): Promise<SignaturaCancelDocumentResponse> {
    const response = await this.request(
      `/documents/${externalDocumentId}/cancel`,
      'PATCH',
      JSON.stringify({
        cancel_reason: 'Canceled by ZAGA expiration policy',
      }),
    );
    const raw = this.ensureObject(response);
    return {
      canceled: true,
      raw,
    };
  }

  private async request(
    path: string,
    method: 'GET' | 'POST' | 'PATCH',
    body?: string,
  ): Promise<unknown> {
    const url = `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    if (!response.ok) {
      const rawError = await response.text();
      this.logger.error(
        `Signatura request failed ${method} ${path}: ${response.status} ${rawError}`,
      );
      throw new InternalServerErrorException('Error al invocar Signatura.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {};
    }

    return (await response.json()) as unknown;
  }

  private ensureObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InternalServerErrorException(
        'Respuesta inválida de Signatura (objeto esperado).',
      );
    }
    return value as Record<string, unknown>;
  }

  private readString(
    source: Record<string, unknown>,
    keys: readonly string[],
    required: boolean,
  ): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    if (required) {
      throw new InternalServerErrorException(
        'Respuesta inválida de Signatura (faltan campos requeridos).',
      );
    }

    return 'UNKNOWN';
  }

  private readNullableString(
    source: Record<string, unknown>,
    keys: readonly string[],
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private readNullableNumber(
    source: Record<string, unknown>,
    keys: readonly string[],
  ): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsedValue = Number(value);
        if (Number.isFinite(parsedValue)) {
          return parsedValue;
        }
      }
    }
    return null;
  }

  private getFirstSignature(
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const signatures = source.signatures;
    if (!Array.isArray(signatures) || signatures.length === 0) {
      throw new InternalServerErrorException(
        'Respuesta inválida de Signatura (sin firmas).',
      );
    }

    const first = (signatures as unknown[])[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) {
      throw new InternalServerErrorException(
        'Respuesta inválida de Signatura (firma inválida).',
      );
    }

    return first as Record<string, unknown>;
  }

  private buildBiometricValidation(
    documentNumber: string | null,
  ): string | null {
    const cleanDocument = this.normalizeDigits(documentNumber);
    if (!cleanDocument) {
      return null;
    }
    return `AR:${cleanDocument}`;
  }

  private normalizeDigits(value: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  private normalizePhone(value: string): string | null {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
