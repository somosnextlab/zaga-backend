import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveContractDataCodeudorDto } from './dto/save-contract-data-codeudor.dto';
import { SaveContractDataTitularDto } from './dto/save-contract-data-titular.dto';
import { ContractDataInitiateService } from './services/contract-data-initiate.service';
import { ContractDataSubmitService } from './services/contract-data-submit.service';
import type {
  InitiateDataCollectionResult,
  SaveContractDataInput,
  SubmitContractDataResult,
} from './interfaces/contract-data.interface';

@ApiTags('Contracts')
@Controller('cases')
export class ContractDataController {
  public constructor(
    private readonly initiateService: ContractDataInitiateService,
    private readonly submitService: ContractDataSubmitService,
  ) {}

  @Post(':caseId/initiate-data-collection')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary: 'Genera tokens de recolección de datos de contrato (idempotente)',
  })
  @ApiResponse({ status: 200, description: 'Tokens generados o vigentes' })
  @ApiResponse({ status: 404, description: 'Caso no encontrado' })
  public async initiateDataCollection(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
  ): Promise<InitiateDataCollectionResult> {
    return this.initiateService.initiateDataCollection(caseId);
  }

  @Put(':caseId/contract-data')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary: 'Guarda los datos de contrato del titular o del codeudor',
  })
  @ApiResponse({ status: 200, description: 'Datos guardados' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  public async saveContractData(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: SaveContractDataTitularDto | SaveContractDataCodeudorDto,
  ): Promise<SubmitContractDataResult> {
    const dto = await this.validateBody(body);
    const input = { caseId, ...dto } as SaveContractDataInput;
    return this.submitService.submitContractData(input);
  }

  private async validateBody(
    body: SaveContractDataTitularDto | SaveContractDataCodeudorDto,
  ): Promise<SaveContractDataTitularDto | SaveContractDataCodeudorDto> {
    const dto =
      body?.subject === 'CODEUDOR'
        ? plainToInstance(SaveContractDataCodeudorDto, body)
        : plainToInstance(SaveContractDataTitularDto, body);

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const messages = errors.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );
      throw new BadRequestException(messages);
    }

    return dto;
  }
}
