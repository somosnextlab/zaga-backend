import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { ContractDataController } from './contract-data.controller';
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
import { BankAccountsRepository } from './repositories/bank-accounts.repository';
import { ContractDataRepository } from './repositories/contract-data.repository';
import { ContractDataTokensRepository } from './repositories/contract-data-tokens.repository';
import { RefDataRepository } from './repositories/ref-data.repository';
import { ContractDataInitiateService } from './services/contract-data-initiate.service';
import { ContractDataSubmitService } from './services/contract-data-submit.service';
@Module({
  imports: [ZagaAuthModule],
  controllers: [
    ContractsCasesController,
    SignaturaWebhookController,
    ContractsBackofficeController,
    ContractDataController,
  ],
  providers: [
    ContractsService,
    ContractsBackofficeService,
    ContractsRepository,
    SignaturaService,
    ContractPdfService,
    ContractsExpirationService,
    PostSignatureWebhookService,
    ContractDataTokensRepository,
    BankAccountsRepository,
    ContractDataRepository,
    RefDataRepository,
    ContractDataInitiateService,
    ContractDataSubmitService,
  ],
  exports: [ContractsService, ContractsExpirationService],
})
export class ContractsModule {}
