import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentZagaUser } from './decorators/current-zaga-user.decorator';
import {
  ZAGA_SESSION_ID_KEY,
  ZagaSessionGuard,
} from './guards/zaga-session.guard';
import { ZagaLoginDto } from './dto/zaga-login.dto';
import type { ZagaRequestUser } from './types/zaga-request.types';
import { ZagaAuthService } from './zaga-auth.service';

@ApiTags('Auth interno')
@Controller('auth')
export class ZagaAuthController {
  public constructor(private readonly zagaAuthService: ZagaAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login backoffice' })
  public login(@Body() body: ZagaLoginDto, @Req() req: Request) {
    return this.zagaAuthService.login(body, req);
  }

  @Get('me')
  @ApiBearerAuth('zaga-session')
  @UseGuards(ZagaSessionGuard)
  @ApiOperation({ summary: 'Usuario autenticado' })
  public me(@CurrentZagaUser() user: ZagaRequestUser) {
    return this.zagaAuthService.me(user);
  }

  @Post('logout')
  @ApiBearerAuth('zaga-session')
  @UseGuards(ZagaSessionGuard)
  @ApiOperation({ summary: 'Cerrar sesión actual' })
  public logout(
    @CurrentZagaUser() user: ZagaRequestUser,
    @Req() req: Request & { [ZAGA_SESSION_ID_KEY]?: string },
  ) {
    const sessionId = req[ZAGA_SESSION_ID_KEY];
    if (typeof sessionId !== 'string') {
      throw new Error('Sesión interna inconsistente');
    }
    return this.zagaAuthService.logout(user, sessionId, req);
  }
}
