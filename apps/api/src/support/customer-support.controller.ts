import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ReplyTicketDto } from './dto/reply-ticket.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

/**
 * Customer-facing support tickets. Any authenticated user (a customer) may
 * submit; the customer identity always comes from the JWT, never the body.
 */
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class CustomerSupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() customer: AuthUser) {
    return this.support.create(dto, customer);
  }

  /** The customer's own submitted tickets (read-only history). */
  @Get('mine')
  findMine(@CurrentUser() customer: AuthUser) {
    return this.support.findMine(customer);
  }

  /** The customer's own conversation — ownership enforced in the service. */
  @Get(':id/messages')
  conversation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() customer: AuthUser) {
    return this.support.findConversationForCustomer(id, customer);
  }

  /** Customer follow-up message on their own ticket (reopens CLOSED tickets). */
  @Post(':id/messages')
  addMessage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyTicketDto, @CurrentUser() customer: AuthUser) {
    return this.support.addCustomerMessage(id, dto, customer);
  }
}
