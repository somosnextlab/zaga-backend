import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaService } from '../../shared/prisma.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [SupabaseModule],
  providers: [AuthService, PrismaService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
