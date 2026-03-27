import { Injectable } from '@nestjs/common';
import {
  ContractTemplateInput,
  ContractPdfOutput,
} from '../interfaces/contracts.interface';

@Injectable()
export class ContractPdfService {
  public generateContractPdf(input: ContractTemplateInput): ContractPdfOutput {
    const templateCode = 'CONTRATO_MUTUO_ZAGA_V1';
    const contractVersion = 'MUTUO_ZAGA_V1';
    const fileName = `contrato-${input.caseId}.pdf`;

    // TODO(etapa-3): reemplazar por motor legal definitivo DOCX/PDF.
    const contractText = [
      'CONTRATO DE MUTUO - ZAGA',
      `contract_id=${input.contractId}`,
      `case_id=${input.caseId}`,
      `offer_id=${input.offerId}`,
      `mutuario=${input.userFullName}`,
      `dni=${input.userDni ?? ''}`,
      `cuit=${input.userCuit ?? ''}`,
      `phone=${input.userPhone}`,
      `capital_prestado=${input.amount}`,
      `cuotas=${input.installments}`,
      `tna=${input.tasaNominalAnual}`,
      `template=${templateCode}`,
      `version=${contractVersion}`,
    ].join('\n');

    const pdfBase64 = this.buildMinimalPdfBase64(contractText);

    return {
      fileName,
      pdfBase64,
      contractVersion,
      templateCode,
    };
  }

  private buildMinimalPdfBase64(content: string): string {
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    const stream = `BT /F1 10 Tf 72 750 Td (${escaped}) Tj ET`;
    const streamLength = Buffer.byteLength(stream, 'utf8');

    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${streamLength} >> stream
${stream}
endstream endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000243 00000 n 
0000000313 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
${313 + streamLength + 24}
%%EOF`;

    return Buffer.from(pdf, 'utf8').toString('base64');
  }
}
