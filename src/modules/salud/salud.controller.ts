import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  @Get()
  @ApiOperation({ summary: 'Health check del sistema' })
  @ApiResponse({
    status: 200,
    description: 'Sistema funcionando correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-01-15T10:30:00.000Z' },
        uptime: { type: 'number', example: 123.45 },
        environment: { type: 'string', example: 'development' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
