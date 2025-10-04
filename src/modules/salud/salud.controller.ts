import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse,ApiTags } from '@nestjs/swagger';

@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  @Get()
  @ApiOperation({ summary: 'Verificar estado de la aplicación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado de la aplicación',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        version: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  })
  getSalud() {
    return {
      ok: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
