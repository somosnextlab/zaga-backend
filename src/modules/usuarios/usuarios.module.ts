import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaService } from '../../shared/prisma.service';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [SupabaseModule],
  providers: [UsuariosService, PrismaService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
