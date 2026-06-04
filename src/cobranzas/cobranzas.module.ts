import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { CobranzasBackofficeController } from './cobranzas-backoffice.controller';
import { CobranzasBackofficeService } from './cobranzas-backoffice.service';
import { CobranzasInternalController } from './cobranzas-internal.controller';
import { LoansCobranzasController } from './loans-cobranzas.controller';
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
  controllers: [
    CobranzasBackofficeController,
    CobranzasInternalController,
    LoansCobranzasController,
  ],
  providers: [
    CuotasRepository,
    PagosRepository,
    CompromisoPagoRepository,
    HistorialCobranzaRepository,
    CuotasService,
    MoraService,
    PagosService,
    HistorialCobranzaService,
    CobranzasBackofficeService,
  ],
  exports: [CuotasService, MoraService, HistorialCobranzaService],
})
export class CobranzasModule {}
