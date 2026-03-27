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
    const pseudoPdfContent = [
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

    const pdfBase64 = Buffer.from(pseudoPdfContent, 'utf8').toString('base64');

    return {
      fileName,
      pdfBase64,
      contractVersion,
      templateCode,
    };
  }
}
