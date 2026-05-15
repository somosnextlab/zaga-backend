import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { LoansListQueryDto } from './dto/loans-list-query.dto';
import { LoansBackofficeService } from './loans-backoffice.service';

@ApiTags('Backoffice — Loans')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/loans')
export class LoansBackofficeController {
  public constructor(
    private readonly loansBackofficeService: LoansBackofficeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de préstamos' })
  public list(@Query() query: LoansListQueryDto) {
    return this.loansBackofficeService.list(query);
  }
}
