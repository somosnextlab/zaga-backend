import { Logger as NestLogger, LoggerService } from '@nestjs/common';

export class Logger extends NestLogger implements LoggerService {
  constructor(context?: string) {
    super(context);
  }

  log(message: any, context?: string) {
    if (context === undefined) {
      super.log(message);
    } else {
      super.log(message, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
  }
}
