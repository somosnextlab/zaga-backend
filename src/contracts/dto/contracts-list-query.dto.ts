import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ContractsListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  public page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? 20 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public status?: string;
}
