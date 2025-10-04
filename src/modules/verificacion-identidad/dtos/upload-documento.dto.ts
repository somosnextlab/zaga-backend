import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsIn } from 'class-validator';

export class UploadDocumentoDto {
  @ApiProperty({
    description: 'Tipo de documento',
    example: 'dni',
    enum: ['dni', 'pasaporte', 'cedula', 'licencia_conducir'],
  })
  @IsString()
  @IsIn(['dni', 'pasaporte', 'cedula', 'licencia_conducir'])
  tipo_doc: string;

  @ApiProperty({
    description: 'Número de documento',
    example: '12345678',
  })
  @IsString()
  numero_doc: string;

  @ApiProperty({
    description: 'URL del archivo en Supabase Storage',
    example: 'https://supabase.co/storage/v1/object/public/documentos/dni-12345678.pdf',
  })
  @IsString()
  @IsUrl()
  archivo_url: string;

  @ApiProperty({
    description: 'Estado del documento',
    example: 'pendiente',
    enum: ['pendiente', 'aprobado', 'rechazado'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['pendiente', 'aprobado', 'rechazado'])
  estado?: string;
}
