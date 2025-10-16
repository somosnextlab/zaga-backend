import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ClientesService } from './clientes.service';

@ApiTags('clientes')
@ApiBearerAuth('JWT-auth')
@Controller('clientes')
@UseGuards(SupabaseJwtGuard, RolesGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @Roles('admin', 'cliente')
  @ApiOperation({
    summary: 'Obtener todos los clientes',
    description:
      'Endpoint para obtener la lista paginada de clientes (admin y cliente)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              persona_id: { type: 'string' },
              estado: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
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
    description: 'Acceso denegado - Se requiere rol de administrador o cliente',
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.clientesService.findAll(page, limit);
  }

  @Get(':id')
  @Roles('admin', 'cliente')
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description:
      'Endpoint para obtener un cliente específico por su ID (admin y cliente)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        persona_id: { type: 'string' },
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
            fecha_nac: { type: 'string', format: 'date' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Se requiere rol de administrador o cliente',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Desactivar cliente',
    description:
      'Endpoint para desactivar un cliente (soft delete) - solo administradores',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente desactivado exitosamente',
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
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async deactivateClient(@Param('id') id: string) {
    return this.clientesService.deactivateClient(id);
  }
}
