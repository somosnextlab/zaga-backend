import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Configurar SendGrid con la API Key
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid configurado correctamente');
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY no encontrada - emails no se enviarán',
      );
    }
  }

  /**
   * Envía email de verificación
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://zaga.com.ar'}/verificar-email?token=${token}`;

    const msg = {
      to: email,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@zaga.com.ar',
        name: process.env.FROM_NAME || 'Zaga',
      },
      subject: '¡Bienvenido a Zaga! Verifica tu email',
      html: this.getVerificationEmailTemplate(verificationUrl),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email de verificación enviado a: ${email}`);
    } catch (error) {
      this.logger.error('Error al enviar email de verificación:', error);
      throw new Error('Error al enviar email de verificación');
    }
  }

  /**
   * Envía email de cambio de email
   */
  async sendEmailChangeNotification(
    email: string,
    token: string,
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://zaga.com.ar'}/verificar-email?token=${token}`;

    const msg = {
      to: email,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@zaga.com.ar',
        name: process.env.FROM_NAME || 'Zaga',
      },
      subject: 'Verifica tu nuevo email - Zaga',
      html: this.getEmailChangeTemplate(verificationUrl),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email de cambio enviado a: ${email}`);
    } catch (error) {
      this.logger.error('Error al enviar email de cambio:', error);
      throw new Error('Error al enviar email de cambio');
    }
  }

  /**
   * Template HTML para email de verificación
   */
  private getVerificationEmailTemplate(verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu email - Zaga</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido a Zaga!</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Tu plataforma de préstamos confiable</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">Verifica tu cuenta</h2>
          <p>Gracias por registrarte en Zaga. Para completar tu registro y acceder a todos nuestros servicios, necesitas verificar tu dirección de email.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Verificar Email
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⏰ Importante:</strong> Este enlace expira en 24 horas por seguridad.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            Si no creaste una cuenta en Zaga, puedes ignorar este email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            © 2024 Zaga. Todos los derechos reservados.<br>
            Este es un email automático, por favor no respondas.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template HTML para email de cambio
   */
  private getEmailChangeTemplate(verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu nuevo email - Zaga</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Cambio de Email</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Zaga - Verificación requerida</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">Verifica tu nuevo email</h2>
          <p>Se ha solicitado un cambio de dirección de email para tu cuenta de Zaga. Para completar este proceso, verifica tu nueva dirección de email.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Verificar Nuevo Email
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⏰ Importante:</strong> Este enlace expira en 24 horas por seguridad.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            Si no solicitaste este cambio, contacta inmediatamente a nuestro soporte.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">
            © 2024 Zaga. Todos los derechos reservados.<br>
            Este es un email automático, por favor no respondas.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
