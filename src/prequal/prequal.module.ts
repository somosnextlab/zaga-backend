import { Module } from '@nestjs/common';
import { PrequalController } from './prequal.controller';
import { PrequalService } from './prequal.service';

@Module({
  controllers: [PrequalController],
  providers: [PrequalService],
})
export class PrequalModule {}
