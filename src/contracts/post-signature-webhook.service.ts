import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PostSignatureN8nPayload } from './interfaces/contracts.interface';

const DEFAULT_TIMEOUT_MS = 10_000;

@Injectable()
export class PostSignatureWebhookService {
  private readonly logger = new Logger(PostSignatureWebhookService.name);
  private readonly webhookUrl: string | null;
  private readonly internalSecret: string | null;
  private readonly timeoutMs: number;

  public constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>(
      'N8N_POST_SIGNATURA_WEBHOOK_URL',
    );
    const trimmed = url?.trim();
    this.webhookUrl = trimmed && trimmed.length > 0 ? trimmed : null;

    const secret = this.configService.get<string>(
      'N8N_INTERNAL_WEBHOOK_SECRET',
    );
    const secretTrimmed = secret?.trim();
    this.internalSecret =
      secretTrimmed && secretTrimmed.length > 0 ? secretTrimmed : null;

    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  /**
   * POST al workflow n8n post-firma. No lanza: errores de red o HTTP se registran y se ignoran.
   */
  public async notify(payload: PostSignatureN8nPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.debug(
        'Webhook post-firma n8n omitido: N8N_POST_SIGNATURA_WEBHOOK_URL no está configurada.',
      );
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (this.internalSecret) {
        headers.authorization = `Bearer ${this.internalSecret}`;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(
          `Webhook post-firma n8n respondió HTTP ${response.status} case_id=${payload.case_id} loan_id=${payload.loan_id} body=${text.slice(0, 500)}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Webhook post-firma n8n falló case_id=${payload.case_id} loan_id=${payload.loan_id}: ${message}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
