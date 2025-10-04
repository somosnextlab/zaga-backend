import { PartialType } from '@nestjs/swagger';
import { CreateGaranteDto } from './create-garante.dto';

export class UpdateGaranteDto extends PartialType(CreateGaranteDto) {}
