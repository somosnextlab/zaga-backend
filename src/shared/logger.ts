import { Logger as NestLogger, LoggerService } from '@nestjs/common';

export class Logger extends NestLogger implements LoggerService {
  constructor(context?: string) {
    super(context);
  }

  log(message: string | object, context?: string) {
    if (context === undefined) {
      super.log(message);
    } else {
      super.log(message, context);
    }
  }

  error(message: string | object, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  warn(message: string | object, context?: string) {
    super.warn(message, context);
  }

  debug(message: string | object, context?: string) {
    super.debug(message, context);
  }

  verbose(message: string | object, context?: string) {
    super.verbose(message, context);
  }
}
