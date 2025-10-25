import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UsuarioRol {
  ADMIN = 'admin',
  USUARIO = 'usuario',
  CLIENTE = 'cliente',
}

export enum UsuarioEstado {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

export class QueryUsuariosDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por rol del usuario',
    enum: UsuarioRol,
    example: UsuarioRol.ADMIN,
  })
  @IsOptional()
  @IsEnum(UsuarioRol)
  rol?: UsuarioRol;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del usuario',
    enum: UsuarioEstado,
    example: UsuarioEstado.ACTIVO,
  })
  @IsOptional()
  @IsEnum(UsuarioEstado)
  estado?: UsuarioEstado;
}
