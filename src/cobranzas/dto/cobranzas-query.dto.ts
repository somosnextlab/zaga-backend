import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const BUCKETS_DPD = [
  'al_dia',
  'por_vencer',
  'mora_inicial',
  'mora_blanda',
  'mora_solapada',
  'mora_dura',
  'mora_critica',
  'legal',
  'legal_diferido',
  'referencia_regulatoria',
] as const;

export type BucketDpd = (typeof BUCKETS_DPD)[number];

export class CobranzasQueryDto {
  @ApiPropertyOptional({ enum: BUCKETS_DPD })
  @IsOptional()
  @IsIn(BUCKETS_DPD)
  bucket?: BucketDpd;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
