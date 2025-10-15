import { Module } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';

import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService],
  exports: [ClientesService],
})
export class ClientesModule {}
