import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { IsEdadMinima } from '../validators/edad-minima.validator';

export class UpdatePerfilDto {
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    minLength: 2,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'nombre no puede tener más de 50 caracteres' })
  nombre?: string;

  @ApiProperty({
    description: 'Apellido del usuario',
    example: 'Pérez',
    minLength: 2,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'apellido debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'apellido no puede tener más de 50 caracteres' })
  apellido?: string;

  // Email no se puede actualizar por seguridad
  // Para cambiar email, contactar al administrador

  @ApiProperty({
    description: 'Teléfono del usuario (formato argentino)',
    example: '+54911234567',
    required: false,
    pattern: '^\\+549\\d{8,10}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+549\d{8,10}$/, {
    message:
      'telefono debe ser un número argentino válido (+549 seguido de 8-10 dígitos)',
  })
  telefono?: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del usuario (debe ser mayor de 18 años)',
    example: '1990-01-01',
    required: false,
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'fecha_nac debe ser una fecha válida en formato YYYY-MM-DD' },
  )
  @IsEdadMinima(18, { message: 'Debe ser mayor de 18 años' })
  @ValidateIf((o) => o.fecha_nac !== undefined)
  fecha_nac?: string;
}
