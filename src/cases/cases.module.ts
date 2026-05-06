import { Module } from '@nestjs/common';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';

@Module({
  providers: [CasesFromRequestedAmountService],
  exports: [CasesFromRequestedAmountService],
})
export class CasesModule {}
