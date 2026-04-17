import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class EvaluateCaseGuarantorDto {
  @ApiProperty({
    description: 'UUID del case',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Transform(trimString)
  @IsUUID()
  public caseId!: string;

  @ApiProperty({
    description: 'CUIT del candidato a garante (con o sin guiones)',
    example: '20-12345678-9',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  public cuit!: string;
}
