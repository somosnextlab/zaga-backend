import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ContractPdfService } from './contract-pdf.service';

interface ContractPdfServiceTestAccess {
  loadTemplateBuffer(): Buffer;
  renderTemplate(templateBuffer: Buffer, data: Record<string, string>): Buffer;
  extractRenderedText(renderedDocxBuffer: Buffer): string;
  buildPdfBase64(content: string): Promise<string>;
}

describe('ContractPdfService', () => {
  let service: ContractPdfService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'CONTRACT_RENDER_FALLBACK_VALUE') return undefined;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractPdfService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ContractPdfService>(ContractPdfService);
  });

  it('reemplaza placeholders legacy y usa DATO_FALTANTE para faltantes', async () => {
    const testableService = service as unknown as ContractPdfServiceTestAccess;
    jest
      .spyOn(testableService, 'loadTemplateBuffer')
      .mockReturnValue(Buffer.from('docx', 'utf8'));
    jest
      .spyOn(testableService, 'renderTemplate')
      .mockReturnValue(Buffer.from('rendered-docx', 'utf8'));
    jest
      .spyOn(testableService, 'extractRenderedText')
      .mockReturnValue(
        '[Nombre y Apellido del Cliente], DNI [__], CUIT/CUIL [__], con domicilio en [__]. [NOMBRE DEL FIRMANTE] [DNI DEL FIRMANTE]',
      );
    const buildPdfSpy = jest
      .spyOn(testableService, 'buildPdfBase64')
      .mockResolvedValue('PDF_BASE64');

    const output = await service.generateContractPdf({
      contractId: 'c1',
      caseId: 'c2',
      offerId: 'c3',
      amount: 12345,
      installments: 12,
      tasaNominalAnual: 99,
      userFullName: 'Juan Perez',
      userDni: null,
      userCuit: null,
      userPhone: '+5493510000000',
    });

    const finalText = buildPdfSpy.mock.calls[0]?.[0];

    expect(output.pdfBase64).toBe('PDF_BASE64');
    expect(finalText).toContain('Juan Perez');
    expect(finalText).toContain('DATO_FALTANTE');
    expect(finalText).not.toContain('[__]');
    expect(finalText).not.toContain('[NOMBRE DEL FIRMANTE]');
  });

  it('respeta CONTRACT_RENDER_FALLBACK_VALUE cuando está configurado', async () => {
    const testableService = service as unknown as ContractPdfServiceTestAccess;
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'CONTRACT_RENDER_FALLBACK_VALUE') return 'VALOR_MOCK';
      return undefined;
    });

    jest
      .spyOn(testableService, 'loadTemplateBuffer')
      .mockReturnValue(Buffer.from('docx', 'utf8'));
    jest
      .spyOn(testableService, 'renderTemplate')
      .mockReturnValue(Buffer.from('rendered-docx', 'utf8'));
    jest
      .spyOn(testableService, 'extractRenderedText')
      .mockReturnValue('DNI [__]');
    const buildPdfSpy = jest
      .spyOn(testableService, 'buildPdfBase64')
      .mockResolvedValue('PDF_BASE64');

    await service.generateContractPdf({
      contractId: 'c1',
      caseId: 'c2',
      offerId: 'c3',
      amount: 12345,
      installments: 12,
      tasaNominalAnual: 99,
      userFullName: 'Juan Perez',
      userDni: null,
      userCuit: null,
      userPhone: '+5493510000000',
    });

    const finalText = buildPdfSpy.mock.calls[0]?.[0];
    expect(finalText).toContain('VALOR_MOCK');
  });

  it('falla si quedan placeholders sin resolver', async () => {
    const testableService = service as unknown as ContractPdfServiceTestAccess;
    jest
      .spyOn(testableService, 'loadTemplateBuffer')
      .mockReturnValue(Buffer.from('docx', 'utf8'));
    jest
      .spyOn(testableService, 'renderTemplate')
      .mockReturnValue(Buffer.from('rendered-docx', 'utf8'));
    jest
      .spyOn(testableService, 'extractRenderedText')
      .mockReturnValue('Mutuario: {{MUTUARIO_NOMBRE_COMPLETO}}');

    await expect(
      service.generateContractPdf({
        contractId: 'c1',
        caseId: 'c2',
        offerId: 'c3',
        amount: 12345,
        installments: 12,
        tasaNominalAnual: 99,
        userFullName: 'Juan Perez',
        userDni: null,
        userCuit: null,
        userPhone: '+5493510000000',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
