import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluacionesService } from './evaluaciones.service';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { RolesGuard } from '@config/roles.guard';
import { Roles } from '@config/roles.decorator';

@ApiTags('Evaluaciones')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Get()
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener todas las evaluaciones' })
  @ApiResponse({ status: 200, description: 'Lista de evaluaciones obtenida exitosamente' })
  findAll() {
    return this.evaluacionesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener una evaluación por ID' })
  @ApiResponse({ status: 200, description: 'Evaluación encontrada' })
  @ApiResponse({ status: 404, description: 'Evaluación no encontrada' })
  findOne(@Param('id') id: string) {
    return this.evaluacionesService.findOne(id);
  }
}
