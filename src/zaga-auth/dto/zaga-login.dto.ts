import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ZagaLoginDto {
  @ApiProperty({ example: 'admin@zaga.com.ar' })
  @IsEmail()
  public email!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1, { message: 'password es requerido' })
  public password!: string;
}
