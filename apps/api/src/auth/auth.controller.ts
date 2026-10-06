import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AUTH_THROTTLE } from './auth.throttles.js';
import { Public } from './decorators/public.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from './decorators/current-user.decorator.js';
import { JwtAuthGuard } from './auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
import { PasswordResetDto } from './dto/password-reset.dto.js';
import { EmailVerificationDto } from './dto/email-verification.dto.js';
import { EmailVerificationRequestDto } from './dto/email-verification-request.dto.js';
import { MfaVerifyDto } from './dto/mfa-setup.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CheckOwnership } from './decorators/ownership.decorator.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  private setRefreshCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      expires: expiresAt,
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.login })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, ip, userAgent);
    if (result.mfaRequired) {
      return { mfaRequired: true };
    }
    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = (
      req.cookies as Record<string, string | undefined> | undefined
    )?.[REFRESH_COOKIE_NAME];
    if (!presented) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const result = await this.authService.refresh(presented);
    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.emailVerificationRequest })
  @Post('email-verification-request')
  @HttpCode(HttpStatus.OK)
  async requestEmailVerification(
    @Body() dto: EmailVerificationRequestDto,
    @Ip() ip: string,
  ) {
    return this.authService.requestEmailVerification(dto, ip);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.emailVerification })
  @Post('email-verification')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: EmailVerificationDto, @Ip() ip: string) {
    return this.authService.verifyEmail(dto, ip);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passwordResetRequest })
  @Post('password-reset-request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
    @Ip() ip: string,
  ) {
    return this.authService.requestPasswordReset(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.userId, user.sessionId);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.userId);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return { message: 'Logged out of all sessions' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.userId, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @CheckOwnership({ resource: 'session', param: 'id' })
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.authService.revokeSession(id);
    return { message: 'Session revoked' };
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passwordReset })
  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: PasswordResetDto, @Ip() ip: string) {
    return this.authService.resetPassword(dto, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser() user: AuthUser) {
    return this.authService.setupMfa(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfaAndEnable(user.userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  async disableMfa(@CurrentUser() user: AuthUser) {
    return this.authService.disableMfa(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: AUTH_THROTTLE.changePassword })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ) {
    return this.authService.changePassword(
      user.userId,
      user.sessionId,
      dto,
      ip,
    );
  }
}
