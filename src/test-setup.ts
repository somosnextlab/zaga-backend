// Configuración global para tests
import 'reflect-metadata';

// Mock de variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.API_PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/zaga_test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
