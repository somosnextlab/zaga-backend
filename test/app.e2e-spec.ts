import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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
