import { Module } from '@nestjs/common';
import { EmailService } from '@shared/email.service';
import { PrismaModule } from '@shared/prisma.service';

import { EmailVerificationService } from './services/email-verification.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, EmailVerificationService, EmailService],
  exports: [UsuariosService, EmailVerificationService, EmailService],
})
export class UsuariosModule {}
