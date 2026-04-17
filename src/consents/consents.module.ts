import { Module } from '@nestjs/common';
import { ConsentTokenUuidPipe } from './consent-token-uuid.pipe';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';

@Module({
  controllers: [ConsentsController],
  providers: [ConsentsService, ConsentTokenUuidPipe],
})
export class ConsentsModule {}
