import { Injectable, Inject, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { OWNERSHIP_KEY, OwnershipRequirement } from './decorators/ownership.decorator.js';
import { AuthUser } from './decorators/current-user.decorator.js';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<OwnershipRequirement>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (
      user.permissions.includes('super_admin') ||
      (requirement.bypassPermission && user.permissions.includes(requirement.bypassPermission))
    ) {
      return true;
    }

    const resourceId = (request.params as Record<string, string>)[requirement.param];
    const ownerId = await this.resolveOwner(requirement.resource, resourceId);
    if (!ownerId || ownerId !== user.userId) {
      throw new NotFoundException('Resource not found');
    }
    return true;
  }

  private async resolveOwner(resource: string, id: string): Promise<string | null> {
    switch (resource) {
      case 'session': {
        const session = await this.prisma.session.findUnique({ where: { id }, select: { userId: true } });
        return session?.userId ?? null;
      }
      default:
        throw new Error(`Unknown ownership resource: ${resource}`);
    }
  }
}
