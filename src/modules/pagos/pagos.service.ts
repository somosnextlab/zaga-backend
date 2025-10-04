import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class PagosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.financiera_pagos.findMany({
      include: {
        prestamo: {
          include: {
            solicitud: {
              include: {
                cliente: {
                  include: {
                    persona: true,
                  },
                },
              },
            },
          },
        },
        cronograma: true,
      },
    });
  }

  async findOne(id: string) {
    const pago = await this.prisma.financiera_pagos.findUnique({
      where: { id },
      include: {
        prestamo: {
          include: {
            solicitud: {
              include: {
                cliente: {
                  include: {
                    persona: true,
                  },
                },
              },
            },
          },
        },
        cronograma: true,
      },
    });

    if (!pago) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    return pago;
  }
}
