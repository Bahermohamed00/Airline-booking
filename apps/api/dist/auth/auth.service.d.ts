import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PasswordResetDto } from './dto/password-reset.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface MfaSetupResult {
    secret: string;
    qrCodeUrl: string;
}
export declare class AuthService {
    private readonly prisma;
    private readonly passwordService;
    private readonly jwtService;
    private readonly configService;
    private readonly auditService;
    constructor(prisma: PrismaService, passwordService: PasswordService, jwtService: JwtService, configService: ConfigService, auditService: AuditService);
    register(dto: RegisterDto): Promise<{
        userId: string;
        email: string;
    }>;
    login(dto: LoginDto, ipAddress?: string): Promise<TokenPair & {
        mfaRequired?: boolean;
    }>;
    refresh(refreshToken: string): Promise<TokenPair>;
    requestPasswordReset(dto: PasswordResetRequestDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: PasswordResetDto): Promise<{
        message: string;
    }>;
    setupMfa(userId: string): Promise<MfaSetupResult>;
    verifyMfaAndEnable(userId: string, code: string): Promise<{
        enabled: boolean;
    }>;
    disableMfa(userId: string): Promise<{
        enabled: boolean;
    }>;
    private generateTokens;
}
