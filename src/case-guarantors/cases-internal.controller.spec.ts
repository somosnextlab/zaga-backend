import { Test, TestingModule } from '@nestjs/testing';
import { CasesFromRequestedAmountService } from '../cases/cases-from-requested-amount.service';
import { CasesInternalController } from './cases-internal.controller';
import { CaseGuarantorsService } from './case-guarantors.service';

describe('CasesInternalController', () => {
  let controller: CasesInternalController;

  const mockService = {
    applyAprobadoFinal: jest.fn(),
    applyManualIdentity: jest.fn(),
  };

  const mockCasesFromRequestedAmount = {
    createFromRequestedAmount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesInternalController],
      providers: [
        { provide: CaseGuarantorsService, useValue: mockService },
        {
          provide: CasesFromRequestedAmountService,
          useValue: mockCasesFromRequestedAmount,
        },
      ],
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

  it('applyManualIdentity delega en el servicio', async () => {
    mockService.applyManualIdentity.mockResolvedValue({
      ok: true,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      first_name: 'CRISTIAN DENIS',
      last_name: 'GIANOBOLI',
    });
    const dto = {
      caseId: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'CRISTIAN DENIS',
      lastName: 'GIANOBOLI',
      actor: 'CEO' as const,
    };
    await expect(controller.applyManualIdentity(dto)).resolves.toMatchObject({
      ok: true,
    });
    expect(mockService.applyManualIdentity).toHaveBeenCalledWith(dto);
  });

  it('createFromRequestedAmount delega en CasesFromRequestedAmountService', async () => {
    mockCasesFromRequestedAmount.createFromRequestedAmount.mockResolvedValue({
      ok: true,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      phone: '+5493516639755',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      requested_amount: 300000,
      case_status: 'WAITING_CEO',
      lead_stage: 'WAITING_CEO',
      prequal_mode: 'AUTO_OK',
      manual_review_reason: null,
    });
    const dto = { phone: '+5493516639755', requested_amount: 300000 };
    await expect(
      controller.createFromRequestedAmount(dto),
    ).resolves.toMatchObject({ ok: true });
    expect(
      mockCasesFromRequestedAmount.createFromRequestedAmount,
    ).toHaveBeenCalledWith(dto);
  });
});
