import { JwksClientService } from '@adapters/jwks.client';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet,jwtVerify } from 'jose';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private jwksClient: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwksClientService: JwksClientService,
  ) {
    this.jwksClient = this.jwksClientService.getClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    // En modo desarrollo, si no hay configuración de Supabase, permitir acceso
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
      request.user = {
        user_id: 'dev-user',
        email: 'dev@example.com',
        rol: 'admin',
        persona_id: 'dev-persona-id',
      };
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwksClient, {
        issuer: supabaseUrl,
        audience: 'authenticated',
      });

      // Extraer información del usuario del payload
      request.user = {
        user_id: payload.sub,
        email: payload.email,
        rol: (payload as any).user_metadata?.rol || 'cliente',
        persona_id: (payload as any).user_metadata?.persona_id,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
