import { Test, TestingModule } from '@nestjs/testing';
import { SaludController } from './salud.controller';

describe('SaludController', () => {
  let controller: SaludController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaludController],
    }).compile();

    controller = module.get<SaludController>(SaludController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSalud', () => {
    it('should return health status', () => {
      const result = controller.getSalud();

      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('timestamp');
      expect(result.ok).toBe(true);
      expect(result.version).toBe('1.0.0');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return timestamp in ISO format', () => {
      const result = controller.getSalud();
      const timestamp = new Date(result.timestamp);

      expect(timestamp instanceof Date).toBe(true);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });
});
