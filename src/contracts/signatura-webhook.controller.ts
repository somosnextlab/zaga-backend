import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import type { SignaturaWebhookResult } from './interfaces/contracts.interface';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('Webhooks')
@Controller('webhooks/signatura')
export class SignaturaWebhookController {
  private readonly logger = new Logger(SignaturaWebhookController.name);

  public constructor(private readonly contractsService: ContractsService) {}

  @Post('case-contract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook Signatura: notificaciones de firma de contrato de caso',
  })
  @ApiResponse({ status: 200, description: 'Webhook procesado' })
  public async receiveSignaturaWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() req: RequestWithRawBody,
  ): Promise<SignaturaWebhookResult> {
    const rawBody = this.extractRawBody(req, body);
    const signatureHeader = this.readSignatureHeader(headers);

    return this.contractsService.handleSignaturaWebhook(
      signatureHeader,
      rawBody,
      body,
    );
  }

  /**
   * Signatura envía `x-signature-sha256` (hex del HMAC-SHA256 del cuerpo crudo).
   * Se mantiene fallback a `x-signatura-signature` por compatibilidad.
   */
  private readSignatureHeader(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const keys = ['x-signature-sha256', 'x-signatura-signature'] as const;
    for (const key of keys) {
      const raw = headers[key];
      if (raw === undefined) continue;
      const value = Array.isArray(raw) ? raw[0] : raw;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (trimmed.length > 0) return trimmed;
    }
    return undefined;
  }

  private extractRawBody(req: RequestWithRawBody, body: unknown): Buffer {
    const incomingRawBody = req.rawBody;
    if (Buffer.isBuffer(incomingRawBody)) return incomingRawBody;
    this.logger.warn(
      'Signatura webhook: req.rawBody ausente; se usa JSON.stringify(body). El HMAC de Signatura se calcula sobre el cuerpo crudo: sin rawBody el hash casi nunca coincidirá.',
    );
    return Buffer.from(JSON.stringify(body), 'utf8');
  }
}
