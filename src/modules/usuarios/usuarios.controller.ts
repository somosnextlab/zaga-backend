import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CambiarEmailDto } from './dtos/cambiar-email.dto';
import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { RolResponseDto } from './dtos/rol-response.dto';
import { UpdatePerfilDto } from './dtos/update-perfil.dto';
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
      'Endpoint para obtener la lista paginada de usuarios (solo administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              persona_id: { type: 'string' },
              rol: { type: 'string' },
              estado: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.usuariosService.findAll(page, limit);
  }

  @Put('yo')
  @Roles('admin', 'cliente')
  @ApiOperation({
    summary: 'Actualizar mi perfil',
    description:
      'Endpoint para actualizar la información del perfil del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            persona_id: { type: 'string' },
            nombre: { type: 'string' },
            apellido: { type: 'string' },
            email: { type: 'string' },
            telefono: { type: 'string' },
            fecha_nac: { type: 'string', format: 'date' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async updateMe(
    @Body() updatePerfilDto: UpdatePerfilDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usuariosService.updateMe(updatePerfilDto, req.user.user_id);
  }

  @Get('rol-usuario')
  @Roles('admin', 'cliente', 'usuario')
  @ApiOperation({
    summary: 'Obtener rol del usuario',
    description:
      'Endpoint para obtener el rol del usuario autenticado desde la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol del usuario obtenido exitosamente',
    type: RolResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado o inactivo' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async obtenerRolUsuario(
    @Req() req: AuthenticatedRequest,
  ): Promise<RolResponseDto> {
    return this.usuariosService.obtenerRolUsuario(req.user.user_id);
  }

  @Get(':id')
  @Roles('admin', 'usuario')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description:
      'Endpoint para obtener un usuario específico por su ID (admin y usuario)',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        persona_id: { type: 'string' },
        rol: { type: 'string' },
        estado: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        persona: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nombre: { type: 'string' },
            apellido: { type: 'string' },
            email: { type: 'string' },
            telefono: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Delete(':id')
  @Roles('admin', 'usuario')
  @ApiOperation({
    summary: 'Desactivar usuario',
    description:
      'Endpoint para desactivar un usuario (soft delete) - admin y usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario desactivado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async deactivateUser(@Param('id') id: string) {
    return this.usuariosService.deactivateUser(id);
  }

  @Put(':id/cambiar-email')
  @Roles('admin')
  @ApiOperation({
    summary: 'Cambiar email de usuario',
    description:
      'Endpoint para que un administrador cambie el email de un usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Email cambiado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async cambiarEmail(
    @Param('id') id: string,
    @Body() cambiarEmailDto: CambiarEmailDto,
  ) {
    return this.usuariosService.cambiarEmail(id, cambiarEmailDto);
  }

  @Post('registro-inicial')
  @Roles('usuario')
  @ApiOperation({
    summary: 'Registro inicial de usuario',
    description:
      'Endpoint para crear el registro inicial de usuario después de verificar email. Solo crea el usuario con rol "usuario".',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            rol: { type: 'string' },
            estado: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de usuario',
  })
  async registroInicial(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.registroInicial(req.user.user_id);
  }

  @Post('crear-perfil')
  @Roles('usuario')
  @ApiOperation({
    summary: 'Crear perfil completo de cliente',
    description:
      'Endpoint para crear perfil completo con datos personales. Cambia el rol de "usuario" a "cliente".',
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
