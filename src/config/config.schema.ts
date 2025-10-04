import { z } from 'zod';

export const configSchema = z.object({
  // Server
  API_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL es requerida'),

  // Supabase
  SUPABASE_PROJECT_URL: z.string().url('SUPABASE_PROJECT_URL debe ser una URL válida').optional(),
  SUPABASE_JWKS_URL: z.string().url('SUPABASE_JWKS_URL debe ser una URL válida').optional(),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY es requerida').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY es requerida').optional(),

  // External APIs
  BCRA_API_BASE_URL: z.string().url().optional(),
  BCRA_API_KEY: z.string().optional(),
  AFIP_API_BASE_URL: z.string().url().optional(),
  AFIP_API_KEY: z.string().optional(),
});

export type ConfigSchema = z.infer<typeof configSchema>;
