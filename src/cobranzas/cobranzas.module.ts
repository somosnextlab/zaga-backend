import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { CobranzasBackofficeController } from './cobranzas-backoffice.controller';
import { CuotasService } from './cuotas.service';
import { HistorialCobranzaService } from './historial-cobranza.service';
import { MoraService } from './mora.service';
import { PagosService } from './pagos.service';
import { CompromisoPagoRepository } from './repositories/compromisos-pago.repository';
import { CuotasRepository } from './repositories/cuotas.repository';
import { HistorialCobranzaRepository } from './repositories/historial-cobranza.repository';
import { PagosRepository } from './repositories/pagos.repository';

@Module({
  imports: [ZagaAuthModule],
  controllers: [CobranzasBackofficeController],
  providers: [
    CuotasRepository,
    PagosRepository,
    CompromisoPagoRepository,
    HistorialCobranzaRepository,
    CuotasService,
    MoraService,
    PagosService,
    HistorialCobranzaService,
  ],
  exports: [CuotasService, HistorialCobranzaService],
})
export class CobranzasModule {}
