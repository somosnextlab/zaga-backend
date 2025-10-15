import { Injectable, NotFoundException } from '@nestjs/common';
import { Logger } from '@shared/logger';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener todos los clientes con paginación
   * @param page - Página actual
   * @param limit - Límite de elementos por página
   * @returns Lista paginada de clientes
   */
  async findAll(page: number = 1, limit: number = 10) {
    this.logger.log(`Obteniendo clientes - página: ${page}, límite: ${limit}`);

    try {
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

      this.logger.log(`Clientes obtenidos: ${clientes.length} de ${total} total`);

      return {
        data: clientes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Error al obtener clientes:', error);
      throw new Error('Error al obtener clientes');
    }
  }

  /**
   * Obtener un cliente por ID
   * @param id - ID del cliente
   * @returns Datos del cliente
   */
  async findOne(id: string) {
    this.logger.log(`Obteniendo cliente por ID: ${id}`);

    try {
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
    } catch (error) {
      this.logger.error('Error al obtener cliente:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al obtener cliente');
    }
  }

  /**
   * Desactivar un cliente (soft delete)
   * @param id - ID del cliente
   * @returns Confirmación de desactivación
   */
  async deactivateClient(id: string) {
    this.logger.log(`Desactivando cliente: ${id}`);

    try {
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

      this.logger.log(`Cliente desactivado exitosamente: ${id}`);

      return {
        success: true,
        message: 'Cliente desactivado exitosamente',
      };
    } catch (error) {
      this.logger.error('Error al desactivar cliente:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al desactivar cliente');
    }
  }
}
