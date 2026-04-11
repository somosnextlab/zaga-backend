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
//import { SignaturaWebhookDto } from './dto/signatura-webhook.dto';
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
    @Body() body: any,
    @Req() req: RequestWithRawBody,
  ): Promise<SignaturaWebhookResult> {
    const rawBody = this.extractRawBody(req, body);

    console.log('=== SIGNATURA WEBHOOK HEADERS ===');
    console.log(headers);

    console.log('=== SIGNATURA WEBHOOK BODY ===');
    console.log(JSON.stringify(body, null, 2));

    console.log('=== SIGNATURA WEBHOOK RAW BODY LENGTH ===');
    console.log(rawBody.length);

    const signatureHeader =
      (headers['x-signatura-signature'] as string | undefined) ??
      (headers['X-Signatura-Signature'] as string | undefined);

    console.log('=== SIGNATURA WEBHOOK SIGNATURE HEADER ===');
    console.log(signatureHeader);

    return this.contractsService.handleSignaturaWebhook(
      signatureHeader,
      rawBody,
      body,
    );
  }

  private extractRawBody(req: RequestWithRawBody, body: unknown): Buffer {
    const incomingRawBody = req.rawBody;
    if (Buffer.isBuffer(incomingRawBody)) return incomingRawBody;
    return Buffer.from(JSON.stringify(body), 'utf8');
  }
}
