import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UsuariosService } from './usuarios.service';

interface AuthenticatedRequest {
  user: {
    user_id: string;
  };
}

@ApiTags('usuarios')
@ApiBearerAuth('JWT-auth')
@Controller('usuarios')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Obtener todos los usuarios',
    description:
      'Endpoint para obtener la lista completa de usuarios (solo administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador',
  })
  async findAll() {
    return this.usuariosService.findAll();
  }

  @Get('yo')
  @Roles('admin', 'cliente')
  @ApiOperation({
    summary: 'Obtener mi perfil',
    description: 'Endpoint para obtener la información del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        user_id: { type: 'string' },
        email: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findMe(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.findMe(req.user.user_id);
  }

  @Post('crear-perfil')
  @Roles('cliente')
  @ApiOperation({
    summary: 'Crear perfil de usuario',
    description:
      'Endpoint para crear un perfil de usuario con información adicional',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        user_id: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de cliente',
  })
  async crearPerfil(
    @Body() createPerfilDto: CreatePerfilDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuariosService.crearPerfil(createPerfilDto, req.user.user_id);
  }
}
