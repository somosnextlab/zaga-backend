import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ApplyManualIdentityDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(trimString)
  @IsUUID()
  public caseId!: string;

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
