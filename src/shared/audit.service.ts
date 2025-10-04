import { Injectable } from '@nestjs/common';

import { Logger } from './logger';
import { PrismaService } from './prisma.service';

export interface AuditEvent {
  evento: string;
  entidad: string;
  entidadId: string;
  detalle?: object;
  usuarioId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async audit(
    evento: string,
    entidad: string,
    entidadId: string,
    detalle?: object,
    usuarioId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.financiera_auditoria.create({
        data: {
          evento,
          entidad,
          entidad_id: entidadId,
          detalle: detalle || {},
          usuario_id: usuarioId,
          ip,
          user_agent: userAgent,
        },
      });

      this.logger.log(
        `Auditoría registrada: ${evento} en ${entidad}:${entidadId}`,
      );
    } catch (error) {
      this.logger.error(
        'Error al registrar auditoría:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async getAuditTrail(entidad: string, entidadId: string, limit = 50) {
    return this.prisma.financiera_auditoria.findMany({
      where: {
        entidad,
        entidad_id: entidadId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }
}
