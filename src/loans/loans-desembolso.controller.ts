import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { LoansDesembolsoService } from './loans-desembolso.service';

@ApiTags('Backoffice — Loans')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/loans')
export class LoansDesembolsoController {
  public constructor(
    private readonly loansDesembolsoService: LoansDesembolsoService,
  ) {}

  @Post(':loanId/desembolso')
  @ApiOperation({
    summary: 'Registrar desembolso',
    description:
      'Asigna public_loan_number, registra disbursed_at y genera el schedule de 12 cuotas semanales.',
  })
  @ApiParam({ name: 'loanId', description: 'UUID del préstamo' })
  public registrarDesembolso(@Param('loanId') loanId: string) {
    return this.loansDesembolsoService.registrarDesembolso(loanId);
  }
}
