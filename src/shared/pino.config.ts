import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';

export const pinoConfig = (configService: ConfigService): Params => ({
  pinoHttp: {
    level: configService.get('NODE_ENV') === 'production' ? 'info' : 'debug',
    transport: configService.get('NODE_ENV') === 'production' 
      ? undefined 
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
});
