import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { ContractsBackofficeController } from './contracts-backoffice.controller';
import { ContractsBackofficeService } from './contracts-backoffice.service';
import { ContractsCasesController } from './contracts-cases.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { ContractsExpirationService } from './jobs/contracts-expiration.service';
import { PostSignatureWebhookService } from './post-signature-webhook.service';
import { SignaturaService } from './providers/signatura.service';
import { SignaturaWebhookController } from './signatura-webhook.controller';
import { ContractPdfService } from './templates/contract-pdf.service';

@Module({
  imports: [ZagaAuthModule],
  controllers: [
    ContractsCasesController,
    SignaturaWebhookController,
    ContractsBackofficeController,
  ],
  providers: [
    ContractsService,
    ContractsBackofficeService,
    ContractsRepository,
    SignaturaService,
    ContractPdfService,
    ContractsExpirationService,
    PostSignatureWebhookService,
  ],
  exports: [ContractsService, ContractsExpirationService],
})
export class ContractsModule {}
