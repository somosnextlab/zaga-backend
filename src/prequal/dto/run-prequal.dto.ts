import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RunPrequalDto {
  @IsUUID()
  public userId!: string;

  @IsString()
  @IsNotEmpty()
  public phone!: string;

  @IsString()
  @IsNotEmpty()
  public cuit!: string;
}
