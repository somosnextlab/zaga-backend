import { Injectable } from '@nestjs/common';

export interface ApiInfo {
  name: string;
  version: string;
  status: string;
  docs: string;
}

@Injectable()
export class AppService {
  getApiInfo(): ApiInfo {
    return {
      name: 'Zaga API',
      version: '0.0.1',
      status: 'ok',
      docs: '/api/docs',
    };
  }
}
