import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RunPrequalDto } from './dto/run-prequal.dto';
import type { PrequalResponse } from './prequal.types';
import { PrequalService } from './prequal.service';

@ApiTags('Prequal')
@Controller('internal/prequal')
export class PrequalController {
  public constructor(private readonly prequalService: PrequalService) {}

  @Post('run')
  @ApiOperation({ summary: 'Ejecutar precalificación' })
  @ApiResponse({
    status: 201,
    description: 'Precalificación ejecutada correctamente',
  })
  @ApiResponse({ status: 400, description: 'Error de validación o negocio' })
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
