import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CasesFromRequestedAmountService } from '../cases/cases-from-requested-amount.service';
import { CreateCaseFromRequestedAmountDto } from '../cases/dto/create-case-from-requested-amount.dto';
import type { CreateCaseFromRequestedAmountResponse } from '../cases/interfaces/create-case-from-requested-amount.interface';
import { ApplyAprobadoFinalDto } from './dto/apply-aprobado-final.dto';
import { ApplyManualIdentityDto } from './dto/apply-manual-identity.dto';
import type {
  ApplyAprobadoFinalResponse,
  ApplyManualIdentityResponse,
} from './interfaces/case-guarantors.interface';
import { CaseGuarantorsService } from './case-guarantors.service';

@ApiTags('CasesInternal')
@Controller('internal/cases')
export class CasesInternalController {
  public constructor(
    private readonly caseGuarantorsService: CaseGuarantorsService,
    private readonly casesFromRequestedAmountService: CasesFromRequestedAmountService,
  ) {}

  @Post('aprobado-final')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Marca el caso en APROBADO_FINAL y la oferta vigente en ACCEPTED. Solo válido si el caso está en PENDING_NOSIS.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transición aplicada o error BUSINESS (estado u oferta inválidos).',
  })
  @ApiResponse({ status: 400, description: 'Validación DTO.' })
  public async applyAprobadoFinal(
    @Body() body: ApplyAprobadoFinalDto,
  ): Promise<ApplyAprobadoFinalResponse> {
    return this.caseGuarantorsService.applyAprobadoFinal(body);
  }

  @Post('manual-identity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Actualiza first_name y last_name del user de un caso en carril manual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidad manual persistida o error BUSINESS.',
  })
  @ApiResponse({ status: 400, description: 'Validación DTO.' })
  public async applyManualIdentity(
    @Body() body: ApplyManualIdentityDto,
  ): Promise<ApplyManualIdentityResponse> {
    return this.caseGuarantorsService.applyManualIdentity(body);
  }

  @Post('from-requested-amount')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Crea un CASE con monto solicitado discreto y avanza el lead a WAITING_CEO (reemplazo de inserts SQL desde n8n).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Caso creado (ok: true) o error de negocio (ok: false, error_code). INVALID_REQUESTED_AMOUNT puede devolver 400 si la validación falla antes de la transacción.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validación DTO o monto no permitido.',
  })
  @ApiResponse({
    status: 500,
    description:
      'CASE_CREATION_FAILED u error interno inesperado en persistencia.',
  })
  public async createFromRequestedAmount(
    @Body() body: CreateCaseFromRequestedAmountDto,
  ): Promise<CreateCaseFromRequestedAmountResponse> {
    return this.casesFromRequestedAmountService.createFromRequestedAmount(body);
  }
}
