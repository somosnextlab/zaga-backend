import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from '@shared/prisma.service';
import { RedisModule } from '@shared/redis.provider';
import { SaludModule } from '@modules/salud/salud.module';
import { ClientesModule } from '@modules/clientes/clientes.module';
import { GarantesModule } from '@modules/garantes/garantes.module';
import { SolicitudesModule } from '@modules/solicitudes/solicitudes.module';
import { EvaluacionesModule } from '@modules/evaluaciones/evaluaciones.module';
import { PrestamosModule } from '@modules/prestamos/prestamos.module';
import { PagosModule } from '@modules/pagos/pagos.module';
import { VerificacionIdentidadModule } from '@modules/verificacion-identidad/verificacion-identidad.module';
import { FuentesExternasModule } from '@modules/fuentes-externas/fuentes.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { AuthModule } from '@config/auth.module';
import { configSchema } from '@config/config.schema';
import { pinoConfig } from '@shared/pino.config';

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
    PrismaModule,
    RedisModule,
    SaludModule,
    ClientesModule,
    GarantesModule,
    SolicitudesModule,
    EvaluacionesModule,
    PrestamosModule,
    PagosModule,
    VerificacionIdentidadModule,
    FuentesExternasModule,
    JobsModule,
  ],
})
export class AppModule {}
