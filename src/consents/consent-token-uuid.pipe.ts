import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common';

/** Misma regla que `ParseUUIDPipe` con versión `all` (Nest). */
const UUID_ALL =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

@Injectable()
export class ConsentTokenUuidPipe implements PipeTransform<string, string> {
  private readonly logger = new Logger(ConsentTokenUuidPipe.name);

  public transform(value: string, metadata: ArgumentMetadata): string {
    if (typeof value !== 'string' || !UUID_ALL.test(value)) {
      this.logger.warn(
        JSON.stringify({
          event: 'consent_token_invalid_format',
          parameter: metadata.data,
        }),
      );
      throw new BadRequestException('Token inválido o vencido.');
    }
    return value;
  }
}
