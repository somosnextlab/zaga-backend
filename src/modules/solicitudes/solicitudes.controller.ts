import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard, SupabaseUser } from '@config/supabase-jwt.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupabaseUserService } from '@supabase/supabase-user.service';

import { AddGaranteDto } from './dtos/add-garante.dto';
import { CreateSolicitudDto } from './dtos/create-solicitud.dto';
import { UpdateSolicitudDto } from './dtos/update-solicitud.dto';
import { SolicitudesService } from './solicitudes.service';
// import { Queue } from 'bullmq';
// import { Inject } from '@nestjs/common';

@ApiTags('Solicitudes')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('solicitudes')
export class SolicitudesController {
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly supabaseUserService: SupabaseUserService,
    // @Inject('evaluacion') private evaluacionQueue: Queue,
  ) {}

  @Post()
  @Roles('admin', 'analista', 'cliente')
  @ApiOperation({ summary: 'Crear una nueva solicitud de préstamo (RLS aplicado automáticamente)' })
  @ApiResponse({ status: 201, description: 'Solicitud creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(@Body() createSolicitudDto: CreateSolicitudDto, @Req() req: { user: SupabaseUser; userToken: string }) {
    const user: SupabaseUser = req.user;
    const userToken: string = req.userToken;

    // Obtener cliente_id del JWT para evitar manipulación del cliente
    const clienteId = user.app_metadata?.cliente_id || user.cliente_id;
    
    if (!clienteId) {
      throw new Error('No se pudo determinar el cliente_id del usuario autenticado');
    }

    // Inicializar cliente Supabase con el token del usuario
    const sb = this.supabaseUserService.initFinancieraWithToken(userToken);

    // Crear solicitud con cliente_id del JWT (server-side)
    const solicitudData = {
      cliente_id: clienteId,
      monto_solicitado: createSolicitudDto.monto_solicitado,
      plazo_meses: createSolicitudDto.plazo_meses,
      proposito: createSolicitudDto.proposito,
      estado: createSolicitudDto.estado || 'pendiente',
      consentimiento: true, // Siempre true para solicitudes creadas por usuarios autenticados
    };

    const { data, error } = await sb
      .from('solicitudes')
      .insert([solicitudData])
      .select(`
        *,
        cliente:clientes(
          *,
          persona:personas(*)
        )
      `)
      .single();

    if (error) {
      throw new Error(`Error al crear solicitud: ${error.message}`);
    }

    return data;
  }

  @Get()
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener solicitudes (RLS aplicado automáticamente)' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes obtenida exitosamente' })
  async findAll(@Req() req: { user: SupabaseUser; userToken: string }) {
    const user: SupabaseUser = req.user;
    const userToken: string = req.userToken;

    // Inicializar cliente Supabase con el token del usuario
    const sb = this.supabaseUserService.initFinancieraWithToken(userToken);

    // Usar Supabase con RLS - el usuario solo verá sus propias solicitudes
    // o todas si es admin (dependiendo de la configuración RLS en Supabase)
    const { data, error } = await sb
      .from('solicitudes')
      .select(`
        *,
        cliente:clientes(
          *,
          persona:personas(*)
        ),
        solicitud_garantes:solicitud_garantes(
          *,
          garante:garantes(
            *,
            persona:personas(*)
          )
        ),
        evaluaciones(*)
      `);

    if (error) {
      throw new Error(`Error al obtener solicitudes: ${error.message}`);
    }

    return data;
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener una solicitud por ID' })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  findOne(@Param('id') id: string) {
    return this.solicitudesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Actualizar una solicitud' })
  @ApiResponse({ status: 200, description: 'Solicitud actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  update(@Param('id') id: string, @Body() updateSolicitudDto: UpdateSolicitudDto) {
    return this.solicitudesService.update(id, updateSolicitudDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar una solicitud' })
  @ApiResponse({ status: 200, description: 'Solicitud eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  remove(@Param('id') id: string) {
    return this.solicitudesService.remove(id);
  }

  @Post(':id/garantes')
  @Roles('admin', 'analista', 'cliente')
  @ApiOperation({ summary: 'Agregar un garante a una solicitud' })
  @ApiResponse({ status: 201, description: 'Garante agregado exitosamente' })
  @ApiResponse({ status: 400, description: 'Garante ya asociado o no encontrado' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  addGarante(@Param('id') id: string, @Body() addGaranteDto: AddGaranteDto) {
    return this.solicitudesService.addGarante(id, addGaranteDto);
  }

  @Get(':id/garantes')
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener garantes de una solicitud' })
  @ApiResponse({ status: 200, description: 'Lista de garantes obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  getGarantes(@Param('id') id: string) {
    return this.solicitudesService.getGarantes(id);
  }

  @Get(':id/evaluaciones')
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener evaluaciones de una solicitud' })
  @ApiResponse({ status: 200, description: 'Lista de evaluaciones obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  getEvaluaciones(@Param('id') id: string) {
    return this.solicitudesService.getEvaluaciones(id);
  }

  @Post(':id/evaluar')
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Iniciar evaluación de una solicitud' })
  @ApiResponse({ status: 202, description: 'Evaluación iniciada exitosamente' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async evaluar(@Param('id') id: string) {
    const _solicitud = await this.solicitudesService.findOne(id);
    
    // TODO: Implementar evaluación con BullMQ cuando esté configurado
    // await this.evaluacionQueue.add('consulta_fuente:BCRA', {
    //   tipo: 'consulta_fuente:BCRA',
    //   persona_id: solicitud.cliente.persona.id,
    //   solicitud_id: id,
    //   cuit: '20123456789',
    // });

    return { message: 'Evaluación iniciada exitosamente (modo desarrollo)' };
  }
}
