import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { CasesBackofficeService } from './cases-backoffice.service';
import { CasesListQueryDto } from './dto/cases-list-query.dto';

@ApiTags('Backoffice — Cases')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/cases')
export class CasesBackofficeController {
  public constructor(
    private readonly casesBackofficeService: CasesBackofficeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de casos' })
  public list(@Query() query: CasesListQueryDto) {
    return this.casesBackofficeService.list(query);
  }

  @Get(':caseId')
  @ApiOperation({ summary: 'Detalle compuesto del caso' })
  public detail(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.casesBackofficeService.getDetail(caseId);
  }

  @Get(':caseId/timeline')
  @ApiOperation({ summary: 'Línea de tiempo derivada de datos existentes' })
  public timeline(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.casesBackofficeService.getTimeline(caseId);
  }
}
