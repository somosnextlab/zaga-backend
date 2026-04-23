import { Injectable } from '@nestjs/common';
import { DbService, type DbClient } from '../db/db.service';
import { BcraZcoreEngineService } from '../prequal/bcra-zcore-engine.service';
import { isValidCuitChecksum } from '../prequal/cuit-checksum';
import {
  ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION,
  CASE_APROBADO_FINAL_ERRORS,
  CASE_GUARANTOR_ERRORS,
  CASE_GUARANTOR_EVALUATION_ENGINE,
  CASE_GUARANTOR_SYSTEM_REVIEWER,
  MAX_GUARANTOR_ATTEMPTS,
} from './case-guarantors.constants';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import type { ApplyAprobadoFinalDto } from './dto/apply-aprobado-final.dto';
import type { EvaluateCaseGuarantorDto } from './dto/evaluate-case-guarantor.dto';
import type { ResolveCaseGuarantorDto } from './dto/resolve-case-guarantor.dto';
import type {
  ApplyAprobadoFinalBusinessErrorResponse,
  ApplyAprobadoFinalResponse,
  ApplyAprobadoFinalSuccessResponse,
  CaseGuarantorAttemptRow,
  CaseGuarantorTechnicalErrorCode,
  EvaluateCaseGuarantorBusinessErrorResponse,
  EvaluateCaseGuarantorResponse,
  EvaluateCaseGuarantorTechnicalErrorResponse,
  ResolveGuarantorBusinessErrorResponse,
  ResolveGuarantorResponse,
  ResolveGuarantorSuccessResponse,
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
            CASE_GUARANTOR_ERRORS.CASE_DOES_NOT_REQUIRE_GUARANTOR,
          );
        }

        if (
          !ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION.some(
            (status) => status === caseRow.status,
          )
        ) {
          return this.businessError(CASE_GUARANTOR_ERRORS.CASE_STATUS_INVALID);
        }

        const attempts =
          await this.caseGuarantorsRepository.findCaseGuarantorsByCaseIdForUpdate(
            client,
            dto.caseId,
          );

        if (this.findPendingSystemApprovedCandidateId(attempts) !== null) {
          return this.businessError(
            CASE_GUARANTOR_ERRORS.APPROVED_GUARANTOR_PENDING_CEO_DECISION,
          );
        }

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

        await this.caseGuarantorsRepository.updateCaseStatus(
          client,
          dto.caseId,
          'PENDING_GUARANTOR_ANALYSIS',
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
        const candidateStatus = eligible ? 'APPROVED' : 'REJECTED';
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
            reviewedBy: CASE_GUARANTOR_SYSTEM_REVIEWER,
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

  public async resolveCaseGuarantor(
    dto: ResolveCaseGuarantorDto,
  ): Promise<ResolveGuarantorResponse> {
    return this.dbService.withTransaction(
      async (client: DbClient): Promise<ResolveGuarantorResponse> => {
        const caseRow =
          await this.caseGuarantorsRepository.findCaseByIdForUpdate(
            client,
            dto.caseId,
          );
        if (!caseRow) {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.CASE_NOT_FOUND,
          );
        }

        if (caseRow.status !== 'PENDING_GUARANTOR_ANALYSIS') {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.CASE_STATUS_INVALID,
          );
        }

        if (!caseRow.requires_guarantor) {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.CASE_DOES_NOT_REQUIRE_GUARANTOR,
          );
        }

        const attempts =
          await this.caseGuarantorsRepository.findCaseGuarantorsByCaseIdForUpdate(
            client,
            dto.caseId,
          );

        const pendingId = this.findPendingSystemApprovedCandidateId(attempts);
        if (!pendingId) {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.NO_APPROVED_GUARANTOR_TO_RESOLVE,
          );
        }

        const actorLabel = dto.actor;

        if (dto.action === 'GARANTE_APROBADO') {
          const updated =
            await this.caseGuarantorsRepository.markGuarantorApprovedByCeoForNosis(
              client,
              { candidateId: pendingId, reviewedBy: actorLabel },
            );
          if (!updated) {
            return this.resolveBusinessError(
              CASE_GUARANTOR_ERRORS.NO_APPROVED_GUARANTOR_TO_RESOLVE,
            );
          }
          await this.caseGuarantorsRepository.updateCaseStatus(
            client,
            dto.caseId,
            'PENDING_NOSIS',
          );
          const success: ResolveGuarantorSuccessResponse = {
            ok: true,
            action: 'GARANTE_APROBADO',
            case_id: dto.caseId,
            case_status: 'PENDING_NOSIS',
          };
          return success;
        }

        const rejectReason = dto.rejectReason;
        if (rejectReason === undefined) {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.CASE_STATUS_INVALID,
          );
        }

        const rejected =
          await this.caseGuarantorsRepository.rejectGuarantorCandidateByCeo(
            client,
            {
              candidateId: pendingId,
              reviewedBy: actorLabel,
              reviewReason: rejectReason,
            },
          );
        if (!rejected) {
          return this.resolveBusinessError(
            CASE_GUARANTOR_ERRORS.NO_APPROVED_GUARANTOR_TO_RESOLVE,
          );
        }

        const remainingAttempts = Math.max(
          0,
          MAX_GUARANTOR_ATTEMPTS - attempts.length,
        );
        const successReject: ResolveGuarantorSuccessResponse = {
          ok: true,
          action: 'GARANTE_RECHAZADO',
          case_id: dto.caseId,
          case_status: 'PENDING_GUARANTOR_ANALYSIS',
          remaining_attempts: remainingAttempts,
          max_attempts_reached: attempts.length >= MAX_GUARANTOR_ATTEMPTS,
        };
        return successReject;
      },
    );
  }

  public async applyAprobadoFinal(
    dto: ApplyAprobadoFinalDto,
  ): Promise<ApplyAprobadoFinalResponse> {
    return this.dbService.withTransaction(
      async (client: DbClient): Promise<ApplyAprobadoFinalResponse> => {
        const outcome =
          await this.caseGuarantorsRepository.applyAprobadoFinalFromPendingNosis(
            client,
            dto.caseId,
          );

        if (outcome.outcome === 'SUCCESS') {
          const ok: ApplyAprobadoFinalSuccessResponse = {
            ok: true,
            case_id: dto.caseId,
            case_status: 'APROBADO_FINAL',
          };
          return ok;
        }

        const codeMap = {
          CASE_NOT_FOUND: CASE_APROBADO_FINAL_ERRORS.CASE_NOT_FOUND,
          CASE_STATUS_INVALID: CASE_APROBADO_FINAL_ERRORS.CASE_STATUS_INVALID,
          CURRENT_OFFER_NOT_FOUND:
            CASE_APROBADO_FINAL_ERRORS.CURRENT_OFFER_NOT_FOUND,
        } as const;

        const err: ApplyAprobadoFinalBusinessErrorResponse = {
          ok: false,
          error_type: 'BUSINESS',
          error_code: codeMap[outcome.outcome],
        };
        return err;
      },
    );
  }

  private findPendingSystemApprovedCandidateId(
    attempts: CaseGuarantorAttemptRow[],
  ): string | null {
    for (let i = attempts.length - 1; i >= 0; i--) {
      const attempt = attempts[i];
      if (attempt === undefined) {
        continue;
      }
      if (
        attempt.status === 'APPROVED' &&
        (attempt.reviewed_by === null ||
          attempt.reviewed_by === CASE_GUARANTOR_SYSTEM_REVIEWER)
      ) {
        return attempt.id;
      }
    }
    return null;
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

  private resolveBusinessError(
    errorCode: ResolveGuarantorBusinessErrorResponse['error_code'],
  ): ResolveGuarantorBusinessErrorResponse {
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
