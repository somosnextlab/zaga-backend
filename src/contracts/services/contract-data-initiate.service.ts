import { Injectable, NotFoundException } from '@nestjs/common';
import { DbClient, DbService } from '../../db/db.service';
import { ContractDataRepository } from '../repositories/contract-data.repository';
import { ContractDataTokensRepository } from '../repositories/contract-data-tokens.repository';
import {
  ContractDataSubject,
  ContractDataTokenResult,
  InitiateDataCollectionResult,
} from '../interfaces/contract-data.interface';
import { ContractDataErrors } from '../utils/contract-data.errors';

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

@Injectable()
export class ContractDataInitiateService {
  public constructor(
    private readonly dbService: DbService,
    private readonly contractDataRepository: ContractDataRepository,
    private readonly tokensRepository: ContractDataTokensRepository,
  ) {}

  public async initiateDataCollection(
    caseId: string,
  ): Promise<InitiateDataCollectionResult> {
    return this.dbService.withTransaction(
      async (client: DbClient): Promise<InitiateDataCollectionResult> => {
        const caseRow =
          await this.contractDataRepository.findCaseForContractDataForUpdate(
            client,
            caseId,
          );
        if (!caseRow) {
          throw new NotFoundException(ContractDataErrors.CASE_NOT_FOUND);
        }

        if (
          caseRow.status !== 'APROBADO_FINAL' &&
          caseRow.status !== 'PENDING_CONTRACT_DATA'
        ) {
          return {
            ok: false,
            error_type: 'BUSINESS',
            error_code: ContractDataErrors.CASE_STATUS_INVALID,
          };
        }

        const expectedSubjects = await this.resolveExpectedSubjects(
          client,
          caseId,
          caseRow.requires_guarantor,
        );

        const now = new Date();
        const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

        if (caseRow.status === 'APROBADO_FINAL') {
          const created = await this.tokensRepository.insertTokens(
            client,
            expectedSubjects.map((subject) => ({ caseId, subject, expiresAt })),
          );
          await this.contractDataRepository.setCasePendingContractData(
            client,
            caseId,
          );
          return {
            ok: true,
            case_id: caseId,
            tokens: created.map((token) => ({
              subject: token.subject,
              token: token.token,
              expires_at: token.expires_at,
            })),
          };
        }

        // status === 'PENDING_CONTRACT_DATA' (idempotente, renovación por sujeto)
        const pending = await this.tokensRepository.findPendingTokensByCaseId(
          client,
          caseId,
        );
        const usedSubjects =
          await this.tokensRepository.findUsedSubjectsByCaseId(client, caseId);

        const validTokens: ContractDataTokenResult[] = [];
        const subjectsToCreate: ContractDataSubject[] = [];

        for (const subject of expectedSubjects) {
          const existing = pending.find((token) => token.subject === subject);
          if (existing && existing.expires_at > now) {
            validTokens.push({
              subject,
              token: existing.token,
              expires_at: existing.expires_at,
            });
          } else if (existing) {
            await this.tokensRepository.expireTokenBySubject(
              client,
              caseId,
              subject,
            );
            subjectsToCreate.push(subject);
          } else if (!usedSubjects.includes(subject)) {
            // Sin token pendiente y sin token ya consumido: hay que crearlo.
            subjectsToCreate.push(subject);
          }
        }

        let createdTokens: ContractDataTokenResult[] = [];
        if (subjectsToCreate.length > 0) {
          const created = await this.tokensRepository.insertTokens(
            client,
            subjectsToCreate.map((subject) => ({ caseId, subject, expiresAt })),
          );
          createdTokens = created.map((token) => ({
            subject: token.subject,
            token: token.token,
            expires_at: token.expires_at,
          }));
        }

        return {
          ok: true,
          case_id: caseId,
          tokens: [...validTokens, ...createdTokens],
        };
      },
    );
  }

  private async resolveExpectedSubjects(
    client: DbClient,
    caseId: string,
    requiresGuarantor: boolean,
  ): Promise<ContractDataSubject[]> {
    const subjects: ContractDataSubject[] = ['TITULAR'];
    if (requiresGuarantor) {
      const guarantor =
        await this.contractDataRepository.findActiveGuarantorByCaseId(
          client,
          caseId,
        );
      if (guarantor) {
        subjects.push('CODEUDOR');
      }
    }
    return subjects;
  }
}
