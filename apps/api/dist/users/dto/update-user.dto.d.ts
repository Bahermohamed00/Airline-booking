import { UserStatus } from '@prisma/client';
export declare class UpdateUserDto {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    status?: UserStatus;
    roleIds?: string[];
}
