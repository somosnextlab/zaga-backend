import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

import { CreateClienteDto } from './dtos/create-cliente.dto';
import { UpdateClienteDto } from './dtos/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClienteDto: CreateClienteDto) {
    return this.prisma.financiera_clientes.create({
      data: createClienteDto,
      include: {
        persona: true,
      },
    });
  }

  async findAll() {
    return this.prisma.financiera_clientes.findMany({
      include: {
        persona: true,
      },
    });
  }

  async findOne(id: string) {
    const cliente = await this.prisma.financiera_clientes.findUnique({
      where: { id },
      include: {
        persona: true,
        solicitudes: true,
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return cliente;
  }

  async update(id: string, updateClienteDto: UpdateClienteDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_clientes.update({
      where: { id },
      data: updateClienteDto,
      include: {
        persona: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.financiera_clientes.delete({
      where: { id },
    });
  }
}
