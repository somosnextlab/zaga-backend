/// <reference types="jest" />

import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractPdfService } from './contract-pdf.service';
import { GotenbergPdfConverter } from '../providers/gotenberg-pdf.converter';
import type { ContractTemplateInput } from '../interfaces/contracts.interface';

describe('ContractPdfService', () => {
  const dummyPdf = Buffer.from('%PDF-1.4 dummy');

  const gotenberg = {
    convertDocxToPdf: jest.fn().mockResolvedValue(dummyPdf),
  };

  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const service = new ContractPdfService(
    configService,
    gotenberg as unknown as GotenbergPdfConverter,
  );

  const baseInput: ContractTemplateInput = {
    kind: 'MUTUO',
    contractId: 'c-1',
    caseId: 'case-1',
    offerId: 'offer-1',
    amount: 300000,
    installments: 12,
    tasaNominalAnual: 210,
    userFullName: 'Juan Perez',
    userDni: '12345678',
    userCuit: '20123456789',
    userPhone: '+5493510000000',
    userDomicilio: 'Calle Falsa 123, Córdoba, Córdoba',
    tasaMoratoria: 120,
  };

  const codeudorFields = {
    codeudorFullName: 'Ana Gomez',
    codeudorDni: '30111222',
    codeudorCuit: '27301112224',
    codeudorDomicilio: 'Av Siempre Viva 742, Córdoba, Córdoba',
  };

  beforeEach(() => jest.clearAllMocks());

  it('MUTUO titular -> templateCode/contractVersion de mutuo y PDF de Gotenberg', async () => {
    const out = await service.generateContractPdf(baseInput);

    expect(out.templateCode).toBe('CONTRATO_MUTUO_ZAGA_V1');
    expect(out.contractVersion).toBe('MUTUO_ZAGA_V1');
    expect(out.pdfBase64).toBe(dummyPdf.toString('base64'));
    expect(gotenberg.convertDocxToPdf).toHaveBeenCalledTimes(1);
    expect(gotenberg.convertDocxToPdf).toHaveBeenCalledWith(
      expect.any(Buffer),
      'contrato.docx',
    );
  });

  it('MUTUO_CODEUDOR con datos del codeudor -> templateCode de codeudor', async () => {
    const out = await service.generateContractPdf({
      ...baseInput,
      kind: 'MUTUO_CODEUDOR',
      ...codeudorFields,
    });

    expect(out.templateCode).toBe('CONTRATO_MUTUO_CODEUDOR_ZAGA_V1');
    expect(out.contractVersion).toBe('MUTUO_CODEUDOR_ZAGA_V1');
    expect(gotenberg.convertDocxToPdf).toHaveBeenCalledTimes(1);
  });

  it('REFINANCIACION con codeudor -> templateCode de refi (dinámicos pendientes, no falla)', async () => {
    const out = await service.generateContractPdf({
      ...baseInput,
      kind: 'REFINANCIACION',
      ...codeudorFields,
      refinancedLoanNumber: 'ZAGA-000123',
    });

    expect(out.templateCode).toBe('CONTRATO_REFINANCIACION_ZAGA_V1');
    expect(out.contractVersion).toBe('REFINANCIACION_ZAGA_V1');
    expect(gotenberg.convertDocxToPdf).toHaveBeenCalledTimes(1);
  });

  it('MUTUO_CODEUDOR sin datos del codeudor -> falla y no llama a Gotenberg', async () => {
    await expect(
      service.generateContractPdf({
        ...baseInput,
        kind: 'MUTUO_CODEUDOR',
        codeudorFullName: null,
        codeudorDni: null,
        codeudorCuit: null,
        codeudorDomicilio: null,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(gotenberg.convertDocxToPdf).not.toHaveBeenCalled();
  });
});
