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
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    
    super({
      datasources: {
        db: {
          url: isProduction && databaseUrl && !databaseUrl.includes('pgbouncer=true')
            ? `${databaseUrl}?pgbouncer=true`
            : databaseUrl,
        },
      },
      log:
        configService.get<string>('NODE_ENV') === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('📋 PrismaService conectado a la base de datos');

      // Verificar conexión con una consulta simple (evitar prepared statements en producción)
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      if (isProduction) {
        // En producción, usar una consulta más simple que no genere prepared statements
        await this.$executeRaw`SELECT 1`;
      } else {
        // En desarrollo, usar queryRaw para debugging
        await this.$queryRaw`SELECT 1`;
      }
      console.log('✅ Conexión a base de datos verificada');
    } catch (error) {
      console.error('❌ Error conectando a la base de datos:', error);
      // En producción, no fallar si hay problemas con prepared statements
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      if (isProduction && error.code === 'P2010') {
        console.warn('⚠️ Advertencia: Problema con prepared statements, continuando sin verificación');
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
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      if (isProduction) {
        // En producción, usar executeRaw para evitar prepared statements
        await this.$executeRaw`SELECT 1`;
      } else {
        // En desarrollo, usar queryRaw para debugging
        await this.$queryRaw`SELECT 1`;
      }
      return true;
    } catch (error) {
      console.error('❌ Base de datos no saludable:', error);
      return false;
    }
  }
}
