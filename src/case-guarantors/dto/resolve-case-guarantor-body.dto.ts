import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, ValidateIf } from 'class-validator';

export class ResolveCaseGuarantorBodyDto {
  @ApiProperty({ enum: ['GARANTE_APROBADO', 'GARANTE_RECHAZADO'] })
  @IsIn(['GARANTE_APROBADO', 'GARANTE_RECHAZADO'])
  public action!: 'GARANTE_APROBADO' | 'GARANTE_RECHAZADO';

  @ApiProperty({ enum: ['CEO', 'ASESORIA'] })
  @IsIn(['CEO', 'ASESORIA'])
  public actor!: 'CEO' | 'ASESORIA';

  @ApiPropertyOptional({
    description:
      'Obligatorio si action = GARANTE_RECHAZADO. Motivo de trazabilidad para review_reason.',
    enum: ['DISCARDED_BY_CEO', 'CEO_REQUESTED_NEW_GUARANTOR'],
  })
  @ValidateIf(
    (o: ResolveCaseGuarantorBodyDto) => o.action === 'GARANTE_RECHAZADO',
  )
  @IsNotEmpty()
  @IsIn(['DISCARDED_BY_CEO', 'CEO_REQUESTED_NEW_GUARANTOR'])
  public rejectReason?: 'DISCARDED_BY_CEO' | 'CEO_REQUESTED_NEW_GUARANTOR';
}
