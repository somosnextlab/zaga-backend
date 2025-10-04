import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to database', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Prisma conectado a la base de datos');
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Prisma desconectado de la base de datos');
    });
  });
});
