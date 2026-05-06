import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class EvaluateCaseGuarantorBodyDto {
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
