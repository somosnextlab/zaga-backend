import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, UserRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user?.rol) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Validar que el rol del usuario sea válido
    const validRoles: UserRole[] = ['admin', 'usuario', 'cliente'];
    if (!validRoles.includes(user.rol as UserRole)) {
      throw new ForbiddenException(
        `Rol '${user.rol}' no es válido. Roles permitidos: ${validRoles.join(', ')}`,
      );
    }

    return requiredRoles.some((role) => user.rol === role);
  }
}
