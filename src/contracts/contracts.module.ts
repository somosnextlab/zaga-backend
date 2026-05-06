import { Module } from '@nestjs/common';
import { ContractsCasesController } from './contracts-cases.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { ContractsExpirationService } from './jobs/contracts-expiration.service';
import { PostSignatureWebhookService } from './post-signature-webhook.service';
import { SignaturaService } from './providers/signatura.service';
import { SignaturaWebhookController } from './signatura-webhook.controller';
import { ContractPdfService } from './templates/contract-pdf.service';

@Module({
  controllers: [ContractsCasesController, SignaturaWebhookController],
  providers: [
    ContractsService,
    ContractsRepository,
    SignaturaService,
    ContractPdfService,
    ContractsExpirationService,
    PostSignatureWebhookService,
  ],
  exports: [ContractsService, ContractsExpirationService],
})
export class ContractsModule {}
