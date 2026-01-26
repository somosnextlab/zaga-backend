import { IsUUID } from 'class-validator';

export class AcceptConsentDto {
  @IsUUID()
  public token!: string;
}
