import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Token JWT para autenticación',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  access_token: string;

  @ApiProperty({
    description: 'Tipo de token',
    example: 'Bearer',
    type: String,
  })
  token_type: string;

  @ApiProperty({
    description: 'Tiempo de expiración en segundos',
    example: 86400,
    type: Number,
  })
  expires_in: number;

  @ApiProperty({
    description: 'Información del usuario autenticado',
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID único del usuario',
      },
      email: {
        type: 'string',
        example: 'usuario@ejemplo.com',
        description: 'Email del usuario',
      },
      rol: {
        type: 'string',
        example: 'cliente',
        description: 'Rol del usuario',
        enum: ['admin', 'cliente'],
      },
    },
  })
  user: {
    user_id: string;
    email: string;
    rol: string;
  };
}
