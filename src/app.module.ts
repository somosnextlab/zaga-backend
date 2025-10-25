import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from './config/config.module';
import { PrismaService } from './shared/prisma.service';
import { SaludModule } from './modules/salud/salud.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { ClientesModule } from './modules/clientes/clientes.module';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),
    ConfigService,

    // Módulos de la aplicación
    SupabaseModule,
    SaludModule,
    AuthModule,
    UsuariosModule,
    ClientesModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
