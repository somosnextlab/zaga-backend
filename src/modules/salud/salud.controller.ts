import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('salud')
@Controller('salud')
export class SaludController {
  @Get()
  @ApiOperation({
    summary: 'Verificar estado del sistema',
    description:
      'Endpoint para verificar que el sistema esté funcionando correctamente',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema funcionando correctamente',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  getSalud() {
    return {
      ok: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
