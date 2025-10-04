import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';
import { CreateGaranteDto } from './dtos/create-garante.dto';
import { UpdateGaranteDto } from './dtos/update-garante.dto';

@Injectable()
export class GarantesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGaranteDto: CreateGaranteDto) {
    return this.prisma.financiera_garantes.create({
      data: createGaranteDto,
      include: {
        persona: true,
      },
    });
  }

  async findAll() {
    return this.prisma.financiera_garantes.findMany({
      include: {
        persona: true,
      },
    });
  }

  async findOne(id: string) {
    const garante = await this.prisma.financiera_garantes.findUnique({
      where: { id },
      include: {
        persona: true,
        solicitud_garantes: {
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
      },
    });

    if (!garante) {
      throw new NotFoundException(`Garante con ID ${id} no encontrado`);
    }

    return garante;
  }

  async update(id: string, updateGaranteDto: UpdateGaranteDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_garantes.update({
      where: { id },
      data: updateGaranteDto,
      include: {
        persona: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_garantes.delete({
      where: { id },
    });
  }
}
