import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { ContractsBackofficeService } from './contracts-backoffice.service';
import { ContractsListQueryDto } from './dto/contracts-list-query.dto';

@ApiTags('Backoffice — Contratos')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/contracts')
export class ContractsBackofficeController {
  public constructor(
    private readonly contractsBackofficeService: ContractsBackofficeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de contratos' })
  public list(@Query() query: ContractsListQueryDto) {
    return this.contractsBackofficeService.list(query);
  }
}
