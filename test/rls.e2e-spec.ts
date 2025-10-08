import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('RLS Implementation (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get<ConfigService>(ConfigService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe('Authentication', () => {
    it('should return 401 for requests without token', () => {
      return request(app.getHttpServer())
        .get('/prestamos')
        .expect(401);
    });

    it('should return 401 for requests with invalid token', () => {
      return request(app.getHttpServer())
        .get('/prestamos')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow access in development mode without Supabase config', () => {
      // En modo desarrollo, el guard permite acceso sin token válido
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/prestamos')
          .expect(200);
      }
    });
  });

  describe('Usuarios endpoint', () => {
    it('should return user info in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/usuarios/yo')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('user_id');
            expect(res.body).toHaveProperty('email');
            expect(res.body).toHaveProperty('rol');
          });
      }
    });
  });

  describe('Solicitudes endpoint', () => {
    it('should return 401 for POST without token', () => {
      return request(app.getHttpServer())
        .post('/solicitudes')
        .send({
          monto_solicitado: 100000,
          plazo_meses: 12,
        })
        .expect(401);
    });

    it('should create solicitud in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .post('/solicitudes')
          .send({
            monto_solicitado: 100000,
            plazo_meses: 12,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('monto_solicitado', 100000);
            expect(res.body).toHaveProperty('plazo_meses', 12);
          });
      }
    });
  });

  describe('Prestamos endpoint', () => {
    it('should return 401 for GET without token', () => {
      return request(app.getHttpServer())
        .get('/prestamos')
        .expect(401);
    });

    it('should return prestamos in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/prestamos')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      }
    });
  });
});
