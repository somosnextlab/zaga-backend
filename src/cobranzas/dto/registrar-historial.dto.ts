import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const TIPOS_ACCION_HISTORIAL = [
  'mensaje_d3',
  'mensaje_d1',
  'mensaje_d0',
  'mensaje_mora_inicial',
  'mensaje_mora_blanda',
  'mensaje_solapamiento',
  'mensaje_mora_dura',
  'alerta_ceo',
  'alerta_codeudor',
  'comprobante_recibido',
  'pago_registrado',
  'pago_validado',
  'pago_rechazado',
  'pago_dudoso',
  'pago_imputado',
  'compromiso_registrado',
  'compromiso_cumplido',
  'compromiso_roto',
  'nota_interna',
  'contacto_codeudor',
  'derivacion_legal',
  'bloqueo_nuevo_credito',
] as const;

export type TipoAccionHistorial = (typeof TIPOS_ACCION_HISTORIAL)[number];

export class RegistrarHistorialDto {
  @ApiProperty({ enum: TIPOS_ACCION_HISTORIAL })
  @IsIn(TIPOS_ACCION_HISTORIAL)
  tipo_accion: TipoAccionHistorial;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dpd_al_momento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cuota_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pago_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  compromiso_id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  realizado_por: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
