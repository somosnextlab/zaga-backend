import { Module } from '@nestjs/common';
import { PrequalController } from './prequal.controller';
import { PrequalService } from './prequal.service';
import { BcraZcoreEngineService } from './bcra-zcore-engine.service';

@Module({
  controllers: [PrequalController],
  providers: [PrequalService, BcraZcoreEngineService],
  exports: [BcraZcoreEngineService],
})
export class PrequalModule {}
