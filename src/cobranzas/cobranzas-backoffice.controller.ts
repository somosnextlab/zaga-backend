import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';

// Sprint 4 — endpoints backoffice de cobranzas
@ApiTags('Backoffice — Cobranzas')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/cobranzas')
export class CobranzasBackofficeController {}
