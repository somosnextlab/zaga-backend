import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateGuarantorManualIdentityBodyDto {
  @ApiProperty({ example: 'CRISTIAN DENIS' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  public firstName!: string;

  @ApiProperty({ example: 'GIANOBOLI' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  public lastName!: string;

  @ApiProperty({ enum: ['CEO'] })
  @IsIn(['CEO'])
  public actor!: 'CEO';
}
