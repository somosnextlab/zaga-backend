import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EvaluateCaseGuarantorBodyDto } from './dto/evaluate-case-guarantor-body.dto';
import { ResolveCaseGuarantorBodyDto } from './dto/resolve-case-guarantor-body.dto';
import { UpdateGuarantorManualIdentityBodyDto } from './dto/update-guarantor-manual-identity-body.dto';
import type {
  ApplyGuarantorManualIdentityResponse,
  EvaluateCaseGuarantorResponse,
  ResolveGuarantorResponse,
} from './interfaces/case-guarantors.interface';
import { CaseGuarantorsService } from './case-guarantors.service';

@ApiTags('Guarantors')
@Controller('cases')
export class CaseGuarantorsController {
  public constructor(
    private readonly caseGuarantorsService: CaseGuarantorsService,
  ) {}

  @Post(':caseId/evaluate-guarantor')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary: 'Evalúa un candidato de garante para un CASE',
    description:
      'Solo con case en OFFER_SENT o PENDING_GUARANTOR_ANALYSIS. Con PENDING_NOSIS usar otro flujo antes de evaluar. Tras insertar el intento de evaluación el caso pasa a PENDING_GUARANTOR_ANALYSIS (incluido si BCRA devuelve TECHNICAL y se borra el candidato).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Evaluación procesada. ok: true si hubo resultado de negocio. ok: false con error_type BUSINESS (validaciones y duplicados). ok: false con error_type TECHNICAL y retryable: true si falló BCRA/red antes del score (reintentar mismo CUIT sin consumir intento).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validación DTO fallida (ej. caseId inválido o campos faltantes).',
  })
  public async evaluate(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: EvaluateCaseGuarantorBodyDto,
  ): Promise<EvaluateCaseGuarantorResponse> {
    return this.caseGuarantorsService.evaluateCaseGuarantor({
      caseId,
      cuit: body.cuit,
    });
  }

  @Post(':caseId/resolve-guarantor')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary:
      'Resolución manual del garante por CEO/Asesoría (aprobación hacia NOSIS o rechazo del candidato APPROVED)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Resultado de negocio en payload (ok true/false). Errores BUSINESS coherentes con el estado del caso.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validación DTO (ej. falta rejectReason en GARANTE_RECHAZADO).',
  })
  public async resolve(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: ResolveCaseGuarantorBodyDto,
  ): Promise<ResolveGuarantorResponse> {
    return this.caseGuarantorsService.resolveCaseGuarantor({
      caseId,
      action: body.action,
      actor: body.actor,
      rejectReason: body.rejectReason,
    });
  }

  @Post(':caseId/update-guarantor-manual-identity')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary:
      'Carga manual por CEO de first_name y last_name del garante APPROVED del caso (fallback cuando BCRA no devolvió un nombre confiable).',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad del garante persistida o error BUSINESS.',
  })
  @ApiResponse({ status: 400, description: 'Validación DTO.' })
  public async updateGuarantorManualIdentity(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: UpdateGuarantorManualIdentityBodyDto,
  ): Promise<ApplyGuarantorManualIdentityResponse> {
    return this.caseGuarantorsService.applyGuarantorManualIdentity({
      caseId,
      firstName: body.firstName,
      lastName: body.lastName,
      actor: body.actor,
    });
  }
}
