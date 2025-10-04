import { BcraAdapter } from '@modules/fuentes-externas/adapters/bcra.adapter';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';
import { Job } from 'bullmq';

export interface ConsultaFuenteJob {
  tipo: 'consulta_fuente:BCRA';
  persona_id: string;
  solicitud_id: string;
  cuit: string;
}

export interface ConsolidarEvaluacionJob {
  tipo: 'consolidar_evaluacion';
  solicitud_id: string;
}

@Processor('evaluacion')
export class EvaluacionProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluacionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bcraAdapter: BcraAdapter,
  ) {
    super();
  }

  async process(
    job: Job<ConsultaFuenteJob | ConsolidarEvaluacionJob>,
  ): Promise<unknown> {
    this.logger.log(`Procesando job ${job.id} de tipo ${job.data.tipo}`);

    try {
      switch (job.data.tipo) {
        case 'consulta_fuente:BCRA':
          return await this.procesarConsultaBcra(job.data as ConsultaFuenteJob);
        case 'consolidar_evaluacion':
          return await this.procesarConsolidarEvaluacion(
            job.data as ConsolidarEvaluacionJob,
          );
        default:
          throw new Error(
            `Tipo de job no reconocido: ${(job.data as { tipo: string }).tipo}`,
          );
      }
    } catch (error) {
      this.logger.error(`Error procesando job ${job.id}:`, error);
      throw error;
    }
  }

  private async procesarConsultaBcra(data: ConsultaFuenteJob) {
    this.logger.log(`Consultando BCRA para persona ${data.persona_id}`);

    const situacion = await this.bcraAdapter.getSituacion(data.cuit);

    // Guardar resultado en la base de datos
    await this.prisma.financiera_fuentes_externas.upsert({
      where: {
        id: `bcra-${data.persona_id}-${data.solicitud_id}`,
      },
      update: {
        config: {
          persona_id: data.persona_id,
          solicitud_id: data.solicitud_id,
          resultado: situacion as object,
          consultado_en: new Date(),
        },
      },
      create: {
        id: `bcra-${data.persona_id}-${data.solicitud_id}`,
        nombre: 'BCRA',
        tipo: 'consulta_situacion',
        config: {
          persona_id: data.persona_id,
          solicitud_id: data.solicitud_id,
          resultado: situacion as object,
          consultado_en: new Date(),
        },
        activa: true,
      },
    });

    this.logger.log(`Consulta BCRA completada para persona ${data.persona_id}`);
    return situacion;
  }

  private async procesarConsolidarEvaluacion(data: ConsolidarEvaluacionJob) {
    this.logger.log(
      `Consolidando evaluación para solicitud ${data.solicitud_id}`,
    );

    // Obtener datos de la solicitud
    const solicitud = await this.prisma.financiera_solicitudes.findUnique({
      where: { id: data.solicitud_id },
      include: {
        cliente: {
          include: {
            persona: true,
          },
        },
      },
    });

    if (!solicitud) {
      throw new Error(`Solicitud ${data.solicitud_id} no encontrada`);
    }

    // Obtener consultas de fuentes externas
    const consultasBcra =
      await this.prisma.financiera_fuentes_externas.findMany({
        where: {
          nombre: 'BCRA',
          tipo: 'consulta_situacion',
          config: {
            path: ['solicitud_id'],
            equals: data.solicitud_id,
          },
        },
      });

    // Calcular score basado en las consultas
    let score = 0;
    let categoria = 'C';
    let observaciones = '';

    if (consultasBcra.length > 0) {
      const ultimaConsulta = consultasBcra[0];
      const resultado = ultimaConsulta.config as {
        resultado: { categoria: string; mora?: boolean };
      };

      if (resultado.resultado.categoria === 'A') {
        score = 85;
        categoria = 'A';
        observaciones = 'Excelente situación crediticia';
      } else if (resultado.resultado.categoria === 'B') {
        score = 65;
        categoria = 'B';
        observaciones = 'Buena situación crediticia';
      } else {
        score = 35;
        categoria = 'C';
        observaciones = 'Situación crediticia regular';
      }

      if (resultado.resultado.mora) {
        score -= 20;
        observaciones += '. Presenta mora';
      }
    } else {
      score = 50;
      categoria = 'C';
      observaciones = 'Sin información crediticia disponible';
    }

    // Crear evaluación
    const evaluacion = await this.prisma.financiera_evaluaciones.create({
      data: {
        solicitud_id: data.solicitud_id,
        score: score,
        categoria: categoria,
        observaciones: observaciones,
        estado: 'completada',
      },
    });

    this.logger.log(
      `Evaluación consolidada para solicitud ${data.solicitud_id}: Score ${score}, Categoría ${categoria}`,
    );
    return evaluacion;
  }
}
