import { BcraAdapter } from '@modules/fuentes-externas/adapters/bcra.adapter';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EvaluacionProcessor } from './evaluacion.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'evaluacion',
    }),
  ],
  providers: [EvaluacionProcessor, BcraAdapter],
  exports: [BullModule],
})
export class JobsModule {}
