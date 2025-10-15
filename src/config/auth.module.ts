import { JwksClientService } from '@adapters/jwks.client';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RolesGuard } from './roles.guard';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'zaga-secret-key-dev',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [JwksClientService, SupabaseJwtGuard, RolesGuard],
  exports: [JwksClientService, SupabaseJwtGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
