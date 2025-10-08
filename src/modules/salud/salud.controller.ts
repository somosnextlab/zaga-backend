import { Controller, Get } from '@nestjs/common';

@Controller('salud')
export class SaludController {
  @Get()
  getSalud() {
    return {
      ok: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
