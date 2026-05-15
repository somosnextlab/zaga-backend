/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Uso:
 *   npm run admin:create-user -- --email=admin@zaga.com.ar --name="Administrador ZAGA" --role=CEO
 *
 * La contraseña se solicita por consola de forma oculta (Password / Confirm password).
 *
 * Requiere DATABASE_URL (variable de entorno o archivo `.env` en la raíz del proyecto).
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';
import prompts from 'prompts';
import { Client } from 'pg';

type Role = 'CEO' | 'STAFF' | 'READ_ONLY';

function argValue(flag: string): string | undefined {
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (prefixed) {
    return prefixed.slice(flag.length + 1);
  }
  return undefined;
}

function readIdentity(): {
  email: string;
  fullName: string;
  role: Role;
} {
  const email =
    argValue('--email') ?? process.env.ZAGA_ADMIN_EMAIL?.trim() ?? '';
  const fullName =
    argValue('--name') ?? process.env.ZAGA_ADMIN_FULL_NAME?.trim() ?? '';
  const roleRaw =
    argValue('--role') ?? process.env.ZAGA_ADMIN_ROLE?.trim() ?? '';

  if (!email || !fullName || !roleRaw) {
    // eslint-disable-next-line no-console
    console.error(
      'Faltan --email, --name o --role. Ejemplo: npm run admin:create-user -- --email=a@b.com --name="Nombre" --role=CEO',
    );
    process.exit(1);
  }

  const role = roleRaw.toUpperCase() as Role;
  if (!['CEO', 'STAFF', 'READ_ONLY'].includes(role)) {
    // eslint-disable-next-line no-console
    console.error('role debe ser CEO | STAFF | READ_ONLY');
    process.exit(1);
  }

  return { email, fullName, role };
}

/**
 * Solo para entornos no interactivos con NODE_ENV=development.
 * No imprime la contraseña.
 */
function readPasswordNonInteractiveDevOnly(): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const fromEnv = process.env.ZAGA_ADMIN_PASSWORD;
  if (fromEnv !== undefined && fromEnv.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[zaga] ZAGA_ADMIN_PASSWORD solo está soportado con NODE_ENV=development. No uses esto en staging/producción.',
    );
    return fromEnv;
  }

  const fromArg = argValue('--password');
  if (fromArg !== undefined && fromArg.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[zaga] --password por CLI solo con NODE_ENV=development. Tu shell puede guardar el comando en el historial; evitalo fuera de dev.',
    );
    return fromArg;
  }

  return null;
}

async function readPasswordInteractive(): Promise<string> {
  const first = await prompts(
    {
      type: 'password',
      name: 'value',
      message: 'Password:',
    },
    { onCancel: () => process.exit(1) },
  );

  const second = await prompts(
    {
      type: 'password',
      name: 'value',
      message: 'Confirm password:',
    },
    { onCancel: () => process.exit(1) },
  );

  const a = typeof first.value === 'string' ? first.value : '';
  const b = typeof second.value === 'string' ? second.value : '';

  if (a.length === 0) {
    // eslint-disable-next-line no-console
    console.error('La contraseña no puede estar vacía.');
    process.exit(1);
  }

  if (a !== b) {
    // eslint-disable-next-line no-console
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }

  return a;
}

async function readPassword(): Promise<string> {
  if (process.stdin.isTTY) {
    return readPasswordInteractive();
  }

  const dev = readPasswordNonInteractiveDevOnly();
  if (dev !== null) {
    return dev;
  }

  // eslint-disable-next-line no-console
  console.error(
    'Sin TTY interactivo: no se puede pedir contraseña oculta. Ejecutá el script en una terminal, o en NODE_ENV=development definí ZAGA_ADMIN_PASSWORD (solo dev).',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  config({ path: resolve(process.cwd(), '.env') });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL no está configurada.');
    process.exit(1);
  }

  const { email, fullName, role } = readIdentity();
  const password = await readPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const normalizedEmail = email.trim().toLowerCase();
    await client.query(
      `
      INSERT INTO admin_users (
        email, password_hash, full_name, role, is_active,
        failed_login_attempts, locked_until, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, true, 0, NULL, now(), now()
      )
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = now()
      `,
      [normalizedEmail, passwordHash, fullName, role],
    );

    // eslint-disable-next-line no-console
    console.log(
      `Usuario admin listo (insert o actualización): ${normalizedEmail} (${role}).`,
    );
  } finally {
    await client.end();
  }
}

void main();
