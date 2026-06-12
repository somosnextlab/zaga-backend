import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../../db/db.service';
import { ContractsService } from '../contracts.service';
import { BankAccountsRepository } from '../repositories/bank-accounts.repository';
import { ContractDataRepository } from '../repositories/contract-data.repository';
import { ContractDataTokensRepository } from '../repositories/contract-data-tokens.repository';
import { RefDataRepository } from '../repositories/ref-data.repository';
import { ContractDataErrors } from '../utils/contract-data.errors';
import { ContractDataSubmitService } from './contract-data-submit.service';

const CASE_ID = '550e8400-e29b-41d4-a716-446655440000';
// Valor de test: findValidToken está mockeado, no se valida el formato UUID.
const TOKEN = 'test-contract-data-token';
const USER_ID = '770e8400-e29b-41d4-a716-446655440002';

describe('ContractDataSubmitService', () => {
  let service: ContractDataSubmitService;

  const mockClient = { tag: 'tx-client' };

  const mockContractDataRepository = {
    findCaseForContractDataForUpdate: jest.fn(),
    updateUserContractData: jest.fn(),
    findActiveGuarantorByCaseId: jest.fn(),
    updateGuarantorContractData: jest.fn(),
    setCaseContractDataCompleted: jest.fn(),
  };

  const mockTokensRepository = {
    findValidToken: jest.fn(),
    markTokenUsed: jest.fn(),
    countUsedTokensByCaseId: jest.fn(),
  };

  const mockBankAccountsRepository = {
    upsertBankAccount: jest.fn(),
    setBankAccountForDisbursement: jest.fn(),
  };

  const mockRefDataRepository = {
    localidadExistsForProvincia: jest.fn(),
  };

  const mockContractsService = {
    startCaseContract: jest.fn(),
  };

  const mockDbService = {
    withTransaction: jest.fn(
      async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractDataSubmitService,
        { provide: DbService, useValue: mockDbService },
        {
          provide: ContractDataRepository,
          useValue: mockContractDataRepository,
        },
        {
          provide: ContractDataTokensRepository,
          useValue: mockTokensRepository,
        },
        {
          provide: BankAccountsRepository,
          useValue: mockBankAccountsRepository,
        },
        { provide: RefDataRepository, useValue: mockRefDataRepository },
        { provide: ContractsService, useValue: mockContractsService },
      ],
    }).compile();

    service = module.get(ContractDataSubmitService);

    mockContractDataRepository.findCaseForContractDataForUpdate.mockResolvedValue(
      { id: CASE_ID, status: 'PENDING_CONTRACT_DATA', user_id: USER_ID },
    );
    mockTokensRepository.findValidToken.mockResolvedValue({
      case_id: CASE_ID,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 3_600_000),
    });
    // Solo 1 de 2 tokens usado: no completa la recolección (evita startCaseContract).
    mockTokensRepository.countUsedTokensByCaseId.mockResolvedValue({
      total: 2,
      used: 1,
    });
    mockRefDataRepository.localidadExistsForProvincia.mockResolvedValue(true);
    mockBankAccountsRepository.upsertBankAccount.mockResolvedValue('bank-1');
  });

  describe('applyTitular', () => {
    function titularInput(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        subject: 'TITULAR',
        caseId: CASE_ID,
        token: TOKEN,
        email: 'titular@example.com',
        cbu_cvu: '0'.repeat(22),
        bank_name: 'Banco Test',
        domicilio_calle: 'Calle',
        domicilio_numero: '123',
        domicilio_localidad: 'Cordoba',
        domicilio_provincia: 'Cordoba',
        ...overrides,
      };
    }

    it('persiste sin account_kind ni domicilio_cp (los pasa como null)', async () => {
      const result = await service.submitContractData(titularInput() as never);

      expect(result.ok).toBe(true);
      expect(
        mockContractDataRepository.updateUserContractData,
      ).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ userId: USER_ID, domicilioCp: null }),
      );
      expect(mockBankAccountsRepository.upsertBankAccount).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ accountKind: null, cbuCvu: '0'.repeat(22) }),
      );
    });

    it('respeta account_kind y domicilio_cp cuando vienen', async () => {
      await service.submitContractData(
        titularInput({ account_kind: 'CBU', domicilio_cp: '5000' }) as never,
      );

      expect(mockBankAccountsRepository.upsertBankAccount).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ accountKind: 'CBU' }),
      );
      expect(
        mockContractDataRepository.updateUserContractData,
      ).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ domicilioCp: '5000' }),
      );
    });
  });

  describe('applyCodeudor', () => {
    function codeudorInput(): Record<string, unknown> {
      return {
        subject: 'CODEUDOR',
        caseId: CASE_ID,
        token: TOKEN,
        email: 'codeudor@example.com',
        domicilio_calle: 'Calle',
        domicilio_numero: '123',
        domicilio_localidad: 'Cordoba',
        domicilio_provincia: 'Cordoba',
        follow_up_level: 'FAMILIAR',
      };
    }

    it('usa el nombre persistido y el DNI derivado del CUIT', async () => {
      mockContractDataRepository.findActiveGuarantorByCaseId.mockResolvedValue({
        id: 'guarantor-1',
        user_id: null,
        cuit: '20123456786',
        first_name: 'Ana',
        last_name: 'Gomez',
      });

      const result = await service.submitContractData(codeudorInput() as never);

      expect(result.ok).toBe(true);
      expect(
        mockContractDataRepository.updateGuarantorContractData,
      ).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          guarantorId: 'guarantor-1',
          dni: '12345678',
          domicilioCp: null,
        }),
      );
    });

    it('devuelve GUARANTOR_IDENTITY_REQUIRED si falta el nombre del garante', async () => {
      mockContractDataRepository.findActiveGuarantorByCaseId.mockResolvedValue({
        id: 'guarantor-1',
        user_id: null,
        cuit: '20123456786',
        first_name: null,
        last_name: null,
      });

      const result = await service.submitContractData(codeudorInput() as never);

      expect(result).toMatchObject({
        ok: false,
        error_code: ContractDataErrors.GUARANTOR_IDENTITY_REQUIRED,
      });
      expect(
        mockContractDataRepository.updateGuarantorContractData,
      ).not.toHaveBeenCalled();
    });

    it('devuelve GUARANTOR_IDENTITY_REQUIRED si el CUIT no permite derivar DNI', async () => {
      mockContractDataRepository.findActiveGuarantorByCaseId.mockResolvedValue({
        id: 'guarantor-1',
        user_id: null,
        cuit: 'invalid',
        first_name: 'Ana',
        last_name: 'Gomez',
      });

      const result = await service.submitContractData(codeudorInput() as never);

      expect(result).toMatchObject({
        ok: false,
        error_code: ContractDataErrors.GUARANTOR_IDENTITY_REQUIRED,
      });
      expect(
        mockContractDataRepository.updateGuarantorContractData,
      ).not.toHaveBeenCalled();
    });
  });
});
