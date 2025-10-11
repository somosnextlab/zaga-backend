import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from '@shared/logger';
import { PrismaService } from '@shared/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un token de verificación único
   */
  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Crea un token de verificación para un usuario
   */
  async createVerificationToken(
    userId: string,
    tipo: string = 'email_verification',
  ): Promise<string> {
    this.logger.log(`Creando token de verificación para usuario: ${userId}`);

    try {
      // Invalidar tokens anteriores del mismo tipo
      await this.prisma.seguridad_tokens_verificacion.updateMany({
        where: {
          user_id: userId,
          tipo: tipo,
          usado: false,
        },
        data: {
          usado: true,
        },
      });

      // Crear nuevo token
      const token = this.generateVerificationToken();
      const expiraAt = new Date();
      expiraAt.setHours(expiraAt.getHours() + 24); // Expira en 24 horas

      await this.prisma.seguridad_tokens_verificacion.create({
        data: {
          user_id: userId,
          token: token,
          tipo: tipo,
          expira_at: expiraAt,
        },
      });

      this.logger.log(`Token de verificación creado: ${token}`);
      return token;
    } catch (error) {
      this.logger.error('Error al crear token de verificación:', error);
      throw new Error('Error al crear token de verificación');
    }
  }

  /**
   * Verifica un token de verificación
   */
  async verifyToken(
    token: string,
    tipo: string = 'email_verification',
  ): Promise<string> {
    this.logger.log(`Verificando token: ${token}`);

    try {
      const tokenRecord =
        await this.prisma.seguridad_tokens_verificacion.findUnique({
          where: { token },
          include: { usuario: true },
        });

      if (!tokenRecord) {
        throw new BadRequestException('Token de verificación inválido');
      }

      if (tokenRecord.usado) {
        throw new BadRequestException('Token de verificación ya fue utilizado');
      }

      if (tokenRecord.tipo !== tipo) {
        throw new BadRequestException('Tipo de token incorrecto');
      }

      if (new Date() > tokenRecord.expira_at) {
        throw new BadRequestException('Token de verificación expirado');
      }

      // Marcar token como usado
      await this.prisma.seguridad_tokens_verificacion.update({
        where: { id: tokenRecord.id },
        data: { usado: true },
      });

      this.logger.log(
        `Token verificado exitosamente para usuario: ${tokenRecord.user_id}`,
      );
      return tokenRecord.user_id;
    } catch (error) {
      this.logger.error('Error al verificar token:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Error al verificar token');
    }
  }

  /**
   * Marca el email de un usuario como verificado
   */
  async markEmailAsVerified(userId: string): Promise<void> {
    this.logger.log(`Marcando email como verificado para usuario: ${userId}`);

    try {
      await this.prisma.seguridad_usuarios.update({
        where: { user_id: userId },
        data: {
          email_verificado: true,
          email_verificado_at: new Date(),
        },
      });

      this.logger.log(`Email marcado como verificado para usuario: ${userId}`);
    } catch (error) {
      this.logger.error('Error al marcar email como verificado:', error);
      throw new Error('Error al marcar email como verificado');
    }
  }

  /**
   * Verifica si un usuario tiene email verificado
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
        select: { email_verificado: true },
      });

      return usuario?.email_verificado || false;
    } catch (error) {
      this.logger.error('Error al verificar estado de email:', error);
      return false;
    }
  }

  /**
   * Obtiene el email de un usuario para verificación
   */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const usuario = await this.prisma.seguridad_usuarios.findUnique({
        where: { user_id: userId },
      });

      if (!usuario?.persona_id) {
        return null;
      }

      const persona = await this.prisma.financiera_personas.findUnique({
        where: { id: usuario.persona_id },
        select: { email: true },
      });

      return persona?.email || null;
    } catch (error) {
      this.logger.error('Error al obtener email del usuario:', error);
      return null;
    }
  }
}
