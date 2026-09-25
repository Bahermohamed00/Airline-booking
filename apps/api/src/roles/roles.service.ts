import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
  userCount: number;
}

@Injectable()
export class RolesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAllWithPermissions(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSuperAdmin: role.isSuperAdmin,
      permissions: role.rolePermissions
        .map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
        .sort(),
      userCount: role._count.userRoles,
    }));
  }
}
