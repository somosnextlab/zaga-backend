// Mock de Redis para tests
export const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

// Mock de Queue para BullMQ
export const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  close: jest.fn(),
  clean: jest.fn(),
  getJobs: jest.fn(),
  getJob: jest.fn(),
  removeJobs: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPaused: jest.fn().mockResolvedValue(false),
  isRunning: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

// Mock de Worker para BullMQ
export const mockWorker = {
  close: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPaused: jest.fn().mockResolvedValue(false),
  isRunning: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

// Mock del Redis Provider
export const mockRedisProvider = {
  provide: 'REDIS_CLIENT',
  useValue: mockRedis,
};

// Mock del Queue Provider
export const mockQueueProvider = {
  provide: 'EVALUACION_QUEUE',
  useValue: mockQueue,
};

// Mock del Worker Provider
export const mockWorkerProvider = {
  provide: 'EVALUACION_WORKER',
  useValue: mockWorker,
};

// Función helper para resetear todos los mocks
export const resetRedisMocks = () => {
  Object.values(mockRedis).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  Object.values(mockQueue).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  Object.values(mockWorker).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
};
