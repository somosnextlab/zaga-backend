import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';
import { Logger } from '@shared/logger';
import { CreatePerfilDto } from './dtos/create-perfil.dto';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    this.logger.log('Obteniendo todos los usuarios');

    try {
      const usuarios = await this.prisma.seguridad_usuarios.findMany();

      return {
        success: true,
        data: usuarios,
        count: usuarios.length,
      };
    } catch (error) {
      this.logger.error('Error al obtener usuarios:', error);
      throw new Error('Error al obtener usuarios');
    }
  }

  async findMe(userId: string) {
    this.logger.log(`Obteniendo perfil del usuario: ${userId}`);

    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario) {
        return {
          success: false,
          message: 'Usuario no encontrado',
        };
      }

      // Si tiene persona_id, obtener datos de la persona
      let persona = null;
      if (usuario.persona_id) {
        persona = await this.prisma.financiera_personas.findUnique({
          where: { id: usuario.persona_id },
        });
      }

      return {
        success: true,
        data: {
          ...usuario,
          persona,
        },
      };
    } catch (error) {
      this.logger.error('Error al obtener perfil del usuario:', error);
      throw new Error('Error al obtener perfil del usuario');
    }
  }

  async crearPerfil(createPerfilDto: CreatePerfilDto, userId: string) {
    this.logger.log(`Creando perfil para usuario: ${userId}`);

    try {
      // Verificar si el usuario ya tiene un perfil
      const usuarioExistente = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (usuarioExistente?.persona_id) {
        return {
          success: false,
          message: 'El usuario ya tiene un perfil creado',
        };
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

      // Actualizar usuario con persona_id
      await this.prisma.seguridad_usuarios.update({
        where: { user_id: userId },
        data: { persona_id: persona.id },
      });

      // Crear cliente
      await this.prisma.financiera_clientes.create({
        data: {
          persona_id: persona.id,
          estado: 'activo',
        },
      });

      this.logger.log(`Perfil creado exitosamente para usuario: ${userId}`);

      return {
        success: true,
        message: 'Perfil creado exitosamente',
        data: {
          persona_id: persona.id,
          nombre: persona.nombre,
          apellido: persona.apellido,
        },
      };
    } catch (error) {
      this.logger.error('Error al crear perfil:', error);
      throw new Error('Error al crear perfil del usuario');
    }
  }
}
