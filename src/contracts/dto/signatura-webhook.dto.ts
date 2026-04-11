import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Esquema documental flexible: el endpoint real usa `body: unknown` y valida en servicio.
 * Sin reglas cruzadas obligatorias para no bloquear payloads mínimos de Signatura.
 */
export class SignaturaWebhookDto {
  @ApiPropertyOptional({
    description: 'Acción del webhook de Signatura (ej: DS, SD, DC)',
  })
  @IsOptional()
  @IsString()
  public notification_action?: string;

  @ApiPropertyOptional({
    description: 'document_id del webhook de Signatura',
  })
  @IsOptional()
  @IsString()
  public document_id?: string;

  @ApiPropertyOptional({
    description: 'signature_id del webhook de Signatura',
  })
  @IsOptional()
  @IsString()
  public signature_id?: string;

  @ApiPropertyOptional({
    description: 'notification_id del webhook de Signatura',
  })
  @IsOptional()
  @IsString()
  public notification_id?: string;

  @ApiPropertyOptional({
    description: 'new_status del webhook de Signatura',
  })
  @IsOptional()
  @IsString()
  public new_status?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key o id del evento del proveedor',
  })
  @IsOptional()
  @IsString()
  public eventId?: string;

  @ApiPropertyOptional({
    description: 'Tipo de evento emitido por Signatura',
  })
  @IsOptional()
  @IsString()
  public eventType?: string;

  @ApiPropertyOptional({
    description: 'Id externo del documento en Signatura (alias camelCase)',
  })
  @IsOptional()
  @IsString()
  public externalDocumentId?: string;

  @ApiPropertyOptional({
    description: 'Id externo del flujo de firma en Signatura (alias camelCase)',
  })
  @IsOptional()
  @IsString()
  public externalSignatureId?: string;

  @ApiPropertyOptional({
    description: 'Estado del documento en el proveedor',
  })
  @IsOptional()
  @IsString()
  public providerDocumentStatus?: string;

  @ApiPropertyOptional({
    description: 'Estado de firma en el proveedor',
  })
  @IsOptional()
  @IsString()
  public providerSignatureStatus?: string;

  @ApiPropertyOptional({
    description: 'URL de firma del proveedor',
  })
  @IsOptional()
  @IsString()
  public signatureUrl?: string;

  @ApiPropertyOptional({
    description: 'URL del documento firmado',
  })
  @IsOptional()
  @IsString()
  public signedDocumentUrl?: string;

  @ApiPropertyOptional({
    description: 'URL del certificado de auditoría',
  })
  @IsOptional()
  @IsString()
  public auditCertificateUrl?: string;

  @ApiPropertyOptional({
    description: 'URL del zip de evidencias',
  })
  @IsOptional()
  @IsString()
  public evidenceZipUrl?: string;

  @ApiPropertyOptional({
    description: 'Estado biométrico reportado por el proveedor',
  })
  @IsOptional()
  @IsString()
  public biometricStatus?: string;

  @ApiPropertyOptional({
    description: 'Marca temporal del evento (ISO 8601)',
  })
  @IsOptional()
  @IsISO8601()
  public occurredAt?: string;

  @ApiPropertyOptional({
    description: 'Código de error del proveedor',
  })
  @IsOptional()
  @IsString()
  public errorCode?: string;

  @ApiPropertyOptional({
    description: 'Mensaje de error del proveedor',
  })
  @IsOptional()
  @IsString()
  public errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Payload bruto del proveedor',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  public providerPayload?: Record<string, unknown>;
}
