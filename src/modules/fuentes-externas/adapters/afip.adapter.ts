import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AfipSituacion {
  cuit: string;
  razon_social: string;
  actividad_principal: string;
  fecha_inicio_actividad: Date;
  estado: string;
  ultima_actualizacion: Date;
}

@Injectable()
export class AfipAdapter {
  private readonly logger = new Logger(AfipAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AFIP_API_BASE_URL');
    this.apiKey = this.configService.get<string>('AFIP_API_KEY');
  }

  async getSituacion(cuit: string): Promise<AfipSituacion> {
    this.logger.log(`Consultando situación AFIP para CUIT: ${cuit}`);

    // Si no hay API key configurada, retornar datos simulados
    if (!this.apiKey || this.apiKey === 'changeme') {
      this.logger.warn('API Key de AFIP no configurada, retornando datos simulados');
      return this.getSituacionSimulada(cuit);
    }

    try {
      // Aquí iría la implementación real de la API de AFIP
      // Por ahora retornamos datos simulados
      return this.getSituacionSimulada(cuit);
    } catch (error) {
      this.logger.error('Error al consultar AFIP:', error);
      throw new Error('Error al consultar información de AFIP');
    }
  }

  private getSituacionSimulada(cuit: string): AfipSituacion {
    return {
      cuit,
      razon_social: `Empresa ${cuit.slice(-4)} S.A.`,
      actividad_principal: 'Comercio',
      fecha_inicio_actividad: new Date('2020-01-01'),
      estado: 'Activo',
      ultima_actualizacion: new Date(),
    };
  }
}
