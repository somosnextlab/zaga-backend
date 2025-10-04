import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { SaludModule } from '../src/modules/salud/salud.module';
import { mockRedisProvider } from '../src/shared/redis.mock';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SaludModule],
      providers: [mockRedisProvider],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/salud (GET)', () => {
    return request(app.getHttpServer())
      .get('/salud')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('timestamp');
      });
  });
});
