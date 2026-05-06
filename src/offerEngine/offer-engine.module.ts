import { Module } from '@nestjs/common';
import { OfferEngineService } from './offer-engine.service';

@Module({
  providers: [OfferEngineService],
  exports: [OfferEngineService],
})
export class OfferEngineModule {}
