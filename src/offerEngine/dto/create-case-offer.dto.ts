import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCaseOfferDto {
  @ApiProperty({
    description: 'UUID del caso',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  public case_id!: string;

  @ApiProperty({
    description: 'Monto pre-aprobado del préstamo',
    example: 500000,
  })
  @IsNumber()
  @IsPositive({ message: 'monto_pre_aprobado debe ser mayor a 0' })
  public monto_pre_aprobado!: number;

  @ApiProperty({
    description: 'Tasa nominal anual en porcentaje (ej: 210 = 210%)',
    example: 210,
  })
  @IsNumber()
  @IsPositive({ message: 'tasa_nominal_anual debe ser mayor a 0' })
  public tasa_nominal_anual!: number;

  @ApiPropertyOptional({
    description: 'Indica si el caso requiere garante',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  public requires_guarantor?: boolean;

  @ApiPropertyOptional({
    description:
      'Identificador de quién creó la oferta (ej: user_id o sistema)',
  })
  @IsOptional()
  @IsString()
  public created_by?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento de la primera cuota (ISO 8601)',
  })
  @IsOptional()
  @IsString()
  public first_due_date?: string;
}
