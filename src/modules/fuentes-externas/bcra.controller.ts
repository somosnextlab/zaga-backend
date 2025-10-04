import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BcraAdapter } from './adapters/bcra.adapter';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { RolesGuard } from '@config/roles.guard';
import { Roles } from '@config/roles.decorator';

@ApiTags('BCRA')
@ApiBearerAuth('JWT-auth')
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller('bcra')
export class BcraController {
  constructor(private readonly bcraAdapter: BcraAdapter) {}

  @Get(':personaId/situacion')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Consultar situación crediticia en BCRA' })
  @ApiResponse({ 
    status: 200, 
    description: 'Situación crediticia obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string' },
        mora: { type: 'boolean' },
        deuda_total: { type: 'number' },
        cuotas_vencidas: { type: 'number' },
        ultima_actualizacion: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes' })
  async getSituacion(@Param('personaId') personaId: string) {
    // En un caso real, aquí obtendrías el CUIT de la persona desde la base de datos
    // Por ahora usamos un CUIT de ejemplo
    const cuit = '20123456789'; // Esto debería venir de la base de datos
    return this.bcraAdapter.getSituacion(cuit);
  }
}
