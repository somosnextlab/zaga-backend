import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Cliente para Gotenberg (microservicio Docker). Convierte un `.docx` ya
 * rellenado a PDF fiel vía LibreOffice, conservando todo el formato legal.
 *
 * Gotenberg no trae autenticación propia: se asume detrás de red/proxy privado
 * (ver infra). `GOTENBERG_URL` debe apuntar a esa URL interna; sin default
 * público. Si el proxy exige Basic Auth, setear `GOTENBERG_USER` /
 * `GOTENBERG_PASS` (opcional: si faltan, no se manda header).
 */
@Injectable()
export class GotenbergPdfConverter {
  private readonly logger = new Logger(GotenbergPdfConverter.name);

  public constructor(private readonly configService: ConfigService) {}

  public async convertDocxToPdf(
    docxBuffer: Buffer,
    fileName = 'contrato.docx',
  ): Promise<Buffer> {
    const baseUrl = this.configService.get<string>('GOTENBERG_URL');
    if (!baseUrl || baseUrl.trim().length === 0) {
      throw new InternalServerErrorException(
        'GOTENBERG_URL no está configurada.',
      );
    }

    const timeoutMs = this.readTimeout();
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/forms/libreoffice/convert`;

    const form = new FormData();
    form.append(
      'files',
      new Blob([new Uint8Array(docxBuffer)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      fileName,
    );

    const headers = this.buildAuthHeaders();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(
          `Gotenberg respondió ${response.status}: ${detail.slice(0, 300)}`,
        );
        throw new InternalServerErrorException(
          'No fue posible convertir el contrato a PDF (Gotenberg).',
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Gotenberg falló: ${message}`);
      throw new InternalServerErrorException(
        'No fue posible convertir el contrato a PDF (Gotenberg).',
      );
    }
  }

  /** Basic Auth opcional: solo si `GOTENBERG_USER` y `GOTENBERG_PASS` están seteadas. */
  private buildAuthHeaders(): Record<string, string> {
    const user = this.configService.get<string>('GOTENBERG_USER');
    const pass = this.configService.get<string>('GOTENBERG_PASS');
    if (!user || !pass) {
      return {};
    }
    return {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
    };
  }

  private readTimeout(): number {
    const raw = this.configService.get<string>('GOTENBERG_TIMEOUT_MS');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }
}
