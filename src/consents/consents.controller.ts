import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AcceptConsentDto } from './dto/accept-consent.dto';
import { ConsentsService } from './consents.service';

@Controller('consents')
export class ConsentsController {
  public constructor(private readonly consentsService: ConsentsService) {}

  @Post('accept')
  public async acceptConsent(
    @Body() body: AcceptConsentDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    const ip = this.getRequestIp(req);
    const userAgent = this.getUserAgent(req);

    return this.consentsService.acceptConsent({
      token: body.token,
      ip,
      userAgent,
    });
  }

  @Get(':token')
  public async getConsentByToken(@Param('token') token: string): Promise<{
    token: string;
    status: 'PENDING' | 'ACCEPTED';
    terms_version: string;
    terms_url: string | null;
    terms_hash: string | null;
    expires_at: string;
    is_valid: boolean;
  }> {
    return this.consentsService.getConsentByToken(token);
  }

  private getRequestIp(req: Request): string {
    const xForwardedFor = req.get('x-forwarded-for');
    if (xForwardedFor && xForwardedFor.trim().length > 0) {
      return xForwardedFor.split(',')[0].trim();
    }

    return req.ip ?? '';
  }

  private getUserAgent(req: Request): string {
    return req.get('user-agent') ?? '';
  }
}
