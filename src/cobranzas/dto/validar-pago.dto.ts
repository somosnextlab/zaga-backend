import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const ESTADOS_VALIDACION = ['validado', 'rechazado', 'dudoso'] as const;
export type EstadoValidacionPago = (typeof ESTADOS_VALIDACION)[number];

export class ValidarPagoDto {
  @ApiProperty({ enum: ESTADOS_VALIDACION })
  @IsIn(ESTADOS_VALIDACION)
  estado: EstadoValidacionPago;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fecha_acreditacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
