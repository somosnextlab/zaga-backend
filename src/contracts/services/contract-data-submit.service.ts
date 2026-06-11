import { Injectable, Logger } from '@nestjs/common';
import { DbClient, DbService } from '../../db/db.service';
import { ContractsService } from '../contracts.service';
import { BankAccountsRepository } from '../repositories/bank-accounts.repository';
import { ContractDataRepository } from '../repositories/contract-data.repository';
import { ContractDataTokensRepository } from '../repositories/contract-data-tokens.repository';
import { RefDataRepository } from '../repositories/ref-data.repository';
import {
  ContractDataBusinessError,
  SaveCodeudorContractDataInput,
  SaveContractDataInput,
  SaveTitularContractDataInput,
  SubmitContractDataResult,
} from '../interfaces/contract-data.interface';
import { ContractDataErrors } from '../utils/contract-data.errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CBU_CVU_REGEX = /^\d{22}$/;
const ALIAS_REGEX = /^[a-zA-Z0-9.-]{6,20}$/;

@Injectable()
export class ContractDataSubmitService {
  private readonly logger = new Logger(ContractDataSubmitService.name);

  public constructor(
    private readonly dbService: DbService,
    private readonly contractDataRepository: ContractDataRepository,
    private readonly tokensRepository: ContractDataTokensRepository,
    private readonly bankAccountsRepository: BankAccountsRepository,
    private readonly refDataRepository: RefDataRepository,
    private readonly contractsService: ContractsService,
  ) {}

  public async submitContractData(
    input: SaveContractDataInput,
  ): Promise<SubmitContractDataResult> {
    const result = await this.dbService.withTransaction(
      async (client: DbClient): Promise<SubmitContractDataResult> => {
        const caseRow =
          await this.contractDataRepository.findCaseForContractDataForUpdate(
            client,
            input.caseId,
          );
        if (!caseRow || caseRow.status !== 'PENDING_CONTRACT_DATA') {
          return this.businessError(ContractDataErrors.CASE_STATUS_INVALID);
        }

        const token = await this.tokensRepository.findValidToken(
          client,
          input.token,
          input.subject,
        );
        if (!token) {
          return this.businessError(ContractDataErrors.TOKEN_NOT_FOUND);
        }
        if (token.case_id !== input.caseId) {
          return this.businessError(ContractDataErrors.TOKEN_SUBJECT_MISMATCH);
        }
        if (token.status === 'USED') {
          return this.businessError(ContractDataErrors.TOKEN_ALREADY_USED);
        }
        if (token.status === 'EXPIRED' || token.expires_at < new Date()) {
          return this.businessError(ContractDataErrors.TOKEN_EXPIRED);
        }

        const subjectOutcome =
          input.subject === 'TITULAR'
            ? await this.applyTitular(client, caseRow.user_id, input)
            : await this.applyCodeudor(client, input);
        if (subjectOutcome) {
          return subjectOutcome;
        }

        await this.tokensRepository.markTokenUsed(client, input.token);
        const counts = await this.tokensRepository.countUsedTokensByCaseId(
          client,
          input.caseId,
        );
        const completed = counts.total > 0 && counts.used === counts.total;
        if (completed) {
          await this.contractDataRepository.setCaseContractDataCompleted(
            client,
            input.caseId,
          );
        }

        return {
          ok: true,
          case_id: input.caseId,
          subject: input.subject,
          data_collection_completed: completed,
        };
      },
    );

    // startCaseContract abre sus propias transacciones y consume la API del
    // proveedor; se invoca fuera de la transacción para que vea el estado ya
    // commiteado (CONTRACT_DATA_COMPLETED) y no quede acoplado al rollback.
    if (result.ok && result.data_collection_completed) {
      await this.contractsService.startCaseContract(result.case_id);
    }

    return result;
  }

  /**
   * Devuelve un error de negocio si la validación falla; `null` si todo ok.
   */
  private async applyTitular(
    client: DbClient,
    userId: string,
    input: SaveTitularContractDataInput,
  ): Promise<ContractDataBusinessError | null> {
    if (!EMAIL_REGEX.test(input.email)) {
      return this.businessError(ContractDataErrors.INVALID_EMAIL_FORMAT);
    }
    if (!CBU_CVU_REGEX.test(input.cbu_cvu)) {
      return this.businessError(ContractDataErrors.INVALID_CBU_CVU_FORMAT);
    }
    if (
      input.alias !== undefined &&
      input.alias !== '' &&
      !ALIAS_REGEX.test(input.alias)
    ) {
      return this.businessError(ContractDataErrors.INVALID_ALIAS_FORMAT);
    }

    const localidadOk =
      await this.refDataRepository.localidadExistsForProvincia(
        client,
        input.domicilio_localidad,
        input.domicilio_provincia,
      );
    if (!localidadOk) {
      return this.businessError(ContractDataErrors.LOCALIDAD_NOT_FOUND);
    }

    await this.contractDataRepository.updateUserContractData(client, {
      userId,
      email: input.email,
      domicilioCalle: input.domicilio_calle,
      domicilioNumero: input.domicilio_numero,
      domicilioPiso: input.domicilio_piso ?? null,
      domicilioDepto: input.domicilio_depto ?? null,
      domicilioLocalidad: input.domicilio_localidad,
      domicilioProvincia: input.domicilio_provincia,
      domicilioCp: input.domicilio_cp,
    });

    const bankAccountId = await this.bankAccountsRepository.upsertBankAccount(
      client,
      {
        userId,
        accountKind: input.account_kind,
        cbuCvu: input.cbu_cvu,
        alias: input.alias ?? null,
        bankName: input.bank_name,
      },
    );
    await this.bankAccountsRepository.setBankAccountForDisbursement(
      client,
      input.caseId,
      bankAccountId,
    );

    return null;
  }

  private async applyCodeudor(
    client: DbClient,
    input: SaveCodeudorContractDataInput,
  ): Promise<ContractDataBusinessError | null> {
    if (!EMAIL_REGEX.test(input.email)) {
      return this.businessError(ContractDataErrors.INVALID_EMAIL_FORMAT);
    }

    const guarantor =
      await this.contractDataRepository.findActiveGuarantorByCaseId(
        client,
        input.caseId,
      );
    if (!guarantor) {
      return this.businessError(ContractDataErrors.GUARANTOR_NOT_FOUND);
    }

    const localidadOk =
      await this.refDataRepository.localidadExistsForProvincia(
        client,
        input.domicilio_localidad,
        input.domicilio_provincia,
      );
    if (!localidadOk) {
      return this.businessError(ContractDataErrors.LOCALIDAD_NOT_FOUND);
    }

    await this.contractDataRepository.updateGuarantorContractData(client, {
      guarantorId: guarantor.id,
      firstName: input.first_name,
      lastName: input.last_name,
      dni: input.dni,
      email: input.email,
      phone: input.phone ?? null,
      domicilioCalle: input.domicilio_calle,
      domicilioNumero: input.domicilio_numero,
      domicilioPiso: input.domicilio_piso ?? null,
      domicilioDepto: input.domicilio_depto ?? null,
      domicilioLocalidad: input.domicilio_localidad,
      domicilioProvincia: input.domicilio_provincia,
      domicilioCp: input.domicilio_cp,
      followUpLevel: input.follow_up_level,
    });

    return null;
  }

  private businessError(errorCode: string): ContractDataBusinessError {
    return { ok: false, error_type: 'BUSINESS', error_code: errorCode };
  }
}
