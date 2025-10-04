import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class EvaluacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.financiera_evaluaciones.findMany({
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
    });
  }

  async findOne(id: string) {
    const evaluacion = await this.prisma.financiera_evaluaciones.findUnique({
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
      },
    });

    if (!evaluacion) {
      throw new NotFoundException(`Evaluación con ID ${id} no encontrada`);
    }

    return evaluacion;
  }
}
