import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Logger } from './logger';

const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    const redisUrl = configService.get<string>('REDIS_URL');
    const logger = new Logger('Redis');

    // En desarrollo, si Redis no está disponible, crear un mock
    if (process.env.NODE_ENV === 'development' && (!redisUrl || redisUrl.includes('host:port'))) {
      logger.warn('Redis no configurado, usando mock para desarrollo');
      return {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve('OK'),
        del: () => Promise.resolve(1),
        exists: () => Promise.resolve(0),
        expire: () => Promise.resolve(0),
        on: () => {},
        disconnect: () => Promise.resolve(),
      };
    }

    const redis = new Redis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.log('Redis conectado');
    });

    redis.on('error', (error) => {
      logger.error('Error de Redis:', error.message);
    });

    redis.on('close', () => {
      logger.log('Conexión Redis cerrada');
    });

    return redis;
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [RedisProvider],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
