import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ConsentsModule } from './consents/consents.module';
import { PrequalModule } from './prequal/prequal.module';
import { ConfigModule } from '@nestjs/config';
import { ContractsModule } from './contracts/contracts.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CasesModule } from './cases/cases.module';

@Module({
  imports: [
    DbModule,
    ConsentsModule,
    PrequalModule,
    ContractsModule,
    CasesModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
