import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@shared/logger';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({ scope: Scope.REQUEST })
export class SupabaseUserService {
  private readonly logger = new Logger(SupabaseUserService.name);
  private financieraClient: SupabaseClient<any, any, any, any, any> | null = null;
  private seguridadClient: SupabaseClient<any, any, any, any, any> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Inicializa el cliente Supabase para el esquema 'financiera' con el token del usuario
   * Esto permite que RLS funcione correctamente con el contexto del usuario autenticado
   */
  initFinancieraWithToken(token: string): SupabaseClient<any, any, any, any, any> {
    if (this.financieraClient) {
      return this.financieraClient;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuración de Supabase incompleta');
    }

    this.financieraClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      db: {
        schema: 'financiera',
      },
    });

    this.logger.log('Cliente Supabase financiera inicializado con token de usuario');
    return this.financieraClient;
  }

  /**
   * Inicializa el cliente Supabase para el esquema 'seguridad' con el token del usuario
   * Esto permite que RLS funcione correctamente con el contexto del usuario autenticado
   */
  initSeguridadWithToken(token: string): SupabaseClient<any, any, any, any, any> {
    if (this.seguridadClient) {
      return this.seguridadClient;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuración de Supabase incompleta');
    }

    this.seguridadClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      db: {
        schema: 'seguridad',
      },
    });

    this.logger.log('Cliente Supabase seguridad inicializado con token de usuario');
    return this.seguridadClient;
  }

  /**
   * Obtiene el cliente financiera ya inicializado
   */
  getFinancieraClient(): SupabaseClient<any, any, any, any, any> {
    if (!this.financieraClient) {
      throw new Error('Cliente financiera no inicializado. Llama a initFinancieraWithToken() primero.');
    }
    return this.financieraClient;
  }

  /**
   * Obtiene el cliente seguridad ya inicializado
   */
  getSeguridadClient(): SupabaseClient<any, any, any, any, any> {
    if (!this.seguridadClient) {
      throw new Error('Cliente seguridad no inicializado. Llama a initSeguridadWithToken() primero.');
    }
    return this.seguridadClient;
  }
}
