// Setup global para tests
import { mockQueue, mockRedis, mockWorker, resetRedisMocks } from './shared/redis.mock';

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Configurar mocks globales
global.mockRedis = mockRedis;
global.mockQueue = mockQueue;
global.mockWorker = mockWorker;

// Resetear mocks antes de cada test
beforeEach(() => {
  resetRedisMocks();
});

// Mock de console.error para evitar spam en los tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const errorMessage = args[0]?.toString() || '';
  
  // Filtrar errores de Redis que no son críticos para los tests
  if (
    errorMessage.includes('getaddrinfo ENOTFOUND') ||
    errorMessage.includes('redis://localhost:6379') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Redis connection error')
  ) {
    return; // No mostrar estos errores en los tests
  }
  
  originalConsoleError(...args);
};

// Mock de console.warn para evitar spam en los tests
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const warnMessage = args[0]?.toString() || '';
  
  // Filtrar warnings de Redis que no son críticos para los tests
  if (
    warnMessage.includes('Redis no configurado') ||
    warnMessage.includes('Redis connection')
  ) {
    return; // No mostrar estos warnings en los tests
  }
  
  originalConsoleWarn(...args);
};
