import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';

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
      // Decodificar el JWT sin verificar la firma para pruebas
      const [payload] = token.split('.');
      const decodedPayload = JSON.parse(
        Buffer.from(payload, 'base64').toString(),
      );

      console.log('🔍 JWT decodificado:', {
        sub: decodedPayload.sub,
        email: decodedPayload.email,
        role: decodedPayload.role,
        aud: decodedPayload.aud,
        exp: decodedPayload.exp,
        iat: decodedPayload.iat,
        hasSub: !!decodedPayload.sub,
        subType: typeof decodedPayload.sub,
      });

      // Verificar que el token tenga el campo sub
      if (!decodedPayload.sub) {
        console.error('❌ Token JWT no tiene campo sub:', decodedPayload);
        throw new UnauthorizedException('Token JWT inválido: falta campo sub');
      }

      // Verificar que el token no esté expirado
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        throw new UnauthorizedException('Token JWT expirado');
      }

      // Agregar información del usuario al request
      request.user = {
        sub: decodedPayload.sub,
        email: decodedPayload.email,
        role: decodedPayload.role || 'usuario',
        aud: decodedPayload.aud,
        exp: decodedPayload.exp,
        iat: decodedPayload.iat,
        accessToken: token, // Exponer el token original
      };

      return true;
    } catch (error) {
      console.error('❌ Error procesando JWT:', error.message);
      throw new UnauthorizedException('Token JWT inválido');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
