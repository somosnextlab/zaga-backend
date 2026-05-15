import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { DashboardService } from './dashboard.service';
import { GlobalSearchQueryDto } from './dto/dashboard-search.dto';

@ApiTags('Backoffice — Dashboard')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private')
export class DashboardController {
  public constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Resumen operativo para consola interna' })
  public getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('search')
  @ApiOperation({ summary: 'Búsqueda global transversal' })
  public search(@Query() query: GlobalSearchQueryDto) {
    return this.dashboardService.globalSearch(query.q ?? '');
  }
}
