import { AuthService } from './auth.service.js';
import { type AuthUser } from './decorators/current-user.decorator.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
import { PasswordResetDto } from './dto/password-reset.dto.js';
import { MfaVerifyDto } from './dto/mfa-setup.dto.js';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        userId: string;
        email: string;
    }>;
    login(dto: LoginDto, ip: string): Promise<import("./auth.service.js").TokenPair & {
        mfaRequired?: boolean;
    }>;
    refresh(dto: RefreshDto): Promise<import("./auth.service.js").TokenPair>;
    requestPasswordReset(dto: PasswordResetRequestDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: PasswordResetDto): Promise<{
        message: string;
    }>;
    setupMfa(user: AuthUser): Promise<import("./auth.service.js").MfaSetupResult>;
    verifyMfa(user: AuthUser, dto: MfaVerifyDto): Promise<{
        enabled: boolean;
    }>;
    disableMfa(user: AuthUser): Promise<{
        enabled: boolean;
    }>;
    me(user: AuthUser): {
        userId: string;
        email: string;
        roles: string[];
        permissions: string[];
    };
}
