import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { SupabaseJwtGuard } from '../../config/supabase-jwt.guard';
import {
  CurrentUser,
  UserFromJWT,
} from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../common/interfaces/user.interface';

@ApiTags('Autenticación')
@Controller('auth')
@UseGuards(SupabaseJwtGuard)
@ApiBearerAuth('JWT-auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description:
      'Retorna la información del usuario autenticado incluyendo rol y datos de persona',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
            email: { type: 'string', example: 'usuario@ejemplo.com' },
            role: {
              type: 'string',
              example: 'admin',
              enum: ['admin', 'usuario', 'cliente'],
            },
            estado: { type: 'string', example: 'activo' },
            persona: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '8ca53b02-86a4-4aeb-be9f-21b8692d7504',
                },
                nombre: { type: 'string', example: 'Juan' },
                apellido: { type: 'string', example: 'Pérez' },
                telefono: { type: 'string', example: '+54911234567' },
              },
            },
          },
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Token JWT inválido o expirado',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async getMyProfile(@CurrentUser() user: UserFromJWT): Promise<ApiResponse> {
    // Usar el access token del usuario autenticado
    const result = await this.authService.getMyProfile(
      user.sub,
      user.accessToken,
    );
    return result;
  }
}
