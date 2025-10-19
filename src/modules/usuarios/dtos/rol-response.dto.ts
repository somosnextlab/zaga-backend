import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para la respuesta del endpoint de rol de usuario
 */
export class RolResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Rol del usuario autenticado',
    enum: ['admin', 'cliente', 'usuario'],
    example: 'cliente',
  })
  role: string;
}
