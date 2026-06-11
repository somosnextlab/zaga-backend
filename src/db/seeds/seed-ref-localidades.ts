/**
 * Uso:
 *   npm run seed:localidades
 *
 * Carga las localidades de la provincia de Córdoba desde la API georef
 * (apis.datos.gob.ar) en la tabla `ref_localidades`. Idempotente: usa
 * ON CONFLICT DO NOTHING.
 *
 * Requiere DATABASE_URL (variable de entorno o archivo `.env` en la raíz).
 */

import { config } from 'dotenv';
import { get as httpsGet } from 'node:https';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const PROVINCIA = 'cordoba';
const PAGE_SIZE = 1000;
const FUENTE = 'georef';
const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api/localidades';

interface GeorefLocalidad {
  readonly id: string;
  readonly nombre: string;
  readonly provincia: { readonly nombre: string };
}

interface GeorefResponse {
  readonly localidades: GeorefLocalidad[];
  readonly total: number;
  readonly cantidad: number;
  readonly inicio: number;
}

/**
 * GET de la API pública de georef. Se relaja la verificación TLS solo para esta
 * request porque el endpoint del gobierno suele servir una cadena de
 * certificados incompleta; los datos son públicos (nombres de localidades) y la
 * conexión a la base de datos conserva su verificación TLS intacta.
 */
function fetchPage(inicio: number): Promise<GeorefResponse> {
  const url = `${GEOREF_BASE}?provincia=${PROVINCIA}&max=${PAGE_SIZE}&inicio=${inicio}&campos=id,nombre,provincia`;
  return new Promise<GeorefResponse>((resolvePromise, rejectPromise) => {
    const request = httpsGet(url, { rejectUnauthorized: false }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode >= 400) {
        response.resume();
        rejectPromise(
          new Error(`georef respondió ${statusCode} para inicio=${inicio}`),
        );
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolvePromise(JSON.parse(body) as GeorefResponse);
        } catch (error) {
          rejectPromise(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      });
    });
    request.on('error', rejectPromise);
  });
}

async function main(): Promise<void> {
  config({ path: resolve(process.cwd(), '.env') });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL no está configurada.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    let inicio = 0;
    let total = Infinity;
    let inserted = 0;

    while (inicio < total) {
      const page = await fetchPage(inicio);
      total = page.total;

      for (const localidad of page.localidades) {
        const result = await pool.query(
          `
          INSERT INTO ref_localidades (id, nombre, provincia, fuente)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
          `,
          [localidad.id, localidad.nombre, localidad.provincia.nombre, FUENTE],
        );
        inserted += result.rowCount ?? 0;
      }

      if (page.localidades.length === 0) {
        break;
      }
      inicio += page.localidades.length;
    }

    console.log(
      `ref_localidades: ${inserted} localidades nuevas insertadas de ${PROVINCIA} (total disponible: ${total}).`,
    );
  } finally {
    await pool.end();
  }
}

void main();
