import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerificarEmailDto {
  @ApiProperty({
    description: 'Token de verificación de email',
    example: 'abc123def456ghi789',
    minLength: 32,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty({ message: 'token es requerido' })
  @Length(32, 64, { message: 'token debe tener entre 32 y 64 caracteres' })
  token: string;
}

export class ReenviarVerificacionDto {
  @ApiProperty({
    description: 'Email al cual reenviar la verificación',
    example: 'usuario@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'email es requerido' })
  email: string;
}
