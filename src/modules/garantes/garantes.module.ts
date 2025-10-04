import { Module } from '@nestjs/common';

import { GarantesController } from './garantes.controller';
import { GarantesService } from './garantes.service';

@Module({
  controllers: [GarantesController],
  providers: [GarantesService],
  exports: [GarantesService],
})
export class GarantesModule {}
