import { Body, Controller, Post } from '@nestjs/common';
import { RunPrequalDto } from './dto/run-prequal.dto';
import { PrequalService } from './prequal.service';

@Controller('internal/prequal')
export class PrequalController {
  public constructor(private readonly prequalService: PrequalService) {}

  @Post('run')
  public async runPrequal(@Body() body: RunPrequalDto): Promise<
    | {
        ok: true;
        eligible: boolean;
        risk_level: string;
        zcore_bcra: number;
        score_initial: number;
        score_reason: string;
        model_version: string;
        periodo: string;
        first_name: string;
        last_name: string;
      }
    | {
        ok: false;
        error_type: 'TECHNICAL' | 'BUSINESS';
        error_code: string;
      }
  > {
    return this.prequalService.runPrequal({
      userId: body.userId,
      phone: body.phone,
      cuit: body.cuit,
    });
  }
}
