import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from '@shared/logger';
import { PrismaService } from '@shared/prisma.service';

import { CambiarEmailDto } from './dtos/cambiar-email.dto';
import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UpdatePerfilDto } from './dtos/update-perfil.dto';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 10) {
    this.logger.log(`Obteniendo usuarios - página: ${page}, límite: ${limit}`);

    try {
      const skip = (page - 1) * limit;

      const [usuarios, total] = await Promise.all([
        this.prisma.seguridad_usuarios.findMany({
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.seguridad_usuarios.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: usuarios,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Error al obtener usuarios:', error);
      throw new Error('Error al obtener usuarios');
    }
  }

  async findOne(userId: string) {
    this.logger.log(`Obteniendo usuario por ID: ${userId}`);

    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Si tiene persona_id, obtener datos de la persona
      let persona = null;
      if (usuario.persona_id) {
        persona = await this.prisma.financiera_personas.findUnique({
          where: { id: usuario.persona_id },
        });
      }

      return {
        ...usuario,
        persona,
      };
    } catch (error) {
      this.logger.error('Error al obtener usuario:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al obtener usuario');
    }
  }

  async updateMe(updatePerfilDto: UpdatePerfilDto, userId: string) {
    this.logger.log(`Actualizando perfil para usuario: ${userId}`);

    try {
      // Verificar si el usuario existe y tiene perfil
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!usuario.persona_id) {
        throw new NotFoundException('El usuario no tiene un perfil creado');
      }

      // Actualizar datos de la persona
      const personaActualizada = await this.prisma.financiera_personas.update({
        where: { id: usuario.persona_id },
        data: {
          ...(updatePerfilDto.nombre && { nombre: updatePerfilDto.nombre }),
          ...(updatePerfilDto.apellido && {
            apellido: updatePerfilDto.apellido,
          }),
          // Email no se puede actualizar por seguridad
          ...(updatePerfilDto.telefono && {
            telefono: updatePerfilDto.telefono,
          }),
          ...(updatePerfilDto.fecha_nac && {
            fecha_nac: new Date(updatePerfilDto.fecha_nac),
          }),
        },
      });

      this.logger.log(
        `Perfil actualizado exitosamente para usuario: ${userId}`,
      );

      return {
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          user_id: usuario.user_id,
          persona_id: personaActualizada.id,
          nombre: personaActualizada.nombre,
          apellido: personaActualizada.apellido,
          email: personaActualizada.email,
          telefono: personaActualizada.telefono,
          fecha_nac: personaActualizada.fecha_nac,
        },
      };
    } catch (error) {
      this.logger.error('Error al actualizar perfil:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al actualizar perfil del usuario');
    }
  }

  async deactivateUser(userId: string) {
    this.logger.log(`Desactivando usuario: ${userId}`);

    try {
      // Verificar si el usuario existe
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (usuario.estado === 'inactivo') {
        return {
          success: false,
          message: 'El usuario ya está desactivado',
        };
      }

      // Desactivar usuario (soft delete)
      await this.prisma.seguridad_usuarios.update({
        where: { user_id: userId },
        data: { estado: 'inactivo' },
      });

      // Si tiene cliente asociado, también desactivarlo
      if (usuario.persona_id) {
        await this.prisma.financiera_clientes.updateMany({
          where: { persona_id: usuario.persona_id },
          data: { estado: 'inactivo' },
        });
      }

      this.logger.log(`Usuario desactivado exitosamente: ${userId}`);

      return {
        success: true,
        message: 'Usuario desactivado exitosamente',
      };
    } catch (error) {
      this.logger.error('Error al desactivar usuario:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al desactivar usuario');
    }
  }

  async registroInicial(userId: string) {
    this.logger.log(`Registro inicial para usuario: ${userId}`);

    try {
      // Verificar si el usuario ya existe
      const usuarioExistente = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (usuarioExistente) {
        throw new ConflictException('El usuario ya está registrado');
      }

      // Crear usuario con rol 'usuario'
      const usuario = await this.prisma.seguridad_usuarios.create({
        data: {
          user_id: userId,
          rol: 'usuario',
          estado: 'activo',
        },
      });

      this.logger.log(`Usuario registrado exitosamente: ${userId}`);

      return {
        success: true,
        message:
          'Usuario registrado exitosamente. Ahora puedes cargar tus datos personales.',
        data: {
          user_id: usuario.user_id,
          rol: usuario.rol,
          estado: usuario.estado,
        },
      };
    } catch (error) {
      this.logger.error('Error en registro inicial:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Error en registro inicial');
    }
  }

  async crearPerfil(createPerfilDto: CreatePerfilDto, userId: string) {
    this.logger.log(`Creando perfil para usuario: ${userId}`);

    try {
      // Verificar si el usuario existe y tiene rol 'usuario'
      const usuarioExistente = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuarioExistente) {
        throw new ConflictException(
          'Usuario no registrado. Debe hacer registro inicial primero.',
        );
      }

      if (usuarioExistente.rol !== 'usuario') {
        throw new ConflictException(
          'El usuario ya tiene un perfil completo creado',
        );
      }

      if (usuarioExistente.persona_id) {
        throw new ConflictException('El usuario ya tiene un perfil creado');
      }

      // Verificar si ya existe una persona con el mismo documento
      const personaExistente = await this.prisma.financiera_personas.findFirst({
        where: {
          tipo_doc: createPerfilDto.tipo_doc,
          numero_doc: createPerfilDto.numero_doc,
        },
      });

      if (personaExistente) {
        throw new ConflictException(
          `Ya existe una persona con ${createPerfilDto.tipo_doc} número ${createPerfilDto.numero_doc}`,
        );
      }

      // Verificar si ya existe una persona con el mismo email
      const emailExistente = await this.prisma.financiera_personas.findFirst({
        where: {
          email: createPerfilDto.email,
        },
      });

      if (emailExistente) {
        throw new ConflictException(
          `Ya existe una cuenta con el email ${createPerfilDto.email}`,
        );
      }

      // Crear persona
      const persona = await this.prisma.financiera_personas.create({
        data: {
          tipo_doc: createPerfilDto.tipo_doc,
          numero_doc: createPerfilDto.numero_doc,
          nombre: createPerfilDto.nombre,
          apellido: createPerfilDto.apellido,
          email: createPerfilDto.email,
          telefono: createPerfilDto.telefono,
          fecha_nac: createPerfilDto.fecha_nac
            ? new Date(createPerfilDto.fecha_nac)
            : null,
        },
      });

      // Actualizar usuario con persona_id y cambiar rol a 'cliente'
      await this.prisma.seguridad_usuarios.update({
        where: { user_id: userId },
        data: {
          persona_id: persona.id,
          rol: 'cliente', // Cambiar rol a cliente al cargar datos personales
        },
      });

      // ✅ CREAR CLIENTE INMEDIATAMENTE (sin esperar verificación)
      await this.prisma.financiera_clientes.create({
        data: {
          persona_id: persona.id,
          estado: 'activo',
        },
      });

      this.logger.log(
        `Perfil y cliente creados exitosamente para usuario: ${userId}`,
      );

      return {
        success: true,
        message: 'Perfil creado exitosamente. Ya puedes usar la plataforma.',
        data: {
          persona_id: persona.id,
          nombre: persona.nombre,
          apellido: persona.apellido,
        },
      };
    } catch (error) {
      this.logger.error('Error al crear perfil:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Error al crear perfil del usuario');
    }
  }

  async cambiarEmail(userId: string, cambiarEmailDto: CambiarEmailDto) {
    this.logger.log(`Cambiando email para usuario: ${userId}`);

    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario || !usuario.persona_id) {
        throw new NotFoundException('Usuario o perfil no encontrado');
      }

      // Verificar email único
      const emailExistente = await this.prisma.financiera_personas.findFirst({
        where: {
          email: cambiarEmailDto.email,
          id: { not: usuario.persona_id },
        },
      });

      if (emailExistente) {
        throw new ConflictException('El email ya está en uso');
      }

      // Actualizar email
      await this.prisma.financiera_personas.update({
        where: { id: usuario.persona_id },
        data: { email: cambiarEmailDto.email },
      });

      // ⚠️ IMPORTANTE: El admin debe actualizar también en Supabase manualmente
      this.logger.warn(
        `Email cambiado en BD. RECORDAR actualizar en Supabase Auth manualmente.`,
      );

      return {
        success: true,
        message:
          'Email actualizado. El usuario debe actualizar su email en Supabase Auth.',
        motivo: cambiarEmailDto.motivo,
      };
    } catch (error) {
      this.logger.error('Error al cambiar email:', error);
      throw error;
    }
  }

  /**
   * Obtiene el rol del usuario autenticado
   * @param userId - ID del usuario autenticado
   * @returns Objeto con el rol del usuario
   */
  async obtenerRolUsuario(userId: string) {
    this.logger.log(`Obteniendo rol para usuario: ${userId}`);

    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
        select: {
          rol: true,
          estado: true,
        },
      });

      if (!usuario) {
        throw new NotFoundException(
          'Usuario no encontrado en la base de datos',
        );
      }

      if (usuario.estado !== 'activo') {
        throw new NotFoundException('Usuario inactivo');
      }

      this.logger.log(
        `Rol obtenido exitosamente para usuario ${userId}: ${usuario.rol}`,
      );

      return {
        success: true,
        role: usuario.rol,
      };
    } catch (error) {
      this.logger.error('Error al obtener rol del usuario:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al obtener rol del usuario');
    }
  }
}
