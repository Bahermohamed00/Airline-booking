import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Inject, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Post()
  @Roles('Super Admin')
  @Permissions({ resource: 'users', action: 'create' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Get()
  @Roles('Super Admin', 'Administrator', 'Support Staff')
  @Permissions({ resource: 'users', action: 'read' })
  findAll(@Query('email') email?: string) {
    return this.usersService.findAll({
      where: email ? { email: { contains: email, mode: 'insensitive' } } : undefined,
      include: { userRoles: { include: { role: true } } },
    });
  }

  @Get(':id')
  @Roles('Super Admin', 'Administrator', 'Support Staff')
  @Permissions({ resource: 'users', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Administrator')
  @Permissions({ resource: 'users', action: 'update' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Super Admin', 'Administrator')
  @Permissions({ resource: 'users', action: 'delete' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.usersService.remove(id, user);
  }
}
