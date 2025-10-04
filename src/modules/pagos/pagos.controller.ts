import { Roles } from '@config/roles.decorator';
import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PagosService } from './pagos.service';

@ApiTags('Pagos')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener todos los pagos' })
  @ApiResponse({ status: 200, description: 'Lista de pagos obtenida exitosamente' })
  findAll() {
    return this.pagosService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener un pago por ID' })
  @ApiResponse({ status: 200, description: 'Pago encontrado' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  findOne(@Param('id') id: string) {
    return this.pagosService.findOne(id);
  }
}
