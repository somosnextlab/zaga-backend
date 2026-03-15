import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RunPrequalDto } from './dto/run-prequal.dto';
import type { PrequalErrorResponse, PrequalResponse } from './prequal.types';
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
    description: 'Precalificación ejecutada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Input inválido (ej. CUIT mal formado)',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado o BCRA sin datos para el CUIT',
  })
  @ApiResponse({
    status: 422,
    description: 'Payload BCRA inválido o inesperado',
  })
  @ApiResponse({
    status: 502,
    description: 'BCRA no disponible (timeout, 5xx, error de red)',
  })
  public async runPrequal(
    @Body() body: RunPrequalDto,
  ): Promise<PrequalResponse> {
    const result = await this.prequalService.runPrequal({
      userId: body.userId,
      phone: body.phone,
      cuit: body.cuit,
    });

    if (!result.ok) {
      const status = this.mapErrorToStatus(result);
      throw new HttpException(result, status);
    }

    return result;
  }

  private mapErrorToStatus(result: PrequalErrorResponse): number {
    if (result.error_type === 'TECHNICAL') {
      return HttpStatus.BAD_GATEWAY;
    }
    switch (result.error_code) {
      case 'INVALID_INPUT':
        return HttpStatus.BAD_REQUEST;
      case 'USER_NOT_FOUND':
      case 'BCRA_NO_DATA':
        return HttpStatus.NOT_FOUND;
      case 'BCRA_INVALID_PAYLOAD':
        return HttpStatus.UNPROCESSABLE_ENTITY;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
