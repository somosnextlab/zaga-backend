import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const MEDIOS_PAGO = [
  'transferencia_cbu',
  'transferencia_cvu',
  'alias',
  'efectivo',
] as const;

export class RegistrarPagoDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  monto: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fecha_accion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comprobante_url?: string;

  @ApiPropertyOptional({ enum: MEDIOS_PAGO })
  @IsOptional()
  @IsIn(MEDIOS_PAGO)
  medio_pago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cuenta_origen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
