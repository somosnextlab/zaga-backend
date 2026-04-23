import { Module } from '@nestjs/common';
import { PrequalModule } from '../prequal/prequal.module';
import { CaseGuarantorsController } from './case-guarantors.controller';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import { CaseGuarantorsService } from './case-guarantors.service';
import { CasesInternalController } from './cases-internal.controller';

@Module({
  imports: [PrequalModule],
  controllers: [CaseGuarantorsController, CasesInternalController],
  providers: [CaseGuarantorsService, CaseGuarantorsRepository],
})
export class CaseGuarantorsModule {}
