import { Test, TestingModule } from '@nestjs/testing';
import { CasesInternalController } from './cases-internal.controller';
import { CaseGuarantorsService } from './case-guarantors.service';

describe('CasesInternalController', () => {
  let controller: CasesInternalController;

  const mockService = {
    applyAprobadoFinal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesInternalController],
      providers: [{ provide: CaseGuarantorsService, useValue: mockService }],
    }).compile();

    controller = module.get(CasesInternalController);
  });

  it('applyAprobadoFinal delega en el servicio', async () => {
    mockService.applyAprobadoFinal.mockResolvedValue({
      ok: true,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      case_status: 'APROBADO_FINAL',
    });
    const dto = { caseId: '550e8400-e29b-41d4-a716-446655440000' };
    await expect(controller.applyAprobadoFinal(dto)).resolves.toMatchObject({
      ok: true,
    });
    expect(mockService.applyAprobadoFinal).toHaveBeenCalledWith(dto);
  });
});
