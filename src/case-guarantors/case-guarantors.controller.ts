import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EvaluateCaseGuarantorDto } from './dto/evaluate-case-guarantor.dto';
import type { EvaluateCaseGuarantorResponse } from './interfaces/case-guarantors.interface';
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
  })
  @ApiResponse({
    status: 200,
    description:
      'Evaluación procesada. Responde ok: true si se evaluó, u ok: false para errores de negocio controlados.',
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
}
