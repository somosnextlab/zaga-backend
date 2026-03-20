import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RunPrequalDto } from './dto/run-prequal.dto';
import type { PrequalResponse } from './prequal.types';
import { PrequalService } from './prequal.service';

@ApiTags('Prequal')
@Controller('internal/prequal')
export class PrequalController {
  public constructor(private readonly prequalService: PrequalService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ejecutar precalificación' })
  @ApiResponse({
    status: 200,
    description:
      'Precalificación ejecutada. Incluye éxito (ok: true) o outcomes manejados (ok: false con error_code: BCRA_NO_DATA, BCRA_UNAVAILABLE, INVALID_INPUT, BCRA_INVALID_PAYLOAD, USER_NOT_FOUND).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validación DTO fallida (ej. campos requeridos faltantes, formato inválido)',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno inesperado no manejado',
  })
  public async runPrequal(
    @Body() body: RunPrequalDto,
  ): Promise<PrequalResponse> {
    return this.prequalService.runPrequal({
      userId: body.userId,
      phone: body.phone,
      cuit: body.cuit,
    });
  }
}
