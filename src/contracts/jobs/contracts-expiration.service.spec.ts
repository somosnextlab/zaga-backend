import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContractsRepository } from '../contracts.repository';
import { ContractsExpirationService } from './contracts-expiration.service';
import { SignaturaService } from '../providers/signatura.service';
import { SignProvider } from '../enums/sign-provider.enum';

describe('ContractsExpirationService', () => {
  let service: ContractsExpirationService;

  const mockContractsRepository = {
    expirePendingContracts: jest.fn(),
  };
  const mockConfigService = {
    get: jest.fn(),
  };
  const mockSignaturaService = {
    cancelDocument: jest.fn(),
  };

  const createTestingModule = async (): Promise<TestingModule> =>
    Test.createTestingModule({
      providers: [
        ContractsExpirationService,
        { provide: ContractsRepository, useValue: mockContractsRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SignaturaService, useValue: mockSignaturaService },
      ],
    }).compile();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation(() => 'true');
    const module: TestingModule = await createTestingModule();

    service = module.get<ContractsExpirationService>(
      ContractsExpirationService,
    );
  });

  it('devuelve cantidad de contratos expirados', async () => {
    mockContractsRepository.expirePendingContracts.mockResolvedValue([
      {
        id: 'contract-1',
        provider: SignProvider.SIGNATURA,
        external_document_id: 'doc-1',
      },
      {
        id: 'contract-2',
        provider: SignProvider.SIGNATURA,
        external_document_id: 'doc-2',
      },
      {
        id: 'contract-3',
        provider: SignProvider.SIGNATURA,
        external_document_id: null,
      },
    ]);
    mockSignaturaService.cancelDocument.mockResolvedValue({
      canceled: true,
      raw: {},
    });

    const result = await service.expirePendingContracts();

    expect(result).toEqual({ expiredCount: 3 });
    expect(
      mockContractsRepository.expirePendingContracts,
    ).toHaveBeenCalledTimes(1);
    expect(mockSignaturaService.cancelDocument).toHaveBeenCalledTimes(2);
  });

  it('devuelve 0 cuando no hay contratos vencidos', async () => {
    mockContractsRepository.expirePendingContracts.mockResolvedValue([]);

    const result = await service.expirePendingContracts();

    expect(result).toEqual({ expiredCount: 0 });
    expect(mockSignaturaService.cancelDocument).not.toHaveBeenCalled();
  });

  it('ejecuta expiración cuando cron está habilitado', async () => {
    mockContractsRepository.expirePendingContracts.mockResolvedValue([
      {
        id: 'contract-1',
        provider: SignProvider.SIGNATURA,
        external_document_id: null,
      },
    ]);

    await service.handleContractsExpirationCron();

    expect(
      mockContractsRepository.expirePendingContracts,
    ).toHaveBeenCalledTimes(1);
  });

  it('no ejecuta expiración cuando cron está deshabilitado', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'CONTRACTS_EXPIRATION_CRON_ENABLED' ? 'false' : 'true',
    );
    const module: TestingModule = await createTestingModule();
    const disabledService = module.get<ContractsExpirationService>(
      ContractsExpirationService,
    );

    await disabledService.handleContractsExpirationCron();

    expect(
      mockContractsRepository.expirePendingContracts,
    ).not.toHaveBeenCalled();
  });

  it('omite cancelación remota cuando flag está deshabilitado', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'CONTRACTS_EXPIRATION_REMOTE_CANCEL_ENABLED' ? 'false' : 'true',
    );
    const module: TestingModule = await createTestingModule();
    const serviceWithRemoteDisabled = module.get<ContractsExpirationService>(
      ContractsExpirationService,
    );
    mockContractsRepository.expirePendingContracts.mockResolvedValue([
      {
        id: 'contract-1',
        provider: SignProvider.SIGNATURA,
        external_document_id: 'doc-1',
      },
    ]);

    const result = await serviceWithRemoteDisabled.expirePendingContracts();

    expect(result).toEqual({ expiredCount: 1 });
    expect(mockSignaturaService.cancelDocument).not.toHaveBeenCalled();
  });
});
