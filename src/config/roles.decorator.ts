import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Tipos de roles permitidos
export type UserRole = 'admin' | 'cliente';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
