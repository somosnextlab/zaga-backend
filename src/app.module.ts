import { AuthModule } from '@config/auth.module';
import { configSchema } from '@config/config.schema';
import { ClientesModule } from '@modules/clientes/clientes.module';
import { EvaluacionesModule } from '@modules/evaluaciones/evaluaciones.module';
import { FuentesExternasModule } from '@modules/fuentes-externas/fuentes.module';
import { GarantesModule } from '@modules/garantes/garantes.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { PagosModule } from '@modules/pagos/pagos.module';
import { PrestamosModule } from '@modules/prestamos/prestamos.module';
import { SaludModule } from '@modules/salud/salud.module';
import { SolicitudesModule } from '@modules/solicitudes/solicitudes.module';
import { UsuariosModule } from '@modules/usuarios/usuarios.module';
import { VerificacionIdentidadModule } from '@modules/verificacion-identidad/verificacion-identidad.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { pinoConfig } from '@shared/pino.config';
import { PrismaModule } from '@shared/prisma.service';
import { RedisModule } from '@shared/redis.provider';
import { SupabaseModule } from '@supabase/supabase.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = configSchema.safeParse(config);
        if (result.success) {
          return result.data;
        }
        throw new Error(`Config validation error: ${result.error.errors.map(e => e.message).join(', ')}`);
      },
    }),
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => pinoConfig(configService),
      inject: [ConfigService],
    }),
    AuthModule,
    SupabaseModule,
    PrismaModule,
    RedisModule,
    SaludModule,
    ClientesModule,
    GarantesModule,
    SolicitudesModule,
    EvaluacionesModule,
    PrestamosModule,
    PagosModule,
    UsuariosModule,
    VerificacionIdentidadModule,
    FuentesExternasModule,
    JobsModule,
  ],
})
export class AppModule {}
