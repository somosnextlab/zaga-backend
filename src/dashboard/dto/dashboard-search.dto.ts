import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GlobalSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public q?: string;
}
