import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LoansDesembolsoService } from './loans-desembolso.service';

@ApiTags('Loans')
@Controller('loans')
export class LoansDesembolsoController {
  public constructor(
    private readonly loansDesembolsoService: LoansDesembolsoService,
  ) {}

  @Post(':loanId/desembolso')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar desembolso (comando CEO vía n8n)',
    description:
      'Llamado por n8n al recibir comando DESEMBOLSO del CEO por WhatsApp. Asigna public_loan_number, registra disbursed_at y genera el schedule de 12 cuotas semanales.',
  })
  @ApiParam({ name: 'loanId', description: 'UUID del préstamo' })
  public registrarDesembolso(@Param('loanId') loanId: string) {
    return this.loansDesembolsoService.registrarDesembolso(loanId);
  }
}
