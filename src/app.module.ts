import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ConsentsModule } from './consents/consents.module';
import { PrequalModule } from './prequal/prequal.module';
import { OfferEngineModule } from './offerEngine/offer-engine.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DbModule,
    ConsentsModule,
    PrequalModule,
    OfferEngineModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
