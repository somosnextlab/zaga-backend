import { Module } from '@nestjs/common';
import { OfferEngineController } from './offer-engine.controller';
import { OfferEngineService } from './offer-engine.service';

@Module({
  controllers: [OfferEngineController],
  providers: [OfferEngineService],
  exports: [OfferEngineService],
})
export class OfferEngineModule {}
