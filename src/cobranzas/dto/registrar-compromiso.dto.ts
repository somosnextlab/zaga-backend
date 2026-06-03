import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const CANALES = ['whatsapp', 'llamada', 'email', 'otro'] as const;

export class RegistrarCompromisoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cuota_id?: string;

  @ApiProperty()
  @IsDateString()
  fecha_prometida: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  monto_prometido: number;

  @ApiPropertyOptional({ enum: CANALES })
  @IsOptional()
  @IsIn(CANALES)
  canal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  texto_cliente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
