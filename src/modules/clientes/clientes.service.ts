import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueryClientesDto } from './dto/query-clientes.dto';
import {
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
} from '../../common/interfaces/user.interface';

export interface ClienteWithPersona {
  id: string;
  estado: string;
  created_at: Date;
  updated_at: Date;
  persona: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    tipo_doc: string;
    numero_doc: string;
  };
}

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Obtiene lista de clientes con paginación y filtros
   * Accesible para usuarios con rol 'admin' (ve todo) o 'usuario' (ve solo sus clientes)
   *
   * @param userId - ID del usuario autenticado
   * @param userRole - Rol del usuario autenticado
   * @param query - Parámetros de consulta (paginación y filtros)
   * @param accessToken - JWT token del usuario autenticado
   * @returns Promise con lista paginada de clientes
   */
  async findAll(
    userId: string,
    userRole: string,
    query: QueryClientesDto,
    _accessToken: string,
  ): Promise<PaginatedResponse<ClienteWithPersona>> {
    try {
      // Crear cliente Supabase on-behalf-of para respetar RLS
      // const _supabaseClient = this.supabaseService.createClientForUser(accessToken);

      // Calcular offset para paginación
      const skip = (query.page - 1) * query.limit;

      // Construir filtros dinámicos
      const where: any = {};

      if (query.estado) {
        where.estado = query.estado;
      }

      // Si no es admin, filtrar por usuario asociado
      if (userRole !== 'admin') {
        // Para usuarios no-admin, necesitamos filtrar por la relación usuario->persona->cliente
        where.persona = {
          usuario: {
            user_id: userId,
          },
        };
      }

      // Consultar clientes con datos de persona
      const [clientes, total] = await Promise.all([
        this.prisma.cliente.findMany({
          where,
          include: {
            persona: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                tipo_doc: true,
                numero_doc: true,
              },
            },
          },
          skip,
          take: query.limit,
          orderBy: {
            created_at: 'desc',
          },
        }),
        this.prisma.cliente.count({ where }),
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
        data: clientes as ClienteWithPersona[],
        meta,
      };
    } catch (error) {
      console.error('Error obteniendo lista de clientes:', error);

      throw new Error('Error interno del servidor al obtener clientes');
    }
  }

  /**
   * Obtiene un cliente específico por ID
   * Accesible para usuarios con rol 'admin' o 'usuario' (solo sus clientes)
   *
   * @param clienteId - ID del cliente a consultar
   * @param userId - ID del usuario autenticado
   * @param userRole - Rol del usuario autenticado
   * @param accessToken - JWT token del usuario autenticado
   * @returns Promise con datos del cliente
   */
  async findOne(
    clienteId: string,
    userId: string,
    userRole: string,
    _accessToken: string,
  ): Promise<ApiResponse<ClienteWithPersona>> {
    try {
      // Crear cliente Supabase on-behalf-of para respetar RLS
      // const _supabaseClient = this.supabaseService.createClientForUser(accessToken);

      // Construir filtros según el rol
      const where: any = {
        id: clienteId,
      };

      // Si no es admin, filtrar por usuario asociado
      if (userRole !== 'admin') {
        where.persona = {
          usuario: {
            user_id: userId,
          },
        };
      }

      const cliente = await this.prisma.cliente.findFirst({
        where,
        include: {
          persona: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
              tipo_doc: true,
              numero_doc: true,
            },
          },
        },
      });

      if (!cliente) {
        return {
          success: false,
          error: 'Cliente no encontrado o sin permisos para acceder',
        };
      }

      return {
        success: true,
        data: cliente as ClienteWithPersona,
      };
    } catch (error) {
      console.error('Error obteniendo cliente:', error);

      return {
        success: false,
        error: 'Error interno del servidor al obtener cliente',
      };
    }
  }

  /**
   * Valida que el usuario tenga permisos para acceder a clientes
   *
   * @param accessToken - JWT token del usuario
   * @returns Promise<{isValid: boolean, role: string}> - información del usuario
   */
  async validateUserAccess(
    accessToken: string,
  ): Promise<{ isValid: boolean; role: string }> {
    try {
      const user = await this.supabaseService.getUserFromToken(accessToken);

      if (!user) {
        return { isValid: false, role: '' };
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

      const isValid =
        usuario &&
        ['admin', 'usuario'].includes(usuario.rol) &&
        usuario.estado === 'activo';

      return {
        isValid,
        role: usuario?.rol || '',
      };
    } catch (error) {
      console.error('Error validando acceso de usuario:', error);
      return { isValid: false, role: '' };
    }
  }
}
