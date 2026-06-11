/// <reference types="jest" />

import { ConfigService } from '@nestjs/config';
import { GotenbergPdfConverter } from './gotenberg-pdf.converter';

describe('GotenbergPdfConverter', () => {
  const buildConverter = (config: Record<string, string>) => {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService;
    return new GotenbergPdfConverter(configService);
  };

  const okResponse = () =>
    ({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    }) as unknown as Response;

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('no manda Authorization si faltan credenciales', async () => {
    const converter = buildConverter({
      GOTENBERG_URL: 'http://gotenberg:3000',
    });

    const pdf = await converter.convertDocxToPdf(Buffer.from('docx'));

    expect(pdf).toBeInstanceOf(Buffer);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({});
  });

  it('agrega Basic Auth cuando GOTENBERG_USER/PASS están seteadas', async () => {
    const converter = buildConverter({
      GOTENBERG_URL: 'http://gotenberg:3000/',
      GOTENBERG_USER: 'zaga',
      GOTENBERG_PASS: 's3cret',
    });

    await converter.convertDocxToPdf(Buffer.from('docx'));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://gotenberg:3000/forms/libreoffice/convert');
    const expected = `Basic ${Buffer.from('zaga:s3cret').toString('base64')}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      expected,
    );
  });

  it('lanza si GOTENBERG_URL no está configurada', async () => {
    const converter = buildConverter({});
    await expect(
      converter.convertDocxToPdf(Buffer.from('docx')),
    ).rejects.toThrow('GOTENBERG_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lanza si Gotenberg responde con error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('bad gateway'),
    } as unknown as Response);
    const converter = buildConverter({
      GOTENBERG_URL: 'http://gotenberg:3000',
    });

    await expect(
      converter.convertDocxToPdf(Buffer.from('docx')),
    ).rejects.toThrow('Gotenberg');
  });
});
