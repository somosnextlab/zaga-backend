import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token JWT no encontrado');
    }

    try {
      // Decodificar el JWT sin verificar la firma
      const parts = token.split('.');
      
      if (parts.length !== 3) {
        throw new UnauthorizedException('Token JWT malformado');
      }

      const decodedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString(),
      );

      console.log('🔍 JWT decodificado:', {
        sub: decodedPayload.sub,
        email: decodedPayload.email,
        role: decodedPayload.role,
        exp: decodedPayload.exp,
        iat: decodedPayload.iat,
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
        accessToken: token,
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
