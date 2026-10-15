import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service.js';
import { AdminTicketQueryDto } from './dto/admin-ticket-query.dto.js';
import { ReplyTicketDto } from './dto/reply-ticket.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

/**
 * Support Staff dashboard API. Reads require support:read; lifecycle actions
 * (claim/resolve/close/reopen) require support:manage. No arbitrary status
 * mutation — only the explicit transition endpoints exist.
 */
@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminSupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  /** Support-specific overview counts (tickets + unread only). */
  @Get('overview')
  @Permissions({ resource: 'support', action: 'read' })
  overview() {
    return this.support.overview();
  }

  @Get('tickets')
  @Permissions({ resource: 'support', action: 'read' })
  findAll(@Query() query: AdminTicketQueryDto) {
    return this.support.findAll(query);
  }

  @Get('tickets/:id')
  @Permissions({ resource: 'support', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.findOne(id);
  }

  @Get('tickets/:id/messages')
  @Permissions({ resource: 'support', action: 'read' })
  conversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.getConversation(id);
  }

  /** Marks all customer messages on the ticket as read by staff. */
  @Post('tickets/:id/read')
  @Permissions({ resource: 'support', action: 'manage' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.support.markRead(id);
  }

  /** Agent reply: stored message + email through the existing mail adapter. */
  @Post('tickets/:id/replies')
  @Permissions({ resource: 'support', action: 'manage' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyTicketDto, @CurrentUser() agent: AuthUser) {
    return this.support.reply(id, dto, agent);
  }

  @Post('tickets/:id/claim')
  @Permissions({ resource: 'support', action: 'manage' })
  claim(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() agent: AuthUser) {
    return this.support.transition(id, 'claim', agent);
  }

  @Post('tickets/:id/resolve')
  @Permissions({ resource: 'support', action: 'manage' })
  resolve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() agent: AuthUser) {
    return this.support.transition(id, 'resolve', agent);
  }

  @Post('tickets/:id/close')
  @Permissions({ resource: 'support', action: 'manage' })
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() agent: AuthUser) {
    return this.support.transition(id, 'close', agent);
  }

  @Post('tickets/:id/reopen')
  @Permissions({ resource: 'support', action: 'manage' })
  reopen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() agent: AuthUser) {
    return this.support.transition(id, 'reopen', agent);
  }
}
