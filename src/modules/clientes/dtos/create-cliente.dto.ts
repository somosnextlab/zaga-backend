import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsIn } from 'class-validator';

export class CreateClienteDto {
  @ApiProperty({
    description: 'ID de la persona asociada al cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  persona_id: string;

  @ApiProperty({
    description: 'Estado del cliente',
    example: 'activo',
    enum: ['activo', 'inactivo', 'suspendido'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['activo', 'inactivo', 'suspendido'])
  estado?: string;
}
