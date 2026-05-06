import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import type {
  CaseContractStatusResponse,
  StartCaseContractResponse,
} from './interfaces/contracts.interface';

@ApiTags('Contracts')
@Controller('cases')
export class ContractsCasesController {
  public constructor(private readonly contractsService: ContractsService) {}

  @Post(':caseId/start-contract')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary: 'Inicia formalización contractual de un CASE aprobado final',
  })
  @ApiResponse({ status: 200, description: 'Contrato iniciado correctamente' })
  @ApiResponse({ status: 400, description: 'Caso no apto para formalización' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe contrato activo' })
  public async startCaseContract(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ): Promise<StartCaseContractResponse> {
    return this.contractsService.startCaseContract(caseId);
  }

  @Get(':caseId/get-current-contract')
  @ApiParam({ name: 'caseId', format: 'uuid' })
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
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ): Promise<CaseContractStatusResponse> {
    return this.contractsService.getCaseContractStatus(caseId);
  }
}
