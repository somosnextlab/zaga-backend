import { Test, TestingModule } from '@nestjs/testing';
import { CaseGuarantorsController } from './case-guarantors.controller';
import { CaseGuarantorsService } from './case-guarantors.service';

describe('CaseGuarantorsController', () => {
  let controller: CaseGuarantorsController;

  const mockService = {
    evaluateCaseGuarantor: jest.fn(),
    resolveCaseGuarantor: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseGuarantorsController],
      providers: [{ provide: CaseGuarantorsService, useValue: mockService }],
    }).compile();

    controller = module.get(CaseGuarantorsController);
  });

  it('evaluate delega en el servicio', async () => {
    mockService.evaluateCaseGuarantor.mockResolvedValue({ ok: true });
    const caseId = '550e8400-e29b-41d4-a716-446655440000';
    const body = { cuit: '20-12345678-6' };
    await expect(controller.evaluate(caseId, body)).resolves.toEqual({
      ok: true,
    });
    expect(mockService.evaluateCaseGuarantor).toHaveBeenCalledWith({
      caseId,
      cuit: body.cuit,
    });
  });

  it('resolve delega en el servicio', async () => {
    mockService.resolveCaseGuarantor.mockResolvedValue({ ok: true });
    const caseId = '550e8400-e29b-41d4-a716-446655440000';
    const body = {
      action: 'GARANTE_APROBADO' as const,
      actor: 'CEO' as const,
    };
    await expect(controller.resolve(caseId, body)).resolves.toEqual({
      ok: true,
    });
    expect(mockService.resolveCaseGuarantor).toHaveBeenCalledWith({
      caseId,
      action: body.action,
      actor: body.actor,
      rejectReason: undefined,
    });
  });
});
