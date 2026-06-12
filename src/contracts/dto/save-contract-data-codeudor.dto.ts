import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type { GuarantorFollowUpLevel } from '../interfaces/contract-data.interface';

export class SaveContractDataCodeudorDto {
  @ApiProperty({ enum: ['CODEUDOR'] })
  @IsIn(['CODEUDOR'])
  public subject!: 'CODEUDOR';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public token!: string;

  @ApiProperty()
  @IsEmail()
  public email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public domicilio_calle!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public domicilio_numero!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public domicilio_piso?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public domicilio_depto?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public domicilio_localidad!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public domicilio_provincia!: string;

  @ApiPropertyOptional({ description: 'Código postal de 4 dígitos' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  public domicilio_cp?: string;

  @ApiProperty({ enum: ['CONOCIDO', 'FAMILIAR', 'PROFESIONAL'] })
  @IsIn(['CONOCIDO', 'FAMILIAR', 'PROFESIONAL'])
  public follow_up_level!: GuarantorFollowUpLevel;
}
