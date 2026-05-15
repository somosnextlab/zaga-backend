import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import {
  AdminAuditRepository,
  type AdminAuditLogRow,
} from './admin-audit.repository';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@ApiTags('Backoffice — Auditoría')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/audit-logs')
export class AuditBackofficeController {
  public constructor(private readonly auditRepository: AdminAuditRepository) {}

  @Get()
  @ApiOperation({ summary: 'Listado paginado de auditoría interna' })
  public async list(
    @Query() query: AuditLogsQueryDto,
    @Req() req: Request,
  ): Promise<{
    ok: true;
    rows: Array<{
      id: string;
      admin_user: {
        id: string | null;
        email: string | null;
        full_name: string | null;
      };
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      metadata: Record<string, unknown> | null;
      ip: string | null;
      user_agent: string | null;
      created_at: string;
    }>;
    page: number;
    limit: number;
  }> {
    void req;
    const limit = query.limit;
    const page = query.page;
    const offset = (page - 1) * limit;
    const rawRows = await this.auditRepository.list({
      limit,
      offset,
      q: query.q?.trim() || null,
      action: query.action?.trim() || null,
      entityType: query.entity_type?.trim() || null,
      entityId: query.entity_id?.trim() || null,
      adminUserId: query.admin_user_id?.trim() || null,
    });
    return {
      ok: true,
      rows: rawRows.map((r) => this.mapRow(r)),
      page,
      limit,
    };
  }

  private mapRow(row: AdminAuditLogRow): {
    id: string;
    admin_user: {
      id: string | null;
      email: string | null;
      full_name: string | null;
    };
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
  } {
    const created =
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at);
    return {
      id: row.id,
      admin_user: {
        id: row.admin_user_id,
        email: row.admin_email,
        full_name: row.admin_full_name,
      },
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: row.metadata,
      ip: row.ip,
      user_agent: row.user_agent,
      created_at: created,
    };
  }
}
