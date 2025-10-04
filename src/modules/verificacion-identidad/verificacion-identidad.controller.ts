import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VerificacionIdentidadService } from './verificacion-identidad.service';
import { UploadDocumentoDto } from './dtos/upload-documento.dto';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { RolesGuard } from '@config/roles.guard';
import { Roles } from '@config/roles.decorator';

@ApiTags('Verificación de Identidad')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('verificacion-identidad')
export class VerificacionIdentidadController {
  constructor(private readonly verificacionIdentidadService: VerificacionIdentidadService) {}

  @Post(':personaId/documentos')
  @Roles('admin', 'analista', 'cliente')
  @ApiOperation({ summary: 'Subir documento de identidad' })
  @ApiResponse({ status: 201, description: 'Documento subido exitosamente' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  uploadDocumento(@Param('personaId') personaId: string, @Body() uploadDocumentoDto: UploadDocumentoDto) {
    return this.verificacionIdentidadService.uploadDocumento(personaId, uploadDocumentoDto);
  }

  @Get(':personaId/documentos')
  @Roles('admin', 'analista', 'cobranzas', 'cliente')
  @ApiOperation({ summary: 'Obtener documentos de identidad de una persona' })
  @ApiResponse({ status: 200, description: 'Lista de documentos obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  getDocumentos(@Param('personaId') personaId: string) {
    return this.verificacionIdentidadService.getDocumentos(personaId);
  }
}
