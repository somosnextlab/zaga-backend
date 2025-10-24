import { z } from 'zod';

export const envSchema = z.object({
  // Configuración del servidor
  API_PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Base de datos
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida'),

  // Redis (opcional)
  REDIS_URL: z.string().optional(),

  // Supabase
  SUPABASE_PROJECT_URL: z
    .string()
    .url('SUPABASE_PROJECT_URL debe ser una URL válida'),
  SUPABASE_JWKS_URL: z
    .string()
    .url('SUPABASE_JWKS_URL debe ser una URL válida'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY es requerida'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY es requerida'),
});

export type EnvConfig = z.infer<typeof envSchema>;
