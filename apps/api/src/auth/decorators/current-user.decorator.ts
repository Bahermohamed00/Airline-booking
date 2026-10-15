import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  phone: string | null;
  streetAddress: string | null;
  nationalId: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthUser;
  },
);
