import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    this.supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error(
        'SUPABASE_PROJECT_URL y SUPABASE_ANON_KEY son requeridos',
      );
    }
  }

  /**
   * Crea un cliente Supabase on-behalf-of para un usuario específico
   * Este cliente respeta las políticas RLS basadas en el JWT del usuario
   *
   * @param accessToken - JWT token del usuario autenticado
   * @returns Cliente Supabase configurado para el usuario
   */
  createClientForUser(accessToken: string): SupabaseClient {
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        // Deshabilitar auto refresh para evitar conflictos
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Crea un cliente Supabase con service role (solo para operaciones administrativas)
   * ⚠️ USAR SOLO EN WORKERS O PROCESOS INTERNOS, NUNCA EN CONTROLADORES
   *
   * @returns Cliente Supabase con service role
   */
  createServiceRoleClient(): SupabaseClient {
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!serviceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY es requerida para operaciones administrativas',
      );
    }

    return createClient(this.supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Valida que el token JWT sea válido y no esté expirado
   *
   * @param accessToken - JWT token a validar
   * @returns Promise<boolean> - true si el token es válido
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const client = this.createClientForUser(accessToken);
      const {
        data: { user },
        error,
      } = await client.auth.getUser();

      if (error || !user) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información del usuario desde el token JWT
   *
   * @param accessToken - JWT token del usuario
   * @returns Promise con información del usuario o null si no es válido
   */
  async getUserFromToken(accessToken: string): Promise<any | null> {
    try {
      const client = this.createClientForUser(accessToken);
      const {
        data: { user },
        error,
      } = await client.auth.getUser();

      if (error || !user) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }
}
