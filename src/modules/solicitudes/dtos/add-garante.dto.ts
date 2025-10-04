import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AddGaranteDto {
  @ApiProperty({
    description: 'ID del garante a asociar',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  garante_id: string;
}
