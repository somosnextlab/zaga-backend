import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ConsentsModule } from './consents/consents.module';
import { PrequalModule } from './prequal/prequal.module';
import { OfferEngineModule } from './offerEngine/offer-engine.module';
import { ConfigModule } from '@nestjs/config';
import { ContractsModule } from './contracts/contracts.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CaseGuarantorsModule } from './case-guarantors/case-guarantors.module';

@Module({
  imports: [
    DbModule,
    ConsentsModule,
    PrequalModule,
    OfferEngineModule,
    ContractsModule,
    CaseGuarantorsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
