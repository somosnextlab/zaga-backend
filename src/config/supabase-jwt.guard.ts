import { JwksClientService } from '@adapters/jwks.client';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface SupabaseUser {
  user_id: string;
  email: string;
  rol: string;
  persona_id?: string;
  cliente_id?: string;
  app_metadata?: {
    cliente_id?: string;
    role?: string;
  };
  user_metadata?: {
    rol?: string;
    persona_id?: string;
  };
}

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  user_metadata?: {
    rol?: string;
    persona_id?: string;
  };
  app_metadata?: {
    cliente_id?: string;
    role?: string;
  };
}

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
        cliente_id: 'dev-cliente-id',
        app_metadata: {
          cliente_id: 'dev-cliente-id',
          role: 'admin',
        },
      } as SupabaseUser;
      request.userToken = 'dev-token';
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
      const userPayload = payload as unknown as SupabaseJwtPayload;
      request.user = {
        user_id: userPayload.sub,
        email: userPayload.email,
        rol: userPayload.user_metadata?.rol || userPayload.app_metadata?.role || 'cliente',
        persona_id: userPayload.user_metadata?.persona_id,
        cliente_id: userPayload.app_metadata?.cliente_id,
        app_metadata: userPayload.app_metadata,
        user_metadata: userPayload.user_metadata,
      } as SupabaseUser;
      
      // Adjuntar el token para uso posterior en servicios Supabase
      request.userToken = token;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractTokenFromHeader(request: {
    headers: { authorization?: string };
  }): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
