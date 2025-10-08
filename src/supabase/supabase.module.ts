import { Global, Module } from '@nestjs/common';

import { SupabaseUserService } from './supabase-user.service';

@Global()
@Module({
  providers: [SupabaseUserService],
  exports: [SupabaseUserService],
})
export class SupabaseModule {}
