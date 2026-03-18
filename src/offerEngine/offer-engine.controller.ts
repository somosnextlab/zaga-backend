import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCaseOfferDto } from './dto/create-case-offer.dto';
import type { CreateCaseOfferResponse } from './interfaces/offer-engine-response.interface';
import { OfferEngineService } from './offer-engine.service';

@ApiTags('OfferEngine')
@Controller('offer-engine')
export class OfferEngineController {
  public constructor(private readonly offerEngineService: OfferEngineService) {}

  @Post('case-offer')
  @HttpCode(HttpStatus.OK)
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
    description:
      'Validación fallida o caso no está en WAITING_CEO',
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
    @Body() body: CreateCaseOfferDto,
  ): Promise<CreateCaseOfferResponse> {
    return this.offerEngineService.createCaseOffer({
      case_id: body.case_id,
      monto_pre_aprobado: body.monto_pre_aprobado,
      tasa_nominal_anual: body.tasa_nominal_anual,
      requires_guarantor: body.requires_guarantor,
      created_by: body.created_by,
      first_due_date: body.first_due_date,
    });
  }
}
