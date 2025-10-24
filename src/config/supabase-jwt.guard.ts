import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private configService: ConfigService) {
    const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token JWT no encontrado');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.configService.get<string>('SUPABASE_PROJECT_URL'),
        audience: 'authenticated',
      });

      // Agregar información del usuario al request
      request.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role || 'usuario',
        aud: payload.aud,
        exp: payload.exp,
        iat: payload.iat,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token JWT inválido');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
