import { JwksClientService } from '@adapters/jwks.client';
import { Global,Module } from '@nestjs/common';

import { RolesGuard } from './roles.guard';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

@Global()
@Module({
  providers: [JwksClientService, SupabaseJwtGuard, RolesGuard],
  exports: [JwksClientService, SupabaseJwtGuard, RolesGuard],
})
export class AuthModule {}



