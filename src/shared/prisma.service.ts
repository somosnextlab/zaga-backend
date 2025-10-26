import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    const nodeEnv = configService.get<string>('NODE_ENV');

    // Detectar si estamos en un entorno con PgBouncer (Railway, Render, etc.)
    const isProduction = nodeEnv === 'production';
    const isRailway =
      process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    const isRender = process.env.RENDER;
    const isHeroku = process.env.HEROKU_APP_NAME;

    // Aplicar pgbouncer=true si estamos en producción O en plataformas que usan PgBouncer
    const needsPgbouncer = isProduction || isRailway || isRender || isHeroku;
    const hasPgbouncer = databaseUrl && databaseUrl.includes('pgbouncer=true');

    const finalDatabaseUrl =
      needsPgbouncer && !hasPgbouncer && databaseUrl
        ? `${databaseUrl}?pgbouncer=true`
        : databaseUrl;

    super({
      datasources: {
        db: {
          url: finalDatabaseUrl,
        },
      },
      log:
        nodeEnv === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('📋 PrismaService conectado a la base de datos');

      // Detectar si necesitamos evitar prepared statements
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      const isRailway =
        process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      const isRender = process.env.RENDER;
      const isHeroku = process.env.HEROKU_APP_NAME;
      const needsPgbouncer =
        nodeEnv === 'production' || isRailway || isRender || isHeroku;

      if (needsPgbouncer) {
        // En entornos con PgBouncer, usar executeRaw para evitar prepared statements
        await this.$executeRaw`SELECT 1`;
        console.log('✅ Conexión verificada (modo PgBouncer)');
      } else {
        // En desarrollo local, usar queryRaw para debugging
        await this.$queryRaw`SELECT 1`;
        console.log('✅ Conexión a base de datos verificada');
      }
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error);

      // En entornos con PgBouncer, no fallar si hay problemas con prepared statements
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      const isRailway =
        process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      const isRender = process.env.RENDER;
      const isHeroku = process.env.HEROKU_APP_NAME;
      const needsPgbouncer =
        nodeEnv === 'production' || isRailway || isRender || isHeroku;

      if (needsPgbouncer && error.code === 'P2010') {
        console.warn(
          '⚠️ Advertencia: Problema con prepared statements, continuando sin verificación',
        );
        return;
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('🔌 PrismaService desconectado de la base de datos');
    } catch (error) {
      console.error('❌ Error desconectando de la base de datos:', error);
    }
  }

  /**
   * Ejecuta una transacción con rollback automático en caso de error
   *
   * @param fn - Función que contiene las operaciones de la transacción
   * @returns Promise con el resultado de la transacción
   */
  async executeTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }

  /**
   * Verifica la salud de la conexión a la base de datos
   *
   * @returns Promise<boolean> - true si la conexión está saludable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      const isRailway =
        process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      const isRender = process.env.RENDER;
      const isHeroku = process.env.HEROKU_APP_NAME;
      const needsPgbouncer =
        nodeEnv === 'production' || isRailway || isRender || isHeroku;

      if (needsPgbouncer) {
        // En entornos con PgBouncer, usar executeRaw para evitar prepared statements
        await this.$executeRaw`SELECT 1`;
      } else {
        // En desarrollo local, usar queryRaw para debugging
        await this.$queryRaw`SELECT 1`;
      }
      return true;
    } catch (error) {
      console.error('❌ Base de datos no saludable:', error);
      return false;
    }
  }
}
