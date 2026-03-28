import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docxtemplater from 'docxtemplater';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import PizZip from 'pizzip';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ContractTemplateInput,
  ContractPdfOutput,
} from '../interfaces/contracts.interface';

const DEFAULT_MISSING_DATA = 'DATO_FALTANTE';

@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);

  public constructor(private readonly configService: ConfigService) {}

  public async generateContractPdf(
    input: ContractTemplateInput,
  ): Promise<ContractPdfOutput> {
    const templateCode = 'CONTRATO_MUTUO_ZAGA_V1';
    const contractVersion = 'MUTUO_ZAGA_V1';
    const fileName = `contrato-${input.caseId}.pdf`;

    const contractVariables = this.buildTemplateVariables(input);
    const templateBuffer = this.loadTemplateBuffer();
    const renderedDocxBuffer = this.renderTemplate(
      templateBuffer,
      contractVariables,
    );
    const contractText = this.extractRenderedText(renderedDocxBuffer);
    const finalText = this.normalizeLegacyPlaceholders(
      contractText,
      contractVariables,
    );
    this.assertNoUnresolvedPlaceholders(finalText);
    const pdfBase64 = await this.buildPdfBase64(finalText);

    return {
      fileName,
      pdfBase64,
      contractVersion,
      templateCode,
    };
  }

  private buildTemplateVariables(
    input: ContractTemplateInput,
  ): Record<string, string> {
    const missing = this.configService.get<string>(
      'CONTRACT_RENDER_FALLBACK_VALUE',
    );
    const fallback = missing?.trim() || DEFAULT_MISSING_DATA;
    const today = new Date();
    const monthName = new Intl.DateTimeFormat('es-AR', {
      month: 'long',
    }).format(today);

    return {
      CIUDAD_FIRMA: fallback,
      DIA_FIRMA: fallback,
      MES_FIRMA: fallback,
      ANIO_FIRMA: String(today.getFullYear()),
      DOMICILIO_ZAGA: fallback,
      MUTUARIO_NOMBRE_COMPLETO: input.userFullName || fallback,
      MUTUARIO_DNI: input.userDni ?? fallback,
      MUTUARIO_CUIT_CUIL: input.userCuit ?? fallback,
      MUTUARIO_DOMICILIO: fallback,
      CAPITAL_PRESTADO_TEXTO: fallback,
      CAPITAL_PRESTADO_NUMERO: String(input.amount),
      TASA_NOMINAL_ANUAL: String(input.tasaNominalAnual),
      CANTIDAD_CUOTAS: String(input.installments),
      TASA_MORATORIA_ANUAL: fallback,
      FIRMANTE_1_NOMBRE: fallback,
      FIRMANTE_1_DNI: fallback,
      FIRMANTE_2_NOMBRE: fallback,
      FIRMANTE_2_DNI: fallback,
      MONTH_NAME_ES: monthName,
      CONTRACT_ID: input.contractId,
      CASE_ID: input.caseId,
      OFFER_ID: input.offerId,
      USER_FULL_NAME: input.userFullName,
      USER_DNI: input.userDni ?? '',
      USER_CUIT: input.userCuit ?? '',
      USER_PHONE: input.userPhone,
      AMOUNT: String(input.amount),
      INSTALLMENTS: String(input.installments),
      TNA: String(input.tasaNominalAnual),
    };
  }

  private loadTemplateBuffer(): Buffer {
    const configuredPath = this.configService.get<string>(
      'CONTRACT_TEMPLATE_DOCX_PATH',
    );
    const candidates = [
      configuredPath ?? '',
      resolve(
        process.cwd(),
        'src',
        'contracts',
        'assets',
        'Contrato_de_Mutuo_ZAGA_V1.docx',
      ),
      resolve(process.cwd(), 'docs', 'Contrato_de_Mutuo_ZAGA_V1.docx'),
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
      'No se encontró la plantilla DOCX de contrato para renderizar.',
    );
  }

  private renderTemplate(
    templateBuffer: Buffer,
    data: Record<string, string>,
  ): Buffer {
    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
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

  private extractRenderedText(renderedDocxBuffer: Buffer): string {
    const zip = new PizZip(renderedDocxBuffer);
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
      throw new InternalServerErrorException(
        'Plantilla DOCX inválida: falta word/document.xml.',
      );
    }

    const xml = documentFile.asText();
    const rawText = xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '');

    return this.decodeXmlEntities(rawText)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_match: string, dec: string) =>
        String.fromCharCode(Number(dec)),
      );
  }

  private normalizeLegacyPlaceholders(
    text: string,
    variables: Record<string, string>,
  ): string {
    return text
      .replace(
        /\[Nombre y Apellido del Cliente\]/g,
        variables.MUTUARIO_NOMBRE_COMPLETO,
      )
      .replace(/\[NOMBRE DEL FIRMANTE\]/g, variables.FIRMANTE_1_NOMBRE)
      .replace(/\[DNI DEL FIRMANTE\]/g, variables.FIRMANTE_1_DNI)
      .replace(/DNI\s+\[__\]/g, `DNI ${variables.MUTUARIO_DNI}`)
      .replace(
        /CUIT\/CUIL\s+\[__\]/g,
        `CUIT/CUIL ${variables.MUTUARIO_CUIT_CUIL}`,
      )
      .replace(
        /con domicilio en\s+\[__\]/g,
        `con domicilio en ${variables.MUTUARIO_DOMICILIO}`,
      )
      .replace(
        /la suma de pesos\s+\[__\]\s+\(\$\[__\]\)/g,
        `la suma de pesos ${variables.CAPITAL_PRESTADO_TEXTO} ($${variables.CAPITAL_PRESTADO_NUMERO})`,
      )
      .replace(
        /fijo del\s+\[__\]%/g,
        `fijo del ${variables.TASA_NOMINAL_ANUAL}%`,
      )
      .replace(
        /pago de\s+\[__\]\s+cuotas/g,
        `pago de ${variables.CANTIDAD_CUOTAS} cuotas`,
      )
      .replace(
        /equivalente al\s+\[__\]%/g,
        `equivalente al ${variables.TASA_MORATORIA_ANUAL}%`,
      )
      .replace(/\[__\]/g, variables.CIUDAD_FIRMA);
  }

  private assertNoUnresolvedPlaceholders(text: string): void {
    const unresolvedDouble = text.match(/\{\{[^}]+\}\}/g) ?? [];
    const unresolvedBracket = text.match(/\[[^\]\n]{1,80}\]/g) ?? [];
    const unresolved = [...unresolvedDouble, ...unresolvedBracket].filter(
      (token) =>
        token.includes('__') ||
        token.toUpperCase().includes('NOMBRE') ||
        token.toUpperCase().includes('DNI') ||
        token.toUpperCase().includes('CUIT') ||
        token.toUpperCase().includes('DOMICILIO'),
    );

    if (unresolved.length > 0) {
      const preview = unresolved.slice(0, 5).join(', ');
      throw new InternalServerErrorException(
        `Plantilla contractual incompleta. Placeholders sin resolver: ${preview}`,
      );
    }
  }

  private async buildPdfBase64(content: string): Promise<string> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const pageWidth = 595;
    const pageHeight = 842;
    const marginLeft = 48;
    const marginTop = 48;
    const maxTextWidth = pageWidth - marginLeft * 2;
    const lineHeight = 14;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - marginTop;

    const normalized = content
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/–/g, '-');

    const paragraphs = normalized.split('\n');
    for (const paragraph of paragraphs) {
      const lines = this.wrapParagraph(paragraph, font, fontSize, maxTextWidth);
      for (const line of lines) {
        if (cursorY <= marginTop) {
          page = pdf.addPage([pageWidth, pageHeight]);
          cursorY = pageHeight - marginTop;
        }
        page.drawText(line, {
          x: marginLeft,
          y: cursorY,
          size: fontSize,
          font,
        });
        cursorY -= lineHeight;
      }
      cursorY -= 2;
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes).toString('base64');
  }

  private wrapParagraph(
    paragraph: string,
    font: PDFFontLike,
    fontSize: number,
    maxTextWidth: number,
  ): string[] {
    const clean = paragraph.trim();
    if (!clean) return [''];
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current.length > 0 ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxTextWidth) {
        current = candidate;
        continue;
      }

      if (current.length > 0) {
        lines.push(current);
      }
      current = word;
    }
    if (current.length > 0) {
      lines.push(current);
    }
    return lines;
  }
}

interface PDFFontLike {
  widthOfTextAtSize(text: string, size: number): number;
}
