import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { CasesModule } from './cases/cases.module';
import { CobranzasModule } from './cobranzas/cobranzas.module';
import { ConsentsModule } from './consents/consents.module';
import { ContractsModule } from './contracts/contracts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DbModule } from './db/db.module';
import { LeadsModule } from './leads/leads.module';
import { LoansModule } from './loans/loans.module';
import { PrequalModule } from './prequal/prequal.module';
import { UsersModule } from './users/users.module';
import { ZagaAuthModule } from './zaga-auth/zaga-auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    DbModule,
    ConsentsModule,
    PrequalModule,
    ContractsModule,
    CasesModule,
    ZagaAuthModule,
    AuditModule,
    DashboardModule,
    LeadsModule,
    UsersModule,
    LoansModule,
    CobranzasModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
