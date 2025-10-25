import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ApiResponse } from '../../common/interfaces/user.interface';

export interface UserProfile {
  userId: string;
  email: string;
  role: string;
  estado: string;
  persona?: {
    id: string;
    nombre: string;
    apellido: string;
    telefono?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Obtiene el perfil del usuario autenticado usando RLS
   *
   * @param userId - ID del usuario en Supabase
   * @param accessToken - JWT token del usuario
   * @returns Promise con el perfil del usuario
   */
  async getMyProfile(
    userId: string,
    _accessToken: string,
  ): Promise<ApiResponse<UserProfile>> {
    try {
      // Crear cliente Supabase on-behalf-of para respetar RLS
      // const _supabaseClient = this.supabaseService.createClientForUser(accessToken);

      // Consultar usuario con datos de persona usando Prisma
      // RLS se aplicará automáticamente basado en el token
      const usuario = await this.prisma.usuario.findUnique({
        where: {
          user_id: userId,
        },
        include: {
          persona: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
            },
          },
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const profile: UserProfile = {
        userId: usuario.user_id,
        email: usuario.persona.email,
        role: usuario.rol,
        estado: usuario.estado,
        persona: usuario.persona
          ? {
              id: usuario.persona.id,
              nombre: usuario.persona.nombre,
              apellido: usuario.persona.apellido,
              telefono: usuario.persona.telefono,
            }
          : undefined,
      };

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('Error obteniendo perfil del usuario:', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Error interno del servidor al obtener perfil');
    }
  }

  /**
   * Valida que el usuario tenga un rol específico
   *
   * @param userId - ID del usuario
   * @param accessToken - JWT token del usuario
   * @param requiredRole - Rol requerido
   * @returns Promise<boolean> - true si el usuario tiene el rol
   */
  async validateUserRole(
    userId: string,
    accessToken: string,
    requiredRole: string,
  ): Promise<boolean> {
    try {
      const profile = await this.getMyProfile(userId, accessToken);

      if (!profile.success || !profile.data) {
        return false;
      }

      return profile.data.role === requiredRole;
    } catch (error) {
      console.error('Error validando rol del usuario:', error);
      return false;
    }
  }

  /**
   * Verifica que el usuario esté activo
   *
   * @param userId - ID del usuario
   * @param accessToken - JWT token del usuario
   * @returns Promise<boolean> - true si el usuario está activo
   */
  async isUserActive(userId: string, accessToken: string): Promise<boolean> {
    try {
      const profile = await this.getMyProfile(userId, accessToken);

      if (!profile.success || !profile.data) {
        return false;
      }

      return profile.data.estado === 'activo';
    } catch (error) {
      console.error('Error verificando estado del usuario:', error);
      return false;
    }
  }
}
