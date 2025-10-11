import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CambiarEmailDto {
  @ApiProperty({
    description: 'Nuevo email del usuario',
    example: 'nuevo@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'email es requerido' })
  @IsEmail({}, { message: 'email debe ser una dirección de correo válida' })
  email: string;

  @ApiProperty({
    description: 'Motivo del cambio de email',
    example: 'Usuario solicitó cambio por seguridad',
  })
  @IsString()
  @IsNotEmpty({ message: 'motivo es requerido' })
  motivo: string;
}
