import { AuthModule as ConfigAuthModule } from '@config/auth.module';
import { AuthModule } from '@modules/auth/auth.module';
import { SaludModule } from '@modules/salud/salud.module';
import { UsuariosModule } from '@modules/usuarios/usuarios.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigAuthModule,
    AuthModule,
    PrismaModule,
    SaludModule,
    UsuariosModule,
  ],
})
export class AppModule {}
