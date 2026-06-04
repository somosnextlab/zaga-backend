import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { CurrentZagaUser } from '../zaga-auth/decorators/current-zaga-user.decorator';
import type { ZagaRequestUser } from '../zaga-auth/types/zaga-request.types';
import { PagosService } from './pagos.service';
import { ValidarPagoDto } from './dto/validar-pago.dto';
import { CobranzasBackofficeService } from './cobranzas-backoffice.service';

@ApiTags('Backoffice — Cobranzas')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/cobranzas')
export class CobranzasBackofficeController {
  public constructor(
    private readonly pagosService: PagosService,
    private readonly cobranzasBackofficeService: CobranzasBackofficeService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Cartera activa con buckets DPD',
    description:
      'Devuelve todos los préstamos desembolsados y no cancelados, clasificados por bucket DPD (al_dia, por_vencer, mora_inicial … referencia_regulatoria). DPD calculado sobre cuotas en DB; mora real disponible por préstamo vía GET /:loanId.',
  })
  public getCarteraActiva() {
    return this.cobranzasBackofficeService.getCarteraActiva();
  }

  @Get(':loanId')
  @ApiOperation({
    summary: 'Detalle CEO del préstamo',
    description:
      'Indicadores completos para gestión: mora actualizada, cuotas vencidas, comprobantes pendientes, compromisos, historial reciente y próxima acción sugerida.',
  })
  @ApiParam({ name: 'loanId', description: 'UUID del préstamo' })
  public getLoanDetail(@Param('loanId') loanId: string) {
    return this.cobranzasBackofficeService.getLoanDetail(loanId);
  }

  @Patch('pagos/:pagoId/validar')
  @ApiOperation({
    summary: 'Validar o rechazar comprobante (staff)',
    description:
      'Mueve el pago a estado validado, rechazado o dudoso. Solo pagos en estado recibido/pendiente_validacion/dudoso. Si resulta validado, dispara la imputación automática.',
  })
  @ApiParam({ name: 'pagoId', description: 'UUID del pago' })
  public validarPago(
    @Param('pagoId') pagoId: string,
    @Body() dto: ValidarPagoDto,
    @CurrentZagaUser() user: ZagaRequestUser,
  ) {
    return this.pagosService.validar(pagoId, dto, user.email);
  }

  @Post('pagos/:pagoId/imputar')
  @ApiOperation({
    summary: 'Imputar pago validado a cuotas (acción manual staff)',
    description:
      'Distribuye el pago a las cuotas en orden contractual: mora → IVA mora → interés → IVA interés → capital. El flujo normal dispara esto automáticamente desde validar(). Este endpoint es para reintento manual.',
  })
  @ApiParam({ name: 'pagoId', description: 'UUID del pago' })
  public imputarPago(
    @Param('pagoId') pagoId: string,
    @CurrentZagaUser() user: ZagaRequestUser,
  ) {
    return this.pagosService.imputar(pagoId, user.email);
  }
}
