import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EvaluateCaseGuarantorDto } from './dto/evaluate-case-guarantor.dto';
import { ResolveCaseGuarantorDto } from './dto/resolve-case-guarantor.dto';
import type {
  EvaluateCaseGuarantorResponse,
  ResolveGuarantorResponse,
} from './interfaces/case-guarantors.interface';
import { CaseGuarantorsService } from './case-guarantors.service';

@ApiTags('CaseGuarantors')
@Controller('internal/case-guarantors')
export class CaseGuarantorsController {
  public constructor(
    private readonly caseGuarantorsService: CaseGuarantorsService,
  ) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
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
    @Body() body: EvaluateCaseGuarantorDto,
  ): Promise<EvaluateCaseGuarantorResponse> {
    return this.caseGuarantorsService.evaluateCaseGuarantor(body);
  }

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
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
    @Body() body: ResolveCaseGuarantorDto,
  ): Promise<ResolveGuarantorResponse> {
    return this.caseGuarantorsService.resolveCaseGuarantor(body);
  }
}
