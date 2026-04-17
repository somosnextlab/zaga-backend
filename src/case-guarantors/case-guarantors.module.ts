import { Module } from '@nestjs/common';
import { PrequalModule } from '../prequal/prequal.module';
import { CaseGuarantorsController } from './case-guarantors.controller';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import { CaseGuarantorsService } from './case-guarantors.service';

@Module({
  imports: [PrequalModule],
  controllers: [CaseGuarantorsController],
  providers: [CaseGuarantorsService, CaseGuarantorsRepository],
})
export class CaseGuarantorsModule {}
