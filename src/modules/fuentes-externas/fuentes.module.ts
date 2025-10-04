import { Module } from '@nestjs/common';

import { AfipAdapter } from './adapters/afip.adapter';
import { BcraAdapter } from './adapters/bcra.adapter';
import { BcraController } from './bcra.controller';
import { FuentesExternasController } from './fuentes-externas.controller';
import { FuentesExternasService } from './fuentes-externas.service';

@Module({
  controllers: [FuentesExternasController, BcraController],
  providers: [FuentesExternasService, BcraAdapter, AfipAdapter],
  exports: [FuentesExternasService, BcraAdapter, AfipAdapter],
})
export class FuentesExternasModule {}
