import { Module, Global } from '@nestjs/common';
import { JwksClientService } from '@adapters/jwks.client';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [JwksClientService, SupabaseJwtGuard, RolesGuard],
  exports: [JwksClientService, SupabaseJwtGuard, RolesGuard],
})
export class AuthModule {}



