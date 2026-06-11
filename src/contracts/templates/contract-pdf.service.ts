import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ContractKind,
  ContractTemplateInput,
  ContractPdfOutput,
} from '../interfaces/contracts.interface';
import { GotenbergPdfConverter } from '../providers/gotenberg-pdf.converter';
import { numberToSpanishWords } from '../utils/number-to-words';

const DEFAULT_MISSING_DATA = 'DATO_FALTANTE';
// Marcador neutro para campos de refinanciación que recién se calculan en el
// desembolso (importe de cuota, fechas). No es un dato obligatorio faltante:
// el contrato de refi se emite "parcial" con estos blancos a completar.
const PENDING_FIELD = '__________';

interface ContractKindConfig {
  readonly templateFile: string;
  readonly templateCode: string;
  readonly contractVersion: string;
}

const CONTRACT_KIND_MAP: Record<ContractKind, ContractKindConfig> = {
  MUTUO: {
    templateFile: 'Contrato_de_Mutuo_ZAGA_V1.docx',
    templateCode: 'CONTRATO_MUTUO_ZAGA_V1',
    contractVersion: 'MUTUO_ZAGA_V1',
  },
  MUTUO_CODEUDOR: {
    templateFile: 'Contrato_de_Mutuo_Codeudor_ZAGA_V1.docx',
    templateCode: 'CONTRATO_MUTUO_CODEUDOR_ZAGA_V1',
    contractVersion: 'MUTUO_CODEUDOR_ZAGA_V1',
  },
  REFINANCIACION: {
    templateFile: 'Contrato_de_Refinanciacion_ZAGA_V1.docx',
    templateCode: 'CONTRATO_REFINANCIACION_ZAGA_V1',
    contractVersion: 'REFINANCIACION_ZAGA_V1',
  },
};

@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);

  public constructor(
    private readonly configService: ConfigService,
    private readonly gotenbergPdfConverter: GotenbergPdfConverter,
  ) {}

  public async generateContractPdf(
    input: ContractTemplateInput,
  ): Promise<ContractPdfOutput> {
    const kindConfig = CONTRACT_KIND_MAP[input.kind];
    if (!kindConfig) {
      throw new InternalServerErrorException(
        `Tipo de contrato no soportado: ${String(input.kind)}`,
      );
    }
    const fileName = `contrato-${input.caseId}.pdf`;

    const contractVariables = this.buildTemplateVariables(input);
    const templateBuffer = this.loadTemplateBuffer(kindConfig.templateFile);
    const renderedDocxBuffer = this.renderTemplate(
      templateBuffer,
      contractVariables,
    );
    this.assertNoUnresolvedPlaceholders(
      renderedDocxBuffer,
      this.resolveFallback(),
    );

    const pdfBuffer = await this.gotenbergPdfConverter.convertDocxToPdf(
      renderedDocxBuffer,
      'contrato.docx',
    );
    const pdfBase64 = pdfBuffer.toString('base64');

    return {
      fileName,
      pdfBase64,
      contractVersion: kindConfig.contractVersion,
      templateCode: kindConfig.templateCode,
    };
  }

  private resolveFallback(): string {
    const missing = this.configService.get<string>(
      'CONTRACT_RENDER_FALLBACK_VALUE',
    );
    return missing?.trim() || DEFAULT_MISSING_DATA;
  }

  private buildTemplateVariables(
    input: ContractTemplateInput,
  ): Record<string, string> {
    const fallback = this.resolveFallback();
    const today = new Date();
    const monthName = new Intl.DateTimeFormat('es-AR', {
      month: 'long',
    }).format(today);

    const usesCodeudor =
      input.kind === 'MUTUO_CODEUDOR' || input.kind === 'REFINANCIACION';

    return {
      CIUDAD_FIRMA: 'Córdoba',
      DIA_FIRMA: String(today.getDate()),
      MES_FIRMA: monthName,
      ANIO_FIRMA: String(today.getFullYear()),
      DOMICILIO_ZAGA:
        'Mayor Arruabarrena 1895 Oficina 11 B, Córdoba, Argentina',
      MUTUARIO_NOMBRE_COMPLETO: input.userFullName || fallback,
      MUTUARIO_DNI: input.userDni ?? fallback,
      MUTUARIO_CUIT_CUIL: input.userCuit ?? fallback,
      MUTUARIO_DOMICILIO: input.userDomicilio ?? fallback,
      CAPITAL_PRESTADO_TEXTO: numberToSpanishWords(input.amount),
      CAPITAL_PRESTADO_NUMERO: this.formatAmount(input.amount),
      TASA_NOMINAL_ANUAL: String(input.tasaNominalAnual),
      CANTIDAD_CUOTAS: String(input.installments),
      TASA_MORATORIA_ANUAL:
        input.tasaMoratoria != null ? String(input.tasaMoratoria) : fallback,
      PERIODICIDAD: input.periodicidad?.trim() || 'semanales',
      // Aclaración de firma: se deja en blanco (igual que Codeudor/Refi). La
      // identidad del firmante la aporta la firma biométrica de Signatura; el
      // bloque tiene dos columnas (ZAGA / Mutuario) y no debemos imprimir el
      // nombre del mutuario en la columna de ZAGA.
      FIRMANTE_NOMBRE: '',
      FIRMANTE_DNI: '',
      // Codeudor: solo aplica a MUTUO_CODEUDOR / REFINANCIACION.
      CODEUDOR_NOMBRE_COMPLETO: usesCodeudor
        ? input.codeudorFullName || fallback
        : fallback,
      CODEUDOR_DNI: usesCodeudor ? (input.codeudorDni ?? fallback) : fallback,
      CODEUDOR_CUIT_CUIL: usesCodeudor
        ? (input.codeudorCuit ?? fallback)
        : fallback,
      CODEUDOR_DOMICILIO: usesCodeudor
        ? (input.codeudorDomicilio ?? fallback)
        : fallback,
      // Refinanciación: datos del préstamo anterior. Los campos que recién se
      // calculan en el desembolso (importe de cuota, fechas) quedan como
      // pendientes (marcador neutro), no como dato obligatorio faltante.
      REFINANCIA_PRESTAMO_NUMERO: input.refinancedLoanNumber ?? PENDING_FIELD,
      REFINANCIA_FECHA_ORIGINAL: PENDING_FIELD,
      REFINANCIA_FECHA_LIQUIDACION: PENDING_FIELD,
      REFINANCIA_CUOTA_IMPORTE_TEXTO: PENDING_FIELD,
      REFINANCIA_CUOTA_IMPORTE_NUMERO: PENDING_FIELD,
      REFINANCIA_PRIMERA_CUOTA_FECHA: PENDING_FIELD,
    };
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private loadTemplateBuffer(templateFile: string): Buffer {
    const configuredPath = this.configService.get<string>(
      'CONTRACT_TEMPLATE_DOCX_PATH',
    );
    const candidates = [
      // Override solo para testing local.
      configuredPath ?? '',
      resolve(process.cwd(), 'src', 'contracts', 'assets', templateFile),
      resolve(process.cwd(), 'docs', templateFile),
    ].filter((path) => path.length > 0);

    for (const path of candidates) {
      if (!existsSync(path)) {
        continue;
      }

      try {
        return readFileSync(path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `No se pudo leer plantilla DOCX (${path}): ${message}`,
        );
      }
    }

    throw new InternalServerErrorException(
      `No se encontró la plantilla DOCX de contrato (${templateFile}).`,
    );
  }

  private renderTemplate(
    templateBuffer: Buffer,
    data: Record<string, string>,
  ): Buffer {
    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        linebreaks: true,
        paragraphLoop: true,
      });
      doc.render(data);
      const rendered = doc.getZip().generate({ type: 'nodebuffer' });
      return Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo renderizar el DOCX de contrato: ${message}`,
      );
      throw new InternalServerErrorException(
        'No fue posible completar la plantilla del contrato.',
      );
    }
  }

  /**
   * Falla si el docx renderizado tiene tags `{{...}}` sin resolver, blancos
   * crudos (`[__]` / `[]`), o el sentinel de dato obligatorio faltante
   * (p. ej. faltó un dato del codeudor cuando correspondía). Los campos
   * dinámicos de refinanciación usan un marcador de pendiente distinto, que no
   * se considera incompleto.
   */
  private assertNoUnresolvedPlaceholders(
    renderedDocxBuffer: Buffer,
    fallback: string,
  ): void {
    const text = this.extractDocxPlainText(renderedDocxBuffer);
    const unresolved: string[] = text.match(/\{\{[^}]*\}\}|\[__\]|\[\]/g) ?? [];
    if (text.includes(fallback)) {
      unresolved.push(fallback);
    }

    if (unresolved.length > 0) {
      const preview = unresolved.slice(0, 5).join(', ');
      throw new InternalServerErrorException(
        `Plantilla contractual incompleta. Placeholders sin resolver: ${preview}`,
      );
    }
  }

  private extractDocxPlainText(renderedDocxBuffer: Buffer): string {
    const zip = new PizZip(renderedDocxBuffer);
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
      throw new InternalServerErrorException(
        'Plantilla DOCX inválida: falta word/document.xml.',
      );
    }

    const xml = documentFile.asText();
    return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join('');
  }
}
