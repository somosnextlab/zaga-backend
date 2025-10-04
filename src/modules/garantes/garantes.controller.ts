import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GarantesService } from './garantes.service';
import { CreateGaranteDto } from './dtos/create-garante.dto';
import { UpdateGaranteDto } from './dtos/update-garante.dto';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { RolesGuard } from '@config/roles.guard';
import { Roles } from '@config/roles.decorator';

@ApiTags('Garantes')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('garantes')
export class GarantesController {
  constructor(private readonly garantesService: GarantesService) {}

  @Post()
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Crear un nuevo garante' })
  @ApiResponse({ status: 201, description: 'Garante creado exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  create(@Body() createGaranteDto: CreateGaranteDto) {
    return this.garantesService.create(createGaranteDto);
  }

  @Get()
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener todos los garantes' })
  @ApiResponse({ status: 200, description: 'Lista de garantes obtenida exitosamente' })
  findAll() {
    return this.garantesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'analista', 'cobranzas')
  @ApiOperation({ summary: 'Obtener un garante por ID' })
  @ApiResponse({ status: 200, description: 'Garante encontrado' })
  @ApiResponse({ status: 404, description: 'Garante no encontrado' })
  findOne(@Param('id') id: string) {
    return this.garantesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'analista')
  @ApiOperation({ summary: 'Actualizar un garante' })
  @ApiResponse({ status: 200, description: 'Garante actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Garante no encontrado' })
  update(@Param('id') id: string, @Body() updateGaranteDto: UpdateGaranteDto) {
    return this.garantesService.update(id, updateGaranteDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar un garante' })
  @ApiResponse({ status: 200, description: 'Garante eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Garante no encontrado' })
  remove(@Param('id') id: string) {
    return this.garantesService.remove(id);
  }
}
