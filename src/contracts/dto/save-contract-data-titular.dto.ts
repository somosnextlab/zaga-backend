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
import type { BankAccountKind } from '../interfaces/contract-data.interface';

export class SaveContractDataTitularDto {
  @ApiProperty({ enum: ['TITULAR'] })
  @IsIn(['TITULAR'])
  public subject!: 'TITULAR';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public token!: string;

  @ApiProperty()
  @IsEmail()
  public email!: string;

  @ApiPropertyOptional({ enum: ['CBU', 'CVU'] })
  @IsOptional()
  @IsIn(['CBU', 'CVU'])
  public account_kind?: BankAccountKind;

  @ApiProperty({ description: 'CBU/CVU de 22 dígitos numéricos' })
  @Matches(/^\d{22}$/)
  public cbu_cvu!: string;

  @ApiPropertyOptional({ description: 'Alias bancario (6-20 caracteres)' })
  @IsOptional()
  @Matches(/^[a-zA-Z0-9.-]{6,20}$/)
  public alias?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public bank_name!: string;

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
}
