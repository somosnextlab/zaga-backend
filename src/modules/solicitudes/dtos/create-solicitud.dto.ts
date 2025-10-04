import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateSolicitudDto {
  @ApiProperty({
    description: 'ID del cliente que solicita el préstamo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  cliente_id: string;

  @ApiProperty({
    description: 'Monto solicitado en pesos argentinos',
    example: 500000,
    minimum: 1000,
  })
  @IsNumber()
  @IsPositive()
  @Min(1000)
  monto_solicitado: number;

  @ApiProperty({
    description: 'Plazo en meses para el préstamo',
    example: 24,
    minimum: 1,
    maximum: 60,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(60)
  plazo_meses: number;

  @ApiProperty({
    description: 'Propósito del préstamo',
    example: 'Compra de vehículo',
    required: false,
  })
  @IsOptional()
  @IsString()
  proposito?: string;

  @ApiProperty({
    description: 'Estado de la solicitud',
    example: 'pendiente',
    enum: ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada'])
  estado?: string;
}
