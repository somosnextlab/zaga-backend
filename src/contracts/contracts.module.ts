import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { ContractsExpirationService } from './jobs/contracts-expiration.service';
import { SignaturaService } from './providers/signatura.service';
import { ContractPdfService } from './templates/contract-pdf.service';

@Module({
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractsRepository,
    SignaturaService,
    ContractPdfService,
    ContractsExpirationService,
  ],
  exports: [ContractsService, ContractsExpirationService],
})
export class ContractsModule {}
