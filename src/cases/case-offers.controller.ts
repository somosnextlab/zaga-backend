import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCaseOfferBodyDto } from '../offerEngine/dto/create-case-offer-body.dto';
import type { CreateCaseOfferResponse } from '../offerEngine/interfaces/offer-engine-response.interface';
import { OfferEngineService } from '../offerEngine/offer-engine.service';

@ApiTags('Offers')
@Controller('cases')
export class CaseOffersController {
  public constructor(private readonly offerEngineService: OfferEngineService) {}

  @Post(':caseId/create-offer')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOperation({
    summary: 'Crear oferta de préstamo para un caso (ZagaTasas)',
    description:
      'Ejecuta el motor ZagaTasas: calcula condiciones económicas, crea/versiona case_offers, actualiza el caso a OFFER_SENT. Requiere case en WAITING_CEO.',
  })
  @ApiResponse({
    status: 200,
    description: 'Oferta creada. Payload listo para n8n.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validación fallida o caso no está en WAITING_CEO',
  })
  @ApiResponse({
    status: 404,
    description: 'Caso no encontrado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno',
  })
  public async createCaseOffer(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body() body: CreateCaseOfferBodyDto,
  ): Promise<CreateCaseOfferResponse> {
    return this.offerEngineService.createCaseOffer({
      case_id: caseId,
      monto_pre_aprobado: body.monto_pre_aprobado,
      tasa_nominal_anual: body.tasa_nominal_anual,
      requires_guarantor: body.requires_guarantor,
      created_by: body.created_by,
      first_due_date: body.first_due_date,
    });
  }
}
