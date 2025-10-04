import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PrestamosService } from './prestamos.service';

@ApiTags('Préstamos')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('prestamos')
export class PrestamosController {
  constructor(private readonly prestamosService: PrestamosService) {}

  @Get()
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener todos los préstamos' })
  @ApiResponse({ status: 200, description: 'Lista de préstamos obtenida exitosamente' })
  findAll() {
    return this.prestamosService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener un préstamo por ID' })
  @ApiResponse({ status: 200, description: 'Préstamo encontrado' })
  @ApiResponse({ status: 404, description: 'Préstamo no encontrado' })
  findOne(@Param('id') id: string) {
    return this.prestamosService.findOne(id);
  }
}
