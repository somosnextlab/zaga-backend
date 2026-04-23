import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ApplyAprobadoFinalDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(trimString)
  @IsUUID()
  public caseId!: string;
}
