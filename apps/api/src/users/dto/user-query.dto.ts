import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const USERS_MAX_LIMIT = 100;

export class UserQueryDto {
  /** Partial, case-insensitive email match. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  /**
   * Opt-in pagination. No defaults here: when BOTH are absent the endpoint
   * keeps returning the legacy bare array. Defaults (page=1, limit=20) are
   * applied in UsersService.findAll once pagination is requested.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USERS_MAX_LIMIT)
  limit?: number;
}
