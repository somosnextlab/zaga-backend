import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';

// Tipos de roles permitidos
export type UserRole = 'admin' | 'usuario' | 'cliente';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Decorador para marcar endpoints como públicos (sin autenticación)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
