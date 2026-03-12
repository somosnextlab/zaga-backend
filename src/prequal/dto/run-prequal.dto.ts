import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RunPrequalDto {
  @ApiProperty({
    description: 'UUID del usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  public userId!: string;

  @ApiProperty({
    description: 'Teléfono del usuario',
    example: '+5491112345678',
  })
  @IsString()
  @IsNotEmpty()
  public phone!: string;

  @ApiProperty({
    description: 'CUIT del usuario',
    example: '20-12345678-9',
  })
  @IsString()
  @IsNotEmpty()
  public cuit!: string;
}
