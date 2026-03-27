import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractsRepository } from '../contracts.repository';
import { SignProvider } from '../enums/sign-provider.enum';
import { SignaturaService } from '../providers/signatura.service';

type ExpiredContractForRemoteCancel = {
  readonly id: string;
  readonly provider: string;
  readonly external_document_id: string | null;
};

@Injectable()
export class ContractsExpirationService {
  private readonly logger = new Logger(ContractsExpirationService.name);
  private readonly isCronEnabled: boolean;
  private readonly isRemoteCancelEnabled: boolean;

  public constructor(
    private readonly contractsRepository: ContractsRepository,
    private readonly configService: ConfigService,
    private readonly signaturaService: SignaturaService,
  ) {
    this.isCronEnabled =
      this.configService.get<string>('CONTRACTS_EXPIRATION_CRON_ENABLED') !==
      'false';
    this.isRemoteCancelEnabled =
      this.configService.get<string>(
        'CONTRACTS_EXPIRATION_REMOTE_CANCEL_ENABLED',
      ) !== 'false';
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  public async handleContractsExpirationCron(): Promise<void> {
    if (!this.isCronEnabled) {
      return;
    }

    try {
      await this.expirePendingContracts();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al ejecutar expiración automática de contratos: ${message}`,
      );
    }
  }

  public async expirePendingContracts(): Promise<{ expiredCount: number }> {
    const expiredContractsResult =
      await this.contractsRepository.expirePendingContracts();
    const expiredContracts = this.normalizeExpiredContracts(
      expiredContractsResult,
    );
    const expiredCount = expiredContracts.length;

    if (expiredCount > 0) {
      this.logger.warn(`Se cancelaron ${expiredCount} contratos vencidos.`);

      if (this.isRemoteCancelEnabled) {
        await this.cancelExpiredDocumentsRemotely(expiredContracts);
      }
    }

    return { expiredCount };
  }

  private async cancelExpiredDocumentsRemotely(
    expiredContracts: readonly ExpiredContractForRemoteCancel[],
  ): Promise<void> {
    const signaturaContracts = expiredContracts.filter(
      (contract) =>
        contract.provider === (SignProvider.SIGNATURA as string) &&
        !!contract.external_document_id,
    );

    let remoteCanceled = 0;
    let remoteErrors = 0;

    for (const contract of signaturaContracts) {
      const externalDocumentId = contract.external_document_id;
      if (!externalDocumentId) {
        continue;
      }

      try {
        await this.signaturaService.cancelDocument(externalDocumentId);
        remoteCanceled += 1;
      } catch (error) {
        remoteErrors += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `No se pudo cancelar remoto contrato ${contract.id}: ${message}`,
        );
      }
    }

    if (signaturaContracts.length > 0) {
      this.logger.log(
        `Cancelación remota de vencidos: ok=${remoteCanceled}, error=${remoteErrors}.`,
      );
    }
  }

  private normalizeExpiredContracts(
    input: unknown,
  ): readonly ExpiredContractForRemoteCancel[] {
    if (!Array.isArray(input)) {
      return [];
    }

    const normalizedContracts: ExpiredContractForRemoteCancel[] = [];
    for (const contract of input) {
      if (this.isExpiredCaseContractRow(contract)) {
        normalizedContracts.push(contract);
      }
    }

    return normalizedContracts;
  }

  private isExpiredCaseContractRow(
    value: unknown,
  ): value is ExpiredContractForRemoteCancel {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;
    const hasValidId = typeof record.id === 'string' && record.id.length > 0;
    const hasValidProvider =
      typeof record.provider === 'string' && record.provider.length > 0;
    const hasValidExternalDocumentId =
      record.external_document_id === null ||
      typeof record.external_document_id === 'string';

    return hasValidId && hasValidProvider && hasValidExternalDocumentId;
  }
}
