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
      console.log('🔍 Buscando usuario con ID:', userId);
      
      // Consultar usuario con datos de persona usando Prisma
      let usuario = await this.prisma.usuario.findUnique({
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
        console.log('❌ Usuario no encontrado, creando usuario...');
        
        // Crear usuario (admin no necesita persona)
        const nuevoUsuario = await this.prisma.usuario.create({
          data: {
            user_id: userId,
            persona_id: null, // Admin no tiene persona
            rol: 'admin',
            estado: 'activo',
          },
        });

        console.log('✅ Usuario admin creado:', nuevoUsuario.user_id);

        // Actualizar usuario para el resto del flujo
        usuario = {
          ...nuevoUsuario,
          persona: null, // Admin no tiene persona
        };
      }

      // Solo usuarios y clientes necesitan persona (no admins)
      if (!usuario.persona && (usuario.rol === 'usuario' || usuario.rol === 'cliente')) {
        console.log('⚠️ Usuario sin persona, creando datos temporales...');
        
        const persona = await this.prisma.persona.create({
          data: {
            tipo_doc: 'DNI',
            numero_doc: '00000000',
            nombre: 'Usuario',
            apellido: 'Temporal',
            email: 'usuario@temporal.com',
            telefono: null,
          },
        });

        // Actualizar usuario con persona_id
        await this.prisma.usuario.update({
          where: { user_id: userId },
          data: { persona_id: persona.id },
        });

        usuario.persona = {
          id: persona.id,
          nombre: persona.nombre,
          apellido: persona.apellido,
          email: persona.email,
          telefono: persona.telefono,
        };

        console.log('✅ Persona creada y asociada:', persona.id);
      }

      const profile: UserProfile = {
        userId: usuario.user_id,
        email: usuario.persona?.email || 'admin@zaga.com', // Admin usa email del JWT
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

  /**
   * Crea el usuario en la base de datos si no existe
   *
   * @param user - Datos del usuario del JWT
   * @returns Promise con el resultado de la creación
   */
  async createUserIfNotExists(user: any): Promise<ApiResponse> {
    try {
      console.log('🔍 Verificando si el usuario existe:', user.sub);

      // Verificar si el usuario ya existe
      const existingUser = await this.prisma.usuario.findUnique({
        where: {
          user_id: user.sub,
        },
      });

      if (existingUser) {
        console.log('✅ Usuario ya existe en la base de datos');
        return {
          success: true,
          data: { message: 'Usuario ya existe' },
        };
      }

      // Crear persona primero
      const persona = await this.prisma.persona.create({
        data: {
          tipo_doc: 'DNI',
          numero_doc: '00000000', // Temporal
          nombre: 'Usuario',
          apellido: 'Temporal',
          email: user.email,
          telefono: null,
        },
      });

      console.log('✅ Persona creada:', persona.id);

      // Crear usuario
      const usuario = await this.prisma.usuario.create({
        data: {
          user_id: user.sub,
          persona_id: persona.id,
          rol: 'usuario',
          estado: 'activo',
        },
      });

      console.log('✅ Usuario creado:', usuario.user_id);

      return {
        success: true,
        data: {
          message: 'Usuario creado exitosamente',
          userId: usuario.user_id,
          personaId: persona.id,
        },
      };
    } catch (error) {
      console.error('❌ Error creando usuario:', error);
      return {
        success: false,
        error: 'Error creando usuario: ' + error.message,
      };
    }
  }
}
