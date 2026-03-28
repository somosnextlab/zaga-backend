/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import AdmZip from 'adm-zip';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  ContractTemplateInput,
  ContractPdfOutput,
} from '../interfaces/contracts.interface';

@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);

  public constructor(private readonly configService: ConfigService) {}

  public generateContractPdf(input: ContractTemplateInput): ContractPdfOutput {
    const templateCode = 'CONTRATO_MUTUO_ZAGA_V1';
    const contractVersion = 'MUTUO_ZAGA_V1';
    const fileName = `contrato-${input.caseId}.pdf`;

    const contractVariables = this.buildTemplateVariables(input);
    const templateText = this.loadContractTemplateText();
    const contractText = this.applyTemplateVariables(
      templateText,
      contractVariables,
    );
    const finalText = this.appendOperationalSummary(contractText, input);
    const pdfBase64 = this.buildPdfBase64(finalText);

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
    return {
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

  private loadContractTemplateText(): string {
    const configuredPath = this.configService.get<string>(
      'CONTRACT_TEMPLATE_DOCX_PATH',
    );
    const candidates = [
      configuredPath ?? '',
      resolve(process.cwd(), '..', 'docs', 'Contrato_de_Mutuo_ZAGA_V1.docx'),
      resolve(process.cwd(), 'docs', 'Contrato_de_Mutuo_ZAGA_V1.docx'),
    ].filter((path) => path.length > 0);

    for (const path of candidates) {
      if (!existsSync(path)) {
        continue;
      }

      try {
        const zip = new AdmZip(path);
        const documentEntry = zip.getEntry('word/document.xml');
        if (!documentEntry) {
          continue;
        }

        const xml = documentEntry.getData().toString('utf8');
        const rawText = xml
          .replace(/<w:tab\/>/g, '\t')
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '');

        const normalized = this.decodeXmlEntities(rawText)
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (normalized.length > 0) {
          return normalized;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `No se pudo leer plantilla DOCX (${path}): ${message}`,
        );
      }
    }

    this.logger.warn(
      'No se encontró la plantilla DOCX de contrato. Se utiliza contenido mínimo de fallback.',
    );
    return 'CONTRATO DE MUTUO - ZAGA';
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

  private applyTemplateVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [
        new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'),
        new RegExp(`\\[\\s*${escapedKey}\\s*\\]`, 'g'),
        new RegExp(`\\$\\{\\s*${escapedKey}\\s*\\}`, 'g'),
      ];

      for (const pattern of patterns) {
        result = result.replace(pattern, value);
      }
    }

    return result;
  }

  private appendOperationalSummary(
    contractText: string,
    input: ContractTemplateInput,
  ): string {
    const summary = [
      '',
      '---',
      'DATOS OPERATIVOS',
      `contract_id: ${input.contractId}`,
      `case_id: ${input.caseId}`,
      `offer_id: ${input.offerId}`,
      `mutuario: ${input.userFullName}`,
      `dni: ${input.userDni ?? ''}`,
      `cuit: ${input.userCuit ?? ''}`,
      `telefono: ${input.userPhone}`,
      `capital_prestado: ${input.amount}`,
      `cuotas: ${input.installments}`,
      `tna: ${input.tasaNominalAnual}`,
    ].join('\n');

    return `${contractText}\n${summary}`.trim();
  }

  private buildPdfBase64(content: string): string {
    const lines = this.wrapLines(content, 95).slice(0, 58);
    const escapedLines = lines.map((line) => this.escapePdfText(line));
    const stream = [
      'BT',
      '/F1 10 Tf',
      '72 800 Td',
      '14 TL',
      ...escapedLines.map((line) => `(${line}) Tj T*`),
      'ET',
    ].join('\n');

    const streamLength = Buffer.byteLength(stream, 'utf8');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += object;
    }

    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += 'xref\n0 6\n0000000000 65535 f \n';
    for (let index = 1; index <= 5; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, 'utf8').toString('base64');
  }

  private wrapLines(content: string, maxChars: number): string[] {
    const paragraphs = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChars) {
        lines.push(paragraph);
        continue;
      }

      const words = paragraph.split(/\s+/);
      let current = '';
      for (const word of words) {
        const tentative = current.length > 0 ? `${current} ${word}` : word;
        if (tentative.length <= maxChars) {
          current = tentative;
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
    }

    return lines.length > 0 ? lines : ['CONTRATO DE MUTUO - ZAGA'];
  }

  private escapePdfText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }
}
