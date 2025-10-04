import { Module } from '@nestjs/common';
import { FuentesExternasController } from './fuentes-externas.controller';
import { FuentesExternasService } from './fuentes-externas.service';
import { BcraController } from './bcra.controller';
import { BcraAdapter } from './adapters/bcra.adapter';
import { AfipAdapter } from './adapters/afip.adapter';

@Module({
  controllers: [FuentesExternasController, BcraController],
  providers: [FuentesExternasService, BcraAdapter, AfipAdapter],
  exports: [FuentesExternasService, BcraAdapter, AfipAdapter],
})
export class FuentesExternasModule {}
