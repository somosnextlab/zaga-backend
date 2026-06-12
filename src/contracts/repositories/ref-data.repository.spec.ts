import { DbClient } from '../../db/db.service';
import { RefDataRepository } from './ref-data.repository';

describe('RefDataRepository.localidadExistsForProvincia', () => {
  const repository = new RefDataRepository();

  function mockClient(exists: boolean): { client: DbClient; query: jest.Mock } {
    const query = jest.fn().mockResolvedValue({ rows: [{ exists }] });
    return { client: { query } as unknown as DbClient, query };
  }

  it('compara de forma tolerante a tildes (unaccent en ambos lados)', async () => {
    const { client, query } = mockClient(true);

    const result = await repository.localidadExistsForProvincia(
      client,
      'cordoba',
      'cordoba',
    );

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('unaccent(lower(nombre)) = unaccent(lower($1))'),
      ['cordoba', 'cordoba'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'unaccent(lower(provincia)) = unaccent(lower($2))',
      ),
      ['cordoba', 'cordoba'],
    );
  });

  it('devuelve false cuando no existe la localidad', async () => {
    const { client } = mockClient(false);

    const result = await repository.localidadExistsForProvincia(
      client,
      'inexistente',
      'cordoba',
    );

    expect(result).toBe(false);
  });
});
