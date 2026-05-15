import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { LeadsListQueryDto } from './dto/leads-list-query.dto';
import { LeadsBackofficeService } from './leads-backoffice.service';

@ApiTags('Backoffice — Leads')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/leads')
export class LeadsBackofficeController {
  public constructor(
    private readonly leadsBackofficeService: LeadsBackofficeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de leads' })
  public list(@Query() query: LeadsListQueryDto) {
    return this.leadsBackofficeService.list(query);
  }
}
