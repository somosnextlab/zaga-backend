import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { ApiInfo } from './app.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Información de la API' })
  @ApiResponse({
    status: 200,
    description: 'Información básica y enlace a documentación',
  })
  getApiInfo(): ApiInfo {
    return this.appService.getApiInfo();
  }
}
