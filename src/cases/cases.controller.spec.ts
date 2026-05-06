import { Test, TestingModule } from '@nestjs/testing';
import { CaseGuarantorsService } from '../case-guarantors/case-guarantors.service';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';
import { CasesController } from './cases.controller';

describe('CasesController', () => {
  let controller: CasesController;

  const mockCaseGuarantors = {
    applyAprobadoFinal: jest.fn(),
    applyManualIdentity: jest.fn(),
  };

  const mockCasesFromRequestedAmount = {
    createFromRequestedAmount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [
        { provide: CaseGuarantorsService, useValue: mockCaseGuarantors },
        {
          provide: CasesFromRequestedAmountService,
          useValue: mockCasesFromRequestedAmount,
        },
      ],
    }).compile();

    controller = module.get(CasesController);
  });

  it('applyAprobadoFinal delega en el servicio con caseId del path', async () => {
    mockCaseGuarantors.applyAprobadoFinal.mockResolvedValue({
      ok: true,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      case_status: 'APROBADO_FINAL',
    });
    const caseId = '550e8400-e29b-41d4-a716-446655440000';
    await expect(controller.applyAprobadoFinal(caseId)).resolves.toMatchObject({
      ok: true,
    });
    expect(mockCaseGuarantors.applyAprobadoFinal).toHaveBeenCalledWith({
      caseId,
    });
  });

  it('applyManualIdentity delega en el servicio combinando path y body', async () => {
    mockCaseGuarantors.applyManualIdentity.mockResolvedValue({
      ok: true,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      first_name: 'CRISTIAN DENIS',
      last_name: 'GIANOBOLI',
    });
    const caseId = '550e8400-e29b-41d4-a716-446655440000';
    const body = {
      firstName: 'CRISTIAN DENIS',
      lastName: 'GIANOBOLI',
      actor: 'CEO' as const,
    };
    await expect(
      controller.applyManualIdentity(caseId, body),
    ).resolves.toMatchObject({
      ok: true,
    });
    expect(mockCaseGuarantors.applyManualIdentity).toHaveBeenCalledWith({
      caseId,
      ...body,
    });
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
