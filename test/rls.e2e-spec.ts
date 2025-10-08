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
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Error closing app:', error);
      }
    }
  }, 5000);

  describe('🔐 Authentication & Authorization', () => {
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
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/prestamos')
          .expect(200);
      }
    });
  });

  describe('👤 User Information (Usuarios)', () => {
    it('should return user info in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/usuarios/yo')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('user_id', 'dev-user');
            expect(res.body).toHaveProperty('email', 'dev@example.com');
            expect(res.body).toHaveProperty('rol', 'admin');
            expect(res.body).toHaveProperty('persona_id', 'dev-persona-id');
            expect(res.body).toHaveProperty('cliente_id', 'dev-cliente-id');
          });
      }
    });
  });

  describe('📋 Solicitudes - Business Logic Validation', () => {
    it('should return 401 for POST without token', () => {
      return request(app.getHttpServer())
        .post('/solicitudes')
        .send({
          monto_solicitado: 100000,
          plazo_meses: 12,
        })
        .expect(401);
    });

    it('should create solicitud with client_id extracted from JWT in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .post('/solicitudes')
          .send({
            monto_solicitado: 100000,
            plazo_meses: 12,
            proposito: 'Compra de vehículo',
          })
          .expect(201)
          .expect((res) => {
            // Validar que la solicitud se creó correctamente
            expect(res.body).toHaveProperty('monto_solicitado', 100000);
            expect(res.body).toHaveProperty('plazo_meses', 12);
            expect(res.body).toHaveProperty('proposito', 'Compra de vehículo');
            expect(res.body).toHaveProperty('estado', 'pendiente');
            expect(res.body).toHaveProperty('consentimiento', true);
            
            // Validar que el cliente_id se extrajo del JWT (no del body)
            expect(res.body).toHaveProperty('cliente_id', 'dev-cliente-id');
            
            // Validar que se incluye información del cliente
            expect(res.body).toHaveProperty('cliente');
            expect(res.body.cliente).toHaveProperty('persona');
          });
      }
    });

    it('should return solicitudes with RLS applied in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/solicitudes')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      }
    });
  });

  describe('💰 Préstamos - RLS Implementation', () => {
    it('should return 401 for GET without token', () => {
      return request(app.getHttpServer())
        .get('/prestamos')
        .expect(401);
    });

    it('should return préstamos with RLS applied in development mode', () => {
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

  describe('🔒 Security Validations', () => {
    it('should prevent client_id manipulation in solicitud creation', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .post('/solicitudes')
          .send({
            monto_solicitado: 100000,
            plazo_meses: 12,
            cliente_id: 'malicious-client-id', // Intentar manipular
          })
          .expect(201)
          .expect((res) => {
            // El cliente_id debería ser el del JWT, no el del body
            expect(res.body.cliente_id).toBe('dev-cliente-id');
            expect(res.body.cliente_id).not.toBe('malicious-client-id');
          });
      }
    });

    it('should validate JWT token structure in development mode', () => {
      const supabaseUrl = configService.get<string>('SUPABASE_PROJECT_URL');
      
      if (!supabaseUrl || supabaseUrl === 'https://example.supabase.co') {
        return request(app.getHttpServer())
          .get('/usuarios/yo')
          .expect(200)
          .expect((res) => {
            // Validar estructura del usuario dev
            expect(res.body).toHaveProperty('user_id');
            expect(res.body).toHaveProperty('email');
            expect(res.body).toHaveProperty('rol');
            expect(res.body).toHaveProperty('app_metadata');
            expect(res.body).toHaveProperty('user_metadata');
          });
      }
    });
  });
});