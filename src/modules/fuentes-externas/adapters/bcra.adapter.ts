import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BcraSituacion {
  categoria: string;
  mora: boolean;
  deuda_total: number;
  cuotas_vencidas: number;
  ultima_actualizacion: Date;
}

@Injectable()
export class BcraAdapter {
  private readonly logger = new Logger(BcraAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('BCRA_API_BASE_URL');
    this.apiKey = this.configService.get<string>('BCRA_API_KEY');
  }

  async getSituacion(cuit: string): Promise<BcraSituacion> {
    this.logger.log(`Consultando situación BCRA para CUIT: ${cuit}`);

    // Si no hay API key configurada, retornar datos simulados
    if (!this.apiKey || this.apiKey === 'changeme') {
      this.logger.warn('API Key de BCRA no configurada, retornando datos simulados');
      return this.getSituacionSimulada(cuit);
    }

    try {
      // Aquí iría la implementación real de la API de BCRA
      // Por ahora retornamos datos simulados
      return this.getSituacionSimulada(cuit);
    } catch (error) {
      this.logger.error('Error al consultar BCRA:', error);
      throw new Error('Error al consultar información de BCRA');
    }
  }

  private getSituacionSimulada(cuit: string): BcraSituacion {
    // Simular diferentes categorías basadas en el CUIT
    const ultimoDigito = parseInt(cuit.slice(-1));
    
    let categoria: string;
    let mora: boolean;
    let deuda_total: number;
    let cuotas_vencidas: number;

    if (ultimoDigito % 3 === 0) {
      categoria = 'A';
      mora = false;
      deuda_total = 0;
      cuotas_vencidas = 0;
    } else if (ultimoDigito % 3 === 1) {
      categoria = 'B';
      mora = false;
      deuda_total = 50000;
      cuotas_vencidas = 0;
    } else {
      categoria = 'C';
      mora = true;
      deuda_total = 150000;
      cuotas_vencidas = 3;
    }

    return {
      categoria,
      mora,
      deuda_total,
      cuotas_vencidas,
      ultima_actualizacion: new Date(),
    };
  }
}
