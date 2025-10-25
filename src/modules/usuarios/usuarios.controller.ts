import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SupabaseJwtGuard } from '../../config/supabase-jwt.guard';
import { RolesGuard } from '../../config/roles.guard';
import { Roles } from '../../config/roles.decorator';
import {
  CurrentUser,
  UserFromJWT,
} from '../../common/decorators/current-user.decorator';
import { UsuariosService } from './usuarios.service';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { PaginatedResponse } from '../../common/interfaces/user.interface';

@ApiTags('Usuarios')
@Controller('usuarios')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsuariosController {
  constructor(private usuariosService: UsuariosService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Obtiene una lista paginada de usuarios. Solo accesible para administradores.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Elementos por página',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    enum: ['admin', 'usuario', 'cliente'],
    description: 'Filtrar por rol',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['activo', 'inactivo'],
    description: 'Filtrar por estado',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                example: '550e8400-e29b-41d4-a716-446655440000',
              },
              rol: { type: 'string', example: 'admin' },
              estado: { type: 'string', example: 'activo' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              persona: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    example: '8ca53b02-86a4-4aeb-be9f-21b8692d7504',
                  },
                  nombre: { type: 'string', example: 'Juan' },
                  apellido: { type: 'string', example: 'Pérez' },
                  email: { type: 'string', example: 'juan@ejemplo.com' },
                  telefono: { type: 'string', example: '+54911234567' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 3 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
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
    status: 403,
    description: 'Acceso denegado. Se requiere rol de administrador',
  })
  async findAll(
    @Query() query: QueryUsuariosDto,
    @CurrentUser() _user: UserFromJWT,
  ): Promise<PaginatedResponse<any>> {
    // Extraer access token del header Authorization
    const accessToken = this.extractAccessTokenFromUser(_user);

    // Validar que el usuario sea administrador
    const isAdmin = await this.usuariosService.validateAdminAccess(accessToken);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Acceso denegado. Se requiere rol de administrador',
      );
    }

    const result = await this.usuariosService.findAll(query, accessToken);
    return result;
  }

  /**
   * Extrae el access token del objeto user
   * En un escenario real, esto debería venir del request headers
   */
  private extractAccessTokenFromUser(_user: UserFromJWT): string {
    // TODO: En una implementación real, esto debería extraerse del request
    return 'simulated-token';
  }
}
