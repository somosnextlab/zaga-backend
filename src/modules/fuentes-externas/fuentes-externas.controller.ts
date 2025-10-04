import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { FuentesExternasService } from './fuentes-externas.service';

@ApiTags('Fuentes Externas')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('fuentes-externas')
export class FuentesExternasController {
  constructor(private readonly fuentesExternasService: FuentesExternasService) {}

  @Get()
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Obtener todas las fuentes externas' })
  @ApiResponse({ status: 200, description: 'Lista de fuentes externas obtenida exitosamente' })
  findAll() {
    return this.fuentesExternasService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Obtener una fuente externa por ID' })
  @ApiResponse({ status: 200, description: 'Fuente externa encontrada' })
  @ApiResponse({ status: 404, description: 'Fuente externa no encontrada' })
  findOne(@Param('id') id: string) {
    return this.fuentesExternasService.findOne(id);
  }
}
