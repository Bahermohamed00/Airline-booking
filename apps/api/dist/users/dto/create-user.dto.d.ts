import { UserStatus } from '@prisma/client';
export declare class CreateUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    status?: UserStatus;
    roleIds?: string[];
}
