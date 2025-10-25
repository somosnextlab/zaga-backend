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
import { ClientesService } from './clientes.service';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { PaginatedResponse } from '../../common/interfaces/user.interface';

@ApiTags('Clientes')
@Controller('clientes')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClientesController {
  constructor(private clientesService: ClientesService) {}

  @Get()
  @Roles('admin', 'usuario')
  @ApiOperation({
    summary: 'Listar clientes',
    description:
      'Obtiene una lista paginada de clientes. Admin ve todos, usuario ve solo sus clientes.',
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
    name: 'estado',
    required: false,
    enum: ['activo', 'inactivo', 'suspendido'],
    description: 'Filtrar por estado',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: '8ca53b02-86a4-4aeb-be9f-21b8692d7504',
              },
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
                  tipo_doc: { type: 'string', example: 'DNI' },
                  numero_doc: { type: 'string', example: '12345678' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 15 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 2 },
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
    description: 'Acceso denegado. Se requiere rol de administrador o usuario',
  })
  async findAll(
    @Query() query: QueryClientesDto,
    @CurrentUser() _user: UserFromJWT,
  ): Promise<PaginatedResponse<any>> {
    // Extraer access token del header Authorization
    const accessToken = this.extractAccessTokenFromUser(_user);

    // Validar que el usuario tenga permisos
    const { isValid, role } =
      await this.clientesService.validateUserAccess(accessToken);
    if (!isValid) {
      throw new ForbiddenException(
        'Acceso denegado. Se requiere rol de administrador o usuario',
      );
    }

    const result = await this.clientesService.findAll(
      _user.sub,
      role,
      query,
      accessToken,
    );
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
