/// <reference types="jest" />

import { ConfigService } from '@nestjs/config';
import { SignaturaService } from './signatura.service';
import type { SignaturaCreateDocumentRequest } from '../interfaces/signatura.types';

describe('SignaturaService.createDocument', () => {
  const buildService = (): SignaturaService => {
    const config = {
      get: (key: string): string | undefined => {
        if (key === 'SIGNATURA_API_BASE_URL')
          return 'https://api.signatura.test';
        if (key === 'SIGNATURA_API_KEY') return 'test-key';
        return undefined;
      },
    } as unknown as ConfigService;
    return new SignaturaService(config);
  };

  const jsonResponse = (body: unknown): Response =>
    ({
      ok: true,
      headers: { get: (): string => 'application/json' },
      json: (): Promise<unknown> => Promise.resolve(body),
      text: (): Promise<string> => Promise.resolve(JSON.stringify(body)),
    }) as unknown as Response;

  const baseRequest: SignaturaCreateDocumentRequest = {
    contractId: 'contract-1',
    fileName: 'contract.pdf',
    pdfBase64: 'UEZERGF0YQ==',
    signers: [
      {
        role: 'TITULAR',
        fullName: 'Juan Perez',
        documentNumber: '12345678',
        cuit: '20123456789',
        phone: '+5493511234567',
      },
      {
        role: 'CODEUDOR',
        fullName: 'Ana Gomez',
        documentNumber: '30111222',
        cuit: '27301112224',
        phone: '+5493517654321',
      },
    ],
    metadata: {},
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('con 2 firmantes envía 2 firmas y devuelve ids/urls en orden', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 'doc-1',
        status: 'PE',
        creation_date: '2026-06-13T00:00:00Z',
        signatures: [
          { id: 'sig-titular', status: 'IN', url: 'https://signatura/titular' },
          {
            id: 'sig-codeudor',
            status: 'IN',
            url: 'https://signatura/codeudor',
          },
        ],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = buildService();
    const result = await service.createDocument(baseRequest);

    const fetchCall = fetchMock.mock.calls[0] as [string, { body: string }];
    const requestBody = JSON.parse(fetchCall[1].body) as {
      signatures: unknown[];
    };
    expect(requestBody.signatures).toHaveLength(2);

    expect(result.externalDocumentId).toBe('doc-1');
    expect(result.signatures).toHaveLength(2);
    expect(result.signatures[0]).toEqual({
      externalSignatureId: 'sig-titular',
      signatureStatus: 'IN',
      signatureUrl: 'https://signatura/titular',
    });
    expect(result.signatures[1]).toEqual({
      externalSignatureId: 'sig-codeudor',
      signatureStatus: 'IN',
      signatureUrl: 'https://signatura/codeudor',
    });
  });

  it('lanza error si llegan menos firmas de las enviadas', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 'doc-1',
        status: 'PE',
        signatures: [{ id: 'sig-titular', status: 'IN', url: null }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = buildService();
    await expect(service.createDocument(baseRequest)).rejects.toThrow();
  });
});
