import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from './config/config.module';
import { PrismaService } from './shared/prisma.service';
import { SaludModule } from './modules/salud/salud.module';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),
    ConfigService,

    // Módulos de la aplicación
    SaludModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
