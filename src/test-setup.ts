// Setup global para tests
import { mockRedis, mockQueue, mockWorker, resetRedisMocks } from './shared/redis.mock';

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
  // Solo mostrar errores que no sean de Redis
  if (!args[0]?.toString().includes('getaddrinfo ENOTFOUND localhost:6379')) {
    originalConsoleError(...args);
  }
};
