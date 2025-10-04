import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsIn } from 'class-validator';

export class CreateGaranteDto {
  @ApiProperty({
    description: 'ID de la persona asociada al garante',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  persona_id: string;

  @ApiProperty({
    description: 'Estado del garante',
    example: 'activo',
    enum: ['activo', 'inactivo', 'suspendido'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['activo', 'inactivo', 'suspendido'])
  estado?: string;
}
