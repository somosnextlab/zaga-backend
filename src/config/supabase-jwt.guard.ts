import { JwksClientService } from '@adapters/jwks.client';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { jwtVerify, createRemoteJWKSet } from 'jose';

import { IS_PUBLIC_KEY } from './roles.decorator';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private jwksClient: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwksClientService: JwksClientService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    this.jwksClient = this.jwksClientService.getClient();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verificar si el endpoint es público
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    // En modo desarrollo, si no hay configuración de Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    const supabaseAuthUrl = supabaseUrl ? `${supabaseUrl}/auth/v1` : 'https://example.supabase.co/auth/v1';
    const isDevelopment = !supabaseUrl || supabaseUrl === 'https://example.supabase.co';
    
    if (isDevelopment) {
      // Si no hay token, permitir acceso con usuario de desarrollo por defecto
      if (!token) {
        request.user = {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'dev@example.com',
          email_verified: true,
          rol: 'cliente',
          persona_id: '550e8400-e29b-41d4-a716-446655440001',
        };
        return true;
      }

      // Si hay token, intentar validarlo como JWT local (solo en desarrollo)
      try {
        const payload = this.jwtService.verify(token);
        
        // Validar que el rol sea válido
        const validRoles = ['admin', 'cliente'];
        const finalRole = payload.rol && validRoles.includes(payload.rol) 
          ? payload.rol 
          : 'cliente';

        request.user = {
          user_id: payload.sub,
          email: payload.email,
          email_verified: true, // En desarrollo siempre true
          rol: finalRole,
          persona_id: payload.persona_id,
        };
        return true;
      } catch (error) {
        // Si el token JWT local es inválido, usar usuario por defecto
        request.user = {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'dev@example.com',
          email_verified: true,
          rol: 'cliente',
          persona_id: '550e8400-e29b-41d4-a716-446655440001',
        };
        return true;
      }
    }

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      // Obtener la clave secreta de Supabase
      const supabaseSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      
      let payload;
      if (supabaseSecret && supabaseSecret !== 'your_jwt_secret_key_here') {
        // Usar clave secreta de Supabase para validación HS256
        const secretKey = new TextEncoder().encode(supabaseSecret);
        const result = await jwtVerify(token, secretKey, {
          issuer: supabaseAuthUrl,
          audience: 'authenticated',
        });
        payload = result.payload;
      } else {
        // Fallback a JWKS si no hay clave secreta configurada
        const { payload: jwksPayload } = await jwtVerify(token, this.jwksClient, {
          issuer: supabaseAuthUrl,
          audience: 'authenticated',
        });
        payload = jwksPayload;
      }

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
        email_verified: payload.email_verified || false, // ✅ Del JWT de Supabase
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
