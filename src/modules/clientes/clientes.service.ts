import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener todos los clientes con paginación
   * @param page - Página actual
   * @param limit - Límite de elementos por página
   * @returns Lista paginada de clientes
   */
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [clientes, total] = await Promise.all([
      this.prisma.financiera_clientes.findMany({
        skip,
        take: limit,
        include: {
          persona: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.financiera_clientes.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: clientes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Obtener un cliente por ID
   * @param id - ID del cliente
   * @returns Datos del cliente
   */
  async findOne(id: string) {
    const cliente = await this.prisma.financiera_clientes.findUnique({
      where: { id },
      include: {
        persona: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            fecha_nac: true,
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  /**
   * Desactivar un cliente (soft delete)
   * @param id - ID del cliente
   * @returns Confirmación de desactivación
   */
  async deactivateClient(id: string) {
    const cliente = await this.prisma.financiera_clientes.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    await this.prisma.financiera_clientes.update({
      where: { id },
      data: {
        estado: 'inactivo',
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Cliente desactivado exitosamente',
    };
  }
}
