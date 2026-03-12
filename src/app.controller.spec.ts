import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getApiInfo', () => {
    it('should return API info with name, version, status and docs', () => {
      const result = appController.getApiInfo();
      expect(result).toEqual({
        name: 'Zaga API',
        version: '0.0.1',
        status: 'ok',
        docs: '/api/docs',
      });
    });
  });
});
