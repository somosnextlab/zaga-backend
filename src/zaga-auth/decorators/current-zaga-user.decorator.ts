import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ZagaRequestUser } from '../types/zaga-request.types';

export const CurrentZagaUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ZagaRequestUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { zagaUser?: ZagaRequestUser }>();
    const user = req.zagaUser;
    if (!user) {
      throw new Error('CurrentZagaUser usado sin ZagaSessionGuard');
    }
    return user;
  },
);
