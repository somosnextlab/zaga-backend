import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractQueryDto } from './dto/contract-query.dto';
import { StartCaseContractDto } from './dto/start-case-contract.dto';
import { ContractsService } from './contracts.service';
import type {
  CaseContractStatusResponse,
  SignaturaWebhookResult,
  StartCaseContractResponse,
} from './interfaces/contracts.interface';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('CaseContracts')
@Controller('case-contracts')
export class ContractsController {
  public constructor(private readonly contractsService: ContractsService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia formalización contractual de un CASE aprobado final',
  })
  @ApiResponse({ status: 200, description: 'Contrato iniciado correctamente' })
  @ApiResponse({ status: 400, description: 'Caso no apto para formalización' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe contrato activo' })
  public async startCaseContract(
    @Body() body: StartCaseContractDto,
  ): Promise<StartCaseContractResponse> {
    return this.contractsService.startCaseContract(body.caseId);
  }

  @Get(':caseId')
  @ApiOperation({
    summary: 'Obtiene estado contractual por case_id',
    description:
      'Si hay contrato activo (CREATED o SIGN_PENDING), devuelve ese; si no, el más reciente por created_at (cualquier estado). Interpretar el campo status en la respuesta.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado contractual encontrado',
  })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado' })
  public async getCaseContractStatus(
    @Param() params: ContractQueryDto,
  ): Promise<CaseContractStatusResponse> {
    return this.contractsService.getCaseContractStatus(params.caseId);
  }

  @Post('webhooks/signatura')
  @HttpCode(HttpStatus.OK)
  public async receiveSignaturaWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() req: RequestWithRawBody,
  ): Promise<SignaturaWebhookResult> {
    const rawBody = this.extractRawBody(req, body);
    const signatureHeader = this.readSignatureHeader(headers);

    return this.contractsService.handleSignaturaWebhook(
      signatureHeader,
      rawBody,
      body,
    );
  }

  /**
   * Signatura envía `x-signature-sha256` (hex del HMAC-SHA256 del cuerpo crudo).
   * Se mantiene fallback a `x-signatura-signature` por compatibilidad.
   */
  private readSignatureHeader(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const keys = ['x-signature-sha256', 'x-signatura-signature'] as const;
    for (const key of keys) {
      const raw = headers[key];
      if (raw === undefined) continue;
      const value = Array.isArray(raw) ? raw[0] : raw;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (trimmed.length > 0) return trimmed;
    }
    return undefined;
  }

  private extractRawBody(req: RequestWithRawBody, body: unknown): Buffer {
    const incomingRawBody = req.rawBody;
    if (Buffer.isBuffer(incomingRawBody)) return incomingRawBody;
    return Buffer.from(JSON.stringify(body), 'utf8');
  }
}
