import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CuotasService } from './cuotas.service';

@ApiTags('Cobranzas — n8n')
@Controller('cobranzas/internal')
export class CobranzasInternalController {
  public constructor(private readonly cuotasService: CuotasService) {}

  @Post('marcar-vencidas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Internal] Marcar cuotas vencidas',
    description:
      'Actualiza a estado vencida todas las cuotas con estado pendiente y fecha_vencimiento < hoy. Llamado por el workflow n8n.',
  })
  public marcarVencidas() {
    return this.cuotasService.marcarVencidas();
  }
}
