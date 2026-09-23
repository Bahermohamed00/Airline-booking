import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Prisma, User } from '@prisma/client';
export declare class UsersService {
    private readonly prisma;
    private readonly passwordService;
    private readonly auditService;
    constructor(prisma: PrismaService, passwordService: PasswordService, auditService: AuditService);
    create(dto: CreateUserDto, actorId?: string): Promise<User>;
    findAll(args?: Prisma.UserFindManyArgs): Promise<User[]>;
    findOne(id: string): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    update(id: string, dto: UpdateUserDto, actorId?: string): Promise<User>;
    remove(id: string, actorId: string): Promise<void>;
}
