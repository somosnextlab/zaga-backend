import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MoraService } from './mora.service';
import { PagosService } from './pagos.service';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';

@ApiTags('Cobranzas — n8n')
@Controller('loans')
export class LoansCobranzasController {
  public constructor(
    private readonly moraService: MoraService,
    private readonly pagosService: PagosService,
  ) {}

  @Get(':loanId/saldo-actualizado')
  @ApiOperation({
    summary: 'Saldo actualizado con mora',
    description:
      'Devuelve capital vencido, mora e IVA mora al día de hoy. Aplica bonificación D+1/D+2 si es antes de las 17:00 AR.',
  })
  @ApiParam({ name: 'loanId', description: 'UUID del préstamo' })
  public getSaldoActualizado(@Param('loanId') loanId: string) {
    return this.moraService.calcularSaldoActualizado(loanId);
  }

  @Post(':loanId/pagos')
  @ApiOperation({
    summary: 'Registrar comprobante de pago (n8n)',
    description:
      'Registra un pago/comprobante recibido desde el flujo WhatsApp (n8n). Estado inicial: recibido. registrado_por se fija como sistema_automatico.',
  })
  @ApiParam({ name: 'loanId', description: 'UUID del préstamo' })
  public registrarPago(
    @Param('loanId') loanId: string,
    @Body() dto: RegistrarPagoDto,
  ) {
    return this.pagosService.registrar(loanId, dto, 'sistema_automatico');
  }
}
