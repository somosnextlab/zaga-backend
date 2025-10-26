import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
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
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene el perfil del usuario autenticado
   *
   * @param userId - ID del usuario en Supabase
   * @param accessToken - JWT token del usuario
   * @returns Promise con el perfil del usuario o error si no existe
   */
  async getMyProfile(
    userId: string,
    _accessToken: string,
  ): Promise<ApiResponse<UserProfile>> {
    try {
      console.log('🔍 Buscando usuario con ID:', userId);

      // Buscar el usuario en la tabla usuarios usando el user_id del JWT
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

      console.log('📋 Usuario encontrado:', usuario);

      if (!usuario) {
        console.log('❌ Usuario no encontrado en la base de datos');
        return {
          success: false,
          error: 'Usuario no encontrado. Debe registrarse primero.',
        };
      }

      if (!usuario.persona) {
        console.log('❌ Usuario sin persona asociada');
        return {
          success: false,
          error: 'Usuario sin datos de persona asociados.',
        };
      }

      const profile: UserProfile = {
        userId: usuario.user_id,
        email: usuario.persona.email || 'email_no_disponible@zaga.com',
        role: usuario.rol,
        estado: usuario.estado,
        persona: {
          id: usuario.persona.id,
          nombre: usuario.persona.nombre,
          apellido: usuario.persona.apellido,
          telefono: usuario.persona.telefono,
        },
      };

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      console.error('❌ Error obteniendo perfil del usuario:', error);
      return {
        success: false,
        error: `Error interno del servidor: ${error.message}`,
      };
    }
  }
}
