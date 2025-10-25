import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaService } from '../../shared/prisma.service';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';

@Module({
  imports: [SupabaseModule],
  providers: [ClientesService, PrismaService],
  controllers: [ClientesController],
  exports: [ClientesService],
})
export class ClientesModule {}
