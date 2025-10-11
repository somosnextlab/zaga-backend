import { JwksClientService } from '@adapters/jwks.client';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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
        user_id: '550e8400-e29b-41d4-a716-446655440000', // UUID válido para desarrollo
        email: 'dev@example.com',
        rol: 'cliente', // Rol válido para desarrollo
        persona_id: '550e8400-e29b-41d4-a716-446655440001', // UUID válido para desarrollo
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
      const userMetadata = (
        payload as { user_metadata?: { rol?: string; persona_id?: string } }
      ).user_metadata;
      const userRole = userMetadata?.rol;

      // Validar que el rol sea válido, si no, asignar 'cliente' por defecto
      const validRoles = ['admin', 'cliente'];
      const finalRole =
        userRole && validRoles.includes(userRole) ? userRole : 'cliente';

      request.user = {
        user_id: payload.sub,
        email: payload.email,
        rol: finalRole,
        persona_id: userMetadata?.persona_id,
      };

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
