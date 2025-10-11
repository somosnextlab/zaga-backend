import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '@shared/email.service';
import { Logger } from '@shared/logger';
import { PrismaService } from '@shared/prisma.service';

import { CambiarEmailDto } from './dtos/cambiar-email.dto';
import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UpdatePerfilDto } from './dtos/update-perfil.dto';
import { EmailVerificationService } from './services/email-verification.service';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly emailService: EmailService,
  ) {}

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

  async findMe(userId: string) {
    this.logger.log(`Obteniendo perfil del usuario: ${userId}`);

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
      this.logger.error('Error al obtener perfil del usuario:', error);
      throw new Error('Error al obtener perfil del usuario');
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

  async crearPerfil(createPerfilDto: CreatePerfilDto, userId: string) {
    this.logger.log(`Creando perfil para usuario: ${userId}`);

    try {
      // Verificar si el usuario ya tiene un perfil
      let usuarioExistente = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      // Si el usuario no existe, crearlo
      if (!usuarioExistente) {
        this.logger.log(`Usuario no existe, creándolo: ${userId}`);
        usuarioExistente = await this.prisma.seguridad_usuarios.create({
          data: {
            user_id: userId,
            rol: 'cliente',
            estado: 'activo',
            email_verificado: false,
          },
        });
      }

      if (usuarioExistente.persona_id) {
        return {
          success: false,
          message: 'El usuario ya tiene un perfil creado',
        };
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

      // Crear persona (SIN crear cliente aún)
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

      // Crear token de verificación de email si hay email
      let tokenVerificacion = null;
      if (createPerfilDto.email) {
        tokenVerificacion =
          await this.emailVerificationService.createVerificationToken(
            userId,
            'email_verification',
          );

        // Enviar email de verificación
        try {
          await this.emailService.sendVerificationEmail(
            createPerfilDto.email,
            tokenVerificacion,
          );
          this.logger.log(
            `Email de verificación enviado a: ${createPerfilDto.email}`,
          );
        } catch (error) {
          this.logger.error('Error al enviar email de verificación:', error);
          // Si falla el envío del email, lanzamos error para que el usuario sepa
          throw new Error('Error al enviar email de verificación. Por favor, intenta nuevamente.');
        }
      }

      this.logger.log(`Perfil creado exitosamente para usuario: ${userId} (pendiente de verificación)`);

      return {
        success: true,
        message: createPerfilDto.email
          ? 'Perfil creado exitosamente. Se ha enviado un email de verificación. Debes verificar tu email para completar el registro.'
          : 'Perfil creado exitosamente',
        data: {
          persona_id: persona.id,
          nombre: persona.nombre,
          apellido: persona.apellido,
          email_verificado: false,
        },
        // En desarrollo, devolver el token para testing
        token:
          process.env.NODE_ENV === 'development'
            ? tokenVerificacion
            : undefined,
      };
    } catch (error) {
      this.logger.error('Error al crear perfil:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Error al crear perfil del usuario');
    }
  }

  async verificarEmail(token: string) {
    this.logger.log(`Verificando email con token: ${token}`);

    try {
      const userId = await this.emailVerificationService.verifyToken(
        token,
        'email_verification',
      );
      
      // Marcar email como verificado
      await this.emailVerificationService.markEmailAsVerified(userId);

      // Obtener usuario para crear el cliente
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario || !usuario.persona_id) {
        throw new NotFoundException('Usuario o perfil no encontrado');
      }

      // Verificar si ya existe un cliente para esta persona
      const clienteExistente = await this.prisma.financiera_clientes.findFirst({
        where: { persona_id: usuario.persona_id },
      });

      // Solo crear cliente si no existe
      if (!clienteExistente) {
        await this.prisma.financiera_clientes.create({
          data: {
            persona_id: usuario.persona_id,
            estado: 'activo',
          },
        });
        this.logger.log(`Cliente creado para persona: ${usuario.persona_id}`);
      }

      this.logger.log(`Email verificado exitosamente para usuario: ${userId}`);

      return {
        success: true,
        message: 'Email verificado exitosamente. Tu cuenta está ahora completamente activa.',
        data: {
          email_verificado: true,
          cliente_creado: !clienteExistente,
        },
      };
    } catch (error) {
      this.logger.error('Error al verificar email:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al verificar email');
    }
  }

  async reenviarVerificacion(email: string) {
    this.logger.log(`Reenviando verificación para email: ${email}`);

    try {
      // Buscar usuario por email
      const persona = await this.prisma.financiera_personas.findFirst({
        where: { email },
      });

      if (!persona) {
        throw new NotFoundException('Email no encontrado');
      }

      // Buscar usuario asociado a esta persona
      const usuario = await this.prisma.seguridad_usuarios.findFirst({
        where: { persona_id: persona.id },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado para este email');
      }

      // Verificar si ya está verificado
      if (usuario.email_verificado) {
        return {
          success: false,
          message: 'El email ya está verificado',
        };
      }

      // Crear nuevo token de verificación
      const token = await this.emailVerificationService.createVerificationToken(
        usuario.user_id,
        'email_verification',
      );

      // Enviar email de verificación
      try {
        await this.emailService.sendVerificationEmail(email, token);
        this.logger.log(`Email de verificación reenviado a: ${email}`);
      } catch (error) {
        this.logger.error('Error al reenviar email de verificación:', error);
        throw new Error('Error al reenviar email de verificación');
      }

      return {
        success: true,
        message: 'Email de verificación reenviado',
        // En producción, no devolver el token
        token: process.env.NODE_ENV === 'development' ? token : undefined,
      };
    } catch (error) {
      this.logger.error('Error al reenviar verificación:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al reenviar verificación');
    }
  }

  async cambiarEmail(userId: string, cambiarEmailDto: CambiarEmailDto) {
    this.logger.log(`Cambiando email para usuario: ${userId}`);

    try {
      // Verificar que el usuario existe
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!usuario.persona_id) {
        throw new NotFoundException('El usuario no tiene un perfil creado');
      }

      // Verificar que el nuevo email no esté en uso
      const emailExistente = await this.prisma.financiera_personas.findFirst({
        where: {
          email: cambiarEmailDto.email,
          id: { not: usuario.persona_id },
        },
      });

      if (emailExistente) {
        throw new ConflictException('El email ya está en uso por otro usuario');
      }

      // Actualizar email
      await this.prisma.financiera_personas.update({
        where: { id: usuario.persona_id },
        data: { email: cambiarEmailDto.email },
      });

      // Marcar como no verificado hasta que se verifique el nuevo email
      await this.prisma.seguridad_usuarios.update({
        where: { user_id: userId },
        data: {
          email_verificado: false,
          email_verificado_at: null,
        },
      });

      // Crear token de verificación para el nuevo email
      const token = await this.emailVerificationService.createVerificationToken(
        userId,
        'email_verification',
      );

      // Enviar email de verificación al nuevo email
      try {
        await this.emailService.sendEmailChangeNotification(
          cambiarEmailDto.email,
          token,
        );
        this.logger.log(`Email de cambio enviado a: ${cambiarEmailDto.email}`);
      } catch (error) {
        this.logger.error('Error al enviar email de cambio:', error);
        // No lanzamos error para no interrumpir el cambio de email
      }

      this.logger.log(`Email cambiado exitosamente para usuario: ${userId}`);

      return {
        success: true,
        message:
          'Email cambiado exitosamente. Se ha enviado un email de verificación al nuevo correo.',
        motivo: cambiarEmailDto.motivo,
        // En producción, no devolver el token
        token: process.env.NODE_ENV === 'development' ? token : undefined,
      };
    } catch (error) {
      this.logger.error('Error al cambiar email:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error('Error al cambiar email');
    }
  }
}
