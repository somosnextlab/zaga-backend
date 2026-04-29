import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
