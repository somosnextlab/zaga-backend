import { BadRequestException,Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

import { AddGaranteDto } from './dtos/add-garante.dto';
import { CreateSolicitudDto } from './dtos/create-solicitud.dto';
import { UpdateSolicitudDto } from './dtos/update-solicitud.dto';

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSolicitudDto: CreateSolicitudDto) {
    // Verificar que el cliente existe
    const cliente = await this.prisma.financiera_clientes.findUnique({
      where: { id: createSolicitudDto.cliente_id },
    });

    if (!cliente) {
      throw new BadRequestException('Cliente no encontrado');
    }

    return this.prisma.financiera_solicitudes.create({
      data: createSolicitudDto,
      include: {
        cliente: {
          include: {
            persona: true,
          },
        },
        solicitud_garantes: {
          include: {
            garante: {
              include: {
                persona: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.financiera_solicitudes.findMany({
      include: {
        cliente: {
          include: {
            persona: true,
          },
        },
        solicitud_garantes: {
          include: {
            garante: {
              include: {
                persona: true,
              },
            },
          },
        },
        evaluaciones: true,
      },
    });
  }

  async findOne(id: string) {
    const solicitud = await this.prisma.financiera_solicitudes.findUnique({
      where: { id },
      include: {
        cliente: {
          include: {
            persona: true,
          },
        },
        solicitud_garantes: {
          include: {
            garante: {
              include: {
                persona: true,
              },
            },
          },
        },
        evaluaciones: true,
        prestamos: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return solicitud;
  }

  async update(id: string, updateSolicitudDto: UpdateSolicitudDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_solicitudes.update({
      where: { id },
      data: updateSolicitudDto,
      include: {
        cliente: {
          include: {
            persona: true,
          },
        },
        solicitud_garantes: {
          include: {
            garante: {
              include: {
                persona: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_solicitudes.delete({
      where: { id },
    });
  }

  async addGarante(solicitudId: string, addGaranteDto: AddGaranteDto) {
    const _solicitud = await this.findOne(solicitudId);

    // Verificar que el garante existe
    const garante = await this.prisma.financiera_garantes.findUnique({
      where: { id: addGaranteDto.garante_id },
    });

    if (!garante) {
      throw new BadRequestException('Garante no encontrado');
    }

    // Verificar que no esté ya asociado
    const existingGarante = await this.prisma.financiera_solicitud_garantes.findUnique({
      where: {
        solicitud_id_garante_id: {
          solicitud_id: solicitudId,
          garante_id: addGaranteDto.garante_id,
        },
      },
    });

    if (existingGarante) {
      throw new BadRequestException('El garante ya está asociado a esta solicitud');
    }

    return this.prisma.financiera_solicitud_garantes.create({
      data: {
        solicitud_id: solicitudId,
        garante_id: addGaranteDto.garante_id,
      },
      include: {
        garante: {
          include: {
            persona: true,
          },
        },
      },
    });
  }

  async getGarantes(solicitudId: string) {
    await this.findOne(solicitudId); // Verificar que la solicitud existe

    return this.prisma.financiera_solicitud_garantes.findMany({
      where: { solicitud_id: solicitudId },
      include: {
        garante: {
          include: {
            persona: true,
          },
        },
      },
    });
  }

  async getEvaluaciones(solicitudId: string) {
    await this.findOne(solicitudId); // Verificar que la solicitud existe

    return this.prisma.financiera_evaluaciones.findMany({
      where: { solicitud_id: solicitudId },
      orderBy: { created_at: 'desc' },
    });
  }
}
