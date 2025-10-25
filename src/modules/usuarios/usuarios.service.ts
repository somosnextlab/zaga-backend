import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import {
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
} from '../../common/interfaces/user.interface';

export interface UsuarioWithPersona {
  user_id: string;
  rol: string;
  estado: string;
  created_at: Date;
  updated_at: Date;
  persona: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
  };
}

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Obtiene lista de usuarios con paginación y filtros
   * Solo accesible para usuarios con rol 'admin'
   *
   * @param query - Parámetros de consulta (paginación y filtros)
   * @param accessToken - JWT token del usuario autenticado
   * @returns Promise con lista paginada de usuarios
   */
  async findAll(
    query: QueryUsuariosDto,
    _accessToken: string,
  ): Promise<PaginatedResponse<UsuarioWithPersona>> {
    try {
      // Crear cliente Supabase on-behalf-of para respetar RLS
      // const _supabaseClient = this.supabaseService.createClientForUser(accessToken);

      // Calcular offset para paginación
      const skip = (query.page - 1) * query.limit;

      // Construir filtros dinámicos
      const where: any = {};

      if (query.rol) {
        where.rol = query.rol;
      }

      if (query.estado) {
        where.estado = query.estado;
      }

      // Consultar usuarios con datos de persona
      const [usuarios, total] = await Promise.all([
        this.prisma.usuario.findMany({
          where,
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
          skip,
          take: query.limit,
          orderBy: {
            created_at: 'desc',
          },
        }),
        this.prisma.usuario.count({ where }),
      ]);

      // Calcular metadatos de paginación
      const totalPages = Math.ceil(total / query.limit);
      const meta: PaginationMeta = {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      };

      return {
        success: true,
        data: usuarios as UsuarioWithPersona[],
        meta,
      };
    } catch (error) {
      console.error('Error obteniendo lista de usuarios:', error);

      throw new Error('Error interno del servidor al obtener usuarios');
    }
  }

  /**
   * Obtiene un usuario específico por ID
   * Solo accesible para usuarios con rol 'admin'
   *
   * @param userId - ID del usuario a consultar
   * @param accessToken - JWT token del usuario autenticado
   * @returns Promise con datos del usuario
   */
  async findOne(
    userId: string,
    _accessToken: string,
  ): Promise<ApiResponse<UsuarioWithPersona>> {
    try {
      // Crear cliente Supabase on-behalf-of para respetar RLS
      // const _supabaseClient = this.supabaseService.createClientForUser(accessToken);

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
        return {
          success: false,
          error: 'Usuario no encontrado',
        };
      }

      return {
        success: true,
        data: usuario as UsuarioWithPersona,
      };
    } catch (error) {
      console.error('Error obteniendo usuario:', error);

      return {
        success: false,
        error: 'Error interno del servidor al obtener usuario',
      };
    }
  }

  /**
   * Valida que el usuario tenga permisos de administrador
   *
   * @param accessToken - JWT token del usuario
   * @returns Promise<boolean> - true si es admin
   */
  async validateAdminAccess(accessToken: string): Promise<boolean> {
    try {
      const user = await this.supabaseService.getUserFromToken(accessToken);

      if (!user) {
        return false;
      }

      // Verificar rol en la base de datos
      const usuario = await this.prisma.usuario.findUnique({
        where: {
          user_id: user.id,
        },
        select: {
          rol: true,
          estado: true,
        },
      });

      return usuario?.rol === 'admin' && usuario?.estado === 'activo';
    } catch (error) {
      console.error('Error validando acceso de administrador:', error);
      return false;
    }
  }
}
