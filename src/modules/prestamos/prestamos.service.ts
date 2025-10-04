import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class PrestamosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.financiera_prestamos.findMany({
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
        cronogramas: true,
        pagos: true,
      },
    });
  }

  async findOne(id: string) {
    const prestamo = await this.prisma.financiera_prestamos.findUnique({
      where: { id },
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
        cronogramas: true,
        pagos: true,
      },
    });

    if (!prestamo) {
      throw new NotFoundException(`Préstamo con ID ${id} no encontrado`);
    }

    return prestamo;
  }
}
