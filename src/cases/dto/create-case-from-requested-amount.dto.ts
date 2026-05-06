import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ALLOWED_REQUESTED_AMOUNTS } from '../case-requested-amount';
import { normalizeCaseCreationPhone } from '../phone-normalize';

const REQUESTED_AMOUNT_CHOICES = [...ALLOWED_REQUESTED_AMOUNTS] as number[];

export class CreateCaseFromRequestedAmountDto {
  @ApiProperty({
    example: '+5493516639755',
    description: 'Teléfono E.164; se tolera prefijo whatsapp:',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeCaseCreationPhone(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  public phone!: string;

  @ApiProperty({
    enum: REQUESTED_AMOUNT_CHOICES,
    example: 300000,
  })
  @Type(() => Number)
  @IsInt()
  @IsIn(REQUESTED_AMOUNT_CHOICES)
  public requested_amount!: number;
}
