import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SAFE_USER_OMIT, type SafeUser } from './safe-user.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor?: AuthUser): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (dto.roleIds?.length) {
      await this.assertRoleAssignmentAllowed(dto.roleIds, actor);
    }

    const hashedPassword = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      omit: SAFE_USER_OMIT,
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: dto.status ?? 'ACTIVE',
        userRoles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
      },
      include: { userRoles: { include: { role: true } } },
    });

    await this.auditService.log({
      actorId: actor?.userId ?? user.id,
      actorType: actor ? 'Staff' : 'User',
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: user.id,
    });

    return user;
  }

  async findAll(args?: Prisma.UserFindManyArgs): Promise<SafeUser[]> {
    return this.prisma.user.findMany({ ...args, omit: SAFE_USER_OMIT });
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: SAFE_USER_OMIT,
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor?: AuthUser): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== existing.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (taken) {
        throw new ConflictException('Email already registered');
      }
    }

    const actorIsSuper = actor?.permissions.includes('super_admin') ?? false;
    const changesRoles = dto.roleIds !== undefined;
    const deactivates = dto.status !== undefined && dto.status !== 'ACTIVE';

    if (changesRoles) {
      await this.assertRoleAssignmentAllowed(dto.roleIds!, actor);
    }

    let targetIsSuperAdmin = false;
    if (changesRoles || deactivates) {
      targetIsSuperAdmin = await this.isSuperAdminUser(id);
      if (targetIsSuperAdmin && !actorIsSuper) {
        throw new ForbiddenException("Only a Super Admin can modify a Super Admin's roles or status");
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (targetIsSuperAdmin) {
        const saRole = await tx.role.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
        const removesSuperRole = changesRoles && saRole !== null && !dto.roleIds!.includes(saRole.id);
        if (saRole && (removesSuperRole || deactivates)) {
          await this.assertNotLastSuperAdmin(tx, saRole.id, id, actor, removesSuperRole ? 'role_removal' : 'deactivation');
        }
      }

      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }

      return tx.user.update({
        where: { id },
        omit: SAFE_USER_OMIT,
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          status: dto.status,
        },
        include: { userRoles: { include: { role: true } } },
      });
    });

    await this.auditService.log({
      actorId: actor?.userId ?? id,
      actorType: actor ? 'Staff' : 'User',
      action: 'USER_UPDATED',
      targetType: 'User',
      targetId: id,
      metadata: { changedFields: Object.keys(dto), ...(dto.roleIds ? { roleIds: dto.roleIds } : {}) },
    });

    return user;
  }

  /** True when the user currently holds the Super Admin role. */
  private async isSuperAdminUser(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { isSuperAdmin: true } },
    });
    return count > 0;
  }

  /** Validates role ids and blocks non-super-admins from assigning the Super Admin role. */
  private async assertRoleAssignmentAllowed(roleIds: string[], actor?: AuthUser): Promise<void> {    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, isSuperAdmin: true },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException('Unknown role id');
    }
    const assignsSuperAdmin = roles.some((r) => r.isSuperAdmin);
    if (assignsSuperAdmin && !(actor?.permissions.includes('super_admin') ?? false)) {
      throw new ForbiddenException('Only a Super Admin can assign the Super Admin role');
    }
  }

  /**
   * Last-Super-Admin invariant: the operation must not leave zero active Super
   * Admins. Runs inside the caller's transaction; the row locks in
   * lockActiveSuperAdmins serialize concurrent removals.
   */
  private async assertNotLastSuperAdmin(
    tx: Prisma.TransactionClient,
    superAdminRoleId: string,
    targetUserId: string,
    actor: AuthUser | undefined,
    operation: 'role_removal' | 'deactivation',
  ): Promise<void> {
    const activeAdmins = await this.lockActiveSuperAdmins(tx, superAdminRoleId);
    if (activeAdmins <= 1) {
      await this.auditService.log({
        actorId: actor?.userId,
        actorType: actor ? 'Staff' : 'User',
        action: 'SUPER_ADMIN_INVARIANT_BLOCKED',
        targetType: 'User',
        targetId: targetUserId,
        metadata: { operation },
      });
      throw new ConflictException('At least one active Super Admin must remain');
    }
  }

  /**
   * Locks the active Super Admin user_roles rows (PostgreSQL FOR UPDATE) and
   * returns their count. Concurrent removers serialize on the lock; after the
   * lock wait, READ COMMITTED re-reads the committed state, so the second
   * remover re-counts and is correctly rejected.
   */
  private async lockActiveSuperAdmins(tx: Prisma.TransactionClient, superAdminRoleId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT ur.id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = ${superAdminRoleId}::uuid AND u.status = 'ACTIVE' FOR UPDATE`,
    );
    return rows.length;
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // A non-super-admin may not deactivate a Super Admin account.
    const targetIsSuperAdmin = await this.isSuperAdminUser(id);
    if (targetIsSuperAdmin && !actor.permissions.includes('super_admin')) {
      throw new ForbiddenException('Only a Super Admin can deactivate a Super Admin');
    }

    await this.prisma.$transaction(async (tx) => {
      if (targetIsSuperAdmin) {
        const saRole = await tx.role.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
        if (saRole) {
          await this.assertNotLastSuperAdmin(tx, saRole.id, id, actor, 'deactivation');
        }
      }
      await tx.user.update({
        where: { id },
        data: { status: 'DEACTIVATED' },
      });
    });

    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: id,
    });
  }
}
