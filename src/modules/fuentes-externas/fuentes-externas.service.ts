import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

@Injectable()
export class FuentesExternasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.financiera_fuentes_externas.findMany();
  }

  async findOne(id: string) {
    return this.prisma.financiera_fuentes_externas.findUnique({
      where: { id },
    });
  }
}
