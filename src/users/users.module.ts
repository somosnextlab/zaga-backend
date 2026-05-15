import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { UsersBackofficeController } from './users-backoffice.controller';
import { UsersBackofficeService } from './users-backoffice.service';

@Module({
  imports: [ZagaAuthModule],
  controllers: [UsersBackofficeController],
  providers: [UsersBackofficeService],
})
export class UsersModule {}
