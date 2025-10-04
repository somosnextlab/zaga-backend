import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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
    // @Inject('evaluacion') private evaluacionQueue: Queue,
  ) {}

  @Post()
  @Roles('admin', 'analista', 'cliente')
  @ApiOperation({ summary: 'Crear una nueva solicitud de préstamo' })
  @ApiResponse({ status: 201, description: 'Solicitud creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() createSolicitudDto: CreateSolicitudDto) {
    return this.solicitudesService.create(createSolicitudDto);
  }

  @Get()
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener todas las solicitudes' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes obtenida exitosamente' })
  findAll() {
    return this.solicitudesService.findAll();
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
