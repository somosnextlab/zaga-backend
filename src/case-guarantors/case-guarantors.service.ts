import { Injectable } from '@nestjs/common';
import { DbService, type DbClient } from '../db/db.service';
import { BcraZcoreEngineService } from '../prequal/bcra-zcore-engine.service';
import { isValidCuitChecksum } from '../prequal/cuit-checksum';
import {
  ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION,
  CASE_GUARANTOR_ERRORS,
  CASE_GUARANTOR_EVALUATION_ENGINE,
  MAX_GUARANTOR_ATTEMPTS,
} from './case-guarantors.constants';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import type { EvaluateCaseGuarantorDto } from './dto/evaluate-case-guarantor.dto';
import type {
  CaseGuarantorCandidateStatus,
  CaseGuarantorTechnicalErrorCode,
  EvaluateCaseGuarantorBusinessErrorResponse,
  EvaluateCaseGuarantorResponse,
  EvaluateCaseGuarantorTechnicalErrorResponse,
} from './interfaces/case-guarantors.interface';

@Injectable()
export class CaseGuarantorsService {
  public constructor(
    private readonly dbService: DbService,
    private readonly caseGuarantorsRepository: CaseGuarantorsRepository,
    private readonly bcraZcoreEngineService: BcraZcoreEngineService,
  ) {}

  public async evaluateCaseGuarantor(
    dto: EvaluateCaseGuarantorDto,
  ): Promise<EvaluateCaseGuarantorResponse> {
    const normalizedCuit = this.bcraZcoreEngineService.normalizeCuit(dto.cuit);
    if (!normalizedCuit || !isValidCuitChecksum(normalizedCuit)) {
      return this.businessError(CASE_GUARANTOR_ERRORS.INVALID_GUARANTOR_CUIT);
    }

    return this.dbService.withTransaction(
      async (client: DbClient): Promise<EvaluateCaseGuarantorResponse> => {
        const caseRow =
          await this.caseGuarantorsRepository.findCaseByIdForUpdate(
            client,
            dto.caseId,
          );
        if (!caseRow) {
          return this.businessError(CASE_GUARANTOR_ERRORS.CASE_NOT_FOUND);
        }

        const normalizedApplicantCuit = caseRow.applicant_cuit
          ? this.bcraZcoreEngineService.normalizeCuit(caseRow.applicant_cuit)
          : null;
        if (
          normalizedApplicantCuit !== null &&
          normalizedApplicantCuit === normalizedCuit
        ) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.GUARANTOR_CUIT_MATCHES_APPLICANT_CUIT,
          );
        }

        if (!caseRow.requires_guarantor) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.CASE_NOT_REQUIRING_GUARANTOR,
          );
        }

        if (
          !ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION.some(
            (status) => status === caseRow.status,
          )
        ) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.CASE_NOT_READY_FOR_GUARANTOR_EVALUATION,
          );
        }

        const attempts =
          await this.caseGuarantorsRepository.findCaseGuarantorsByCaseIdForUpdate(
            client,
            dto.caseId,
          );
        if (attempts.length >= MAX_GUARANTOR_ATTEMPTS) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.MAX_GUARANTOR_ATTEMPTS_REACHED,
          );
        }

        const hasDuplicateCuit = attempts.some((attempt) => {
          return attempt.cuit === normalizedCuit;
        });
        if (hasDuplicateCuit) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.DUPLICATE_GUARANTOR_CUIT,
          );
        }

        const attemptNo = attempts.length + 1;
        const inserted =
          await this.caseGuarantorsRepository.insertEvaluatingCandidate(
            client,
            {
              caseId: dto.caseId,
              cuit: normalizedCuit,
              attemptNo,
            },
          );

        const evaluation =
          await this.bcraZcoreEngineService.evaluateNormalizedCuit(
            normalizedCuit,
          );

        if (!evaluation.ok && evaluation.error_type === 'TECHNICAL') {
          await this.caseGuarantorsRepository.deleteCandidateById(
            client,
            inserted.id,
          );
          const technicalCode = evaluation.error_code;
          if (
            technicalCode !== 'BCRA_UNAVAILABLE' &&
            technicalCode !== 'BCRA_INVALID_PAYLOAD'
          ) {
            throw new Error(
              `Case guarantors: código técnico inesperado: ${String(technicalCode)}`,
            );
          }
          return this.technicalError(technicalCode);
        }

        const eligible = evaluation.ok ? evaluation.score.eligible : false;
        const candidateStatus: Exclude<
          CaseGuarantorCandidateStatus,
          'EVALUATING'
        > = eligible ? 'APPROVED' : 'REJECTED';
        const zcoreBcra = evaluation.ok ? evaluation.score.zcore_bcra : 0;
        const riskLevel = evaluation.ok ? evaluation.score.risk_level : 'HIGH';
        const scoreReason = evaluation.ok
          ? evaluation.score.score_reason
          : evaluation.error_code;
        const periodo = evaluation.ok
          ? evaluation.normalized_latest.periodo
          : null;

        const persisted =
          await this.caseGuarantorsRepository.finalizeEvaluation(client, {
            candidateId: inserted.id,
            candidateStatus,
            evaluationEngine: CASE_GUARANTOR_EVALUATION_ENGINE,
            eligible,
            zcoreBcra,
            riskLevel,
            scoreReason,
            periodo,
            reviewedBy: 'system',
            reviewReason: scoreReason,
          });

        return {
          ok: true,
          case_id: persisted.case_id,
          attempt_no: persisted.attempt_no,
          candidate_status: persisted.status,
          eligible: persisted.eligible,
          zcore_bcra: persisted.zcore_bcra,
          risk_level: persisted.risk_level,
          score_reason: persisted.score_reason,
          periodo: persisted.periodo,
          remaining_attempts: Math.max(
            0,
            MAX_GUARANTOR_ATTEMPTS - persisted.attempt_no,
          ),
        };
      },
    );
  }

  private businessError(
    errorCode: EvaluateCaseGuarantorBusinessErrorResponse['error_code'],
  ): EvaluateCaseGuarantorBusinessErrorResponse {
    return {
      ok: false,
      error_type: 'BUSINESS',
      error_code: errorCode,
    };
  }

  private technicalError(
    errorCode: CaseGuarantorTechnicalErrorCode,
  ): EvaluateCaseGuarantorTechnicalErrorResponse {
    return {
      ok: false,
      error_type: 'TECHNICAL',
      error_code: errorCode,
      retryable: true,
    };
  }
}
