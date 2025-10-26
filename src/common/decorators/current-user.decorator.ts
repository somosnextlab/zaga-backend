import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserFromJWT {
  sub: string; // ID del usuario en Supabase
  email: string; // Email del usuario
  role: string; // Rol del usuario (admin/usuario/cliente)
  aud: string; // Audience del JWT
  exp: number; // Timestamp de expiración
  iat: number; // Timestamp de emisión
  accessToken: string; // Token JWT original
}

/**
 * Decorador para extraer información del usuario autenticado del request
 *
 * Este decorador obtiene la información del usuario que fue agregada al request
 * por el SupabaseJwtGuard después de validar el JWT.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserFromJWT) {
 *   return { userId: user.sub, email: user.email, role: user.role };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserFromJWT => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
