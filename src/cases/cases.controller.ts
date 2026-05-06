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
import { CaseGuarantorsService } from '../case-guarantors/case-guarantors.service';
import type {
  ApplyAprobadoFinalResponse,
  ApplyManualIdentityResponse,
} from '../case-guarantors/interfaces/case-guarantors.interface';
import { CreateCaseFromRequestedAmountDto } from './dto/create-case-from-requested-amount.dto';
import { UpdateManualIdentityBodyDto } from './dto/update-manual-identity-body.dto';
import type { CreateCaseFromRequestedAmountResponse } from './interfaces/create-case-from-requested-amount.interface';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';

@ApiTags('Cases')
@Controller('cases')
export class CasesController {
  public constructor(
    private readonly caseGuarantorsService: CaseGuarantorsService,
    private readonly casesFromRequestedAmountService: CasesFromRequestedAmountService,
  ) {}

  @Post('create-from-requested-amount')
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

  @Post(':caseId/update-manual-identity')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
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
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: UpdateManualIdentityBodyDto,
  ): Promise<ApplyManualIdentityResponse> {
    return this.caseGuarantorsService.applyManualIdentity({
      caseId,
      firstName: body.firstName,
      lastName: body.lastName,
      actor: body.actor,
    });
  }

  @Post(':caseId/approve-final')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
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
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ): Promise<ApplyAprobadoFinalResponse> {
    return this.caseGuarantorsService.applyAprobadoFinal({ caseId });
  }
}
