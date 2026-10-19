import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { AdminNotificationQueryDto } from './dto/admin-notification-query.dto.js';

/** Payload for trusted server-side creation of an in-app notification. Never derived from client requests. */
export interface CreateInAppNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  bookingId?: string;
  dedupeKey: string;
}

/** Customer-facing view: no delivery errors, provider payloads, or template internals. */
export interface NotificationView {
  id: string;
  type: NotificationType | null;
  title: string;
  content: string;
  bookingId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Staff operations view: adds delivery-monitoring fields (status, attempts,
 * sanitized error, sentAt) and opaque correlation ids (userId/bookingId —
 * UUIDs only, never recipient names/emails, tokens, or provider payloads).
 */
export interface AdminNotificationView {
  id: string;
  type: NotificationType | null;
  channel: Notification['channel'];
  status: Notification['status'];
  title: string;
  content: string;
  userId: string | null;
  bookingId: string | null;
  readAt: Date | null;
  attempts: number;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // ---------- Internal creation (server-side callers only) ----------

  /**
   * Creates an IN_APP notification. In-app rows are delivered at insert time,
   * so they are stored as SENT with sentAt set; `status` keeps its delivery
   * meaning and is never used for read/unread state.
   *
   * Returns null when the dedupeKey already exists (P2002): a replayed event,
   * webhook redelivery, or reconciliation pass is then a no-op. Unexpected
   * database errors are rethrown — callers are expected to invoke this
   * fail-soft (post-commit, try/catch) so notification failures can never
   * affect the business transaction.
   */
  async createInApp(
    input: CreateInAppNotificationInput,
  ): Promise<NotificationView | null> {
    try {
      const created = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          bookingId: input.bookingId ?? null,
          type: input.type,
          channel: 'IN_APP',
          status: 'SENT',
          title: input.title,
          content: input.content,
          dedupeKey: input.dedupeKey,
          sentAt: new Date(),
        },
      });
      return this.toView(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /** Booking reached CONFIRMED (any path). Deduped per booking, in-app + email. */
  async notifyBookingConfirmed(input: {
    userId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<void> {
    await this.notifyUser({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      content: `Your booking ${input.bookingReference} is confirmed.`,
      dedupeBase: `booking-confirmed:booking:${input.bookingId}`,
    });
  }

  /** Payment reached SUCCESS (any path). Deduped per payment, in-app only. */
  async notifyPaymentSucceeded(input: {
    userId: string;
    paymentId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<NotificationView | null> {
    return this.createInApp({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'PAYMENT_SUCCEEDED',
      title: 'Payment successful',
      content: `Your payment for booking ${input.bookingReference} was successful.`,
      dedupeKey: `payment-succeeded:payment:${input.paymentId}`,
    });
  }

  /** Payment reached a persisted FAILED state (not a transient provider
   *  response). Deduped per payment, in-app + email. */
  async notifyPaymentFailed(input: {
    userId: string;
    paymentId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<void> {
    await this.notifyUser({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'PAYMENT_FAILED',
      title: 'Payment failed',
      content: `Your payment for booking ${input.bookingReference} could not be completed. Your booking is being held for now — please try again with a new payment attempt.`,
      dedupeBase: `payment-failed:payment:${input.paymentId}`,
    });
  }

  /** Staff approved the customer's cancellation request. Deduped per request. */
  async notifyCancellationApproved(input: {
    userId: string;
    requestId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<void> {
    await this.notifyUser({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'CANCELLATION_APPROVED',
      title: 'Cancellation approved',
      content: `Your cancellation request for booking ${input.bookingReference} was approved. Any refundable amount is returned to your original payment method.`,
      dedupeBase: `cancellation-approved:request:${input.requestId}`,
    });
  }

  /** Staff rejected the customer's cancellation request. The free-text staff
   *  reason is deliberately NOT included in notification content. Deduped per
   *  request. */
  async notifyCancellationRejected(input: {
    userId: string;
    requestId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<void> {
    await this.notifyUser({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'CANCELLATION_REJECTED',
      title: 'Cancellation request rejected',
      content: `Your cancellation request for booking ${input.bookingReference} was rejected. Your booking remains active.`,
      dedupeBase: `cancellation-rejected:request:${input.requestId}`,
    });
  }

  /** Refund reached PROCESSED (any path: initial, resume, sweep, orphan
   *  adoption). Never fired for ambiguous outcomes. Deduped per refund. */
  async notifyRefundProcessed(input: {
    userId: string;
    refundId: string;
    bookingId: string;
    bookingReference: string;
  }): Promise<void> {
    await this.notifyUser({
      userId: input.userId,
      bookingId: input.bookingId,
      type: 'REFUND_PROCESSED',
      title: 'Refund processed',
      content: `Your refund for booking ${input.bookingReference} was processed. It may take a few days to appear on your statement.`,
      dedupeBase: `refund-processed:refund:${input.refundId}`,
    });
  }

  /**
   * Staff alert: a provider refund outcome was AMBIGUOUS (timeout/5xx/lost
   * response) and requires operator review. Recipients are resolved
   * least-privilege at alert time: ACTIVE users holding a role that grants
   * `payments:refund`, plus Super Admins — never a broadcast to all staff.
   * Deduped per refund per recipient. Returns the number of recipients
   * actually notified (0 when no eligible staff exist).
   */
  async notifyStaffRefundReviewRequired(input: {
    refundId: string;
    bookingReference: string;
  }): Promise<number> {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              OR: [
                { isSuperAdmin: true },
                {
                  rolePermissions: {
                    some: {
                      permission: { resource: 'payments', action: 'refund' },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    let notified = 0;
    for (const recipient of recipients) {
      const created = await this.createInApp({
        userId: recipient.id,
        type: 'REFUND_REVIEW_REQUIRED',
        title: 'Refund requires review',
        content: `A refund for booking ${input.bookingReference} had an uncertain outcome at the payment provider and was left pending. Please review and resume it from the refund operations view.`,
        dedupeKey: `refund-review:refund:${input.refundId}:user:${recipient.id}`,
      });
      const email = await this.createEmail({
        userId: recipient.id,
        type: 'REFUND_REVIEW_REQUIRED',
        title: 'Refund requires review',
        content: `A refund for booking ${input.bookingReference} had an uncertain outcome at the payment provider and was left pending. Please review and resume it from the refund operations view.`,
        dedupeKey: `refund-review:refund:${input.refundId}:user:${recipient.id}:email`,
      });
      if (created || email) {
        notified += 1;
      }
    }
    return notified;
  }

  /**
   * Creates an EMAIL notification row in PENDING state. Delivery is performed
   * exclusively by NotificationDeliveryService's bounded sweep — never inline
   * with the business request and never inside a database transaction. Same
   * P2002-returns-null dedupe contract as createInApp.
   */
  async createEmail(input: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
    bookingId?: string;
    dedupeKey: string;
  }): Promise<NotificationView | null> {
    try {
      const created = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          bookingId: input.bookingId ?? null,
          type: input.type,
          channel: 'EMAIL',
          status: 'PENDING',
          title: input.title,
          content: input.content,
          dedupeKey: input.dedupeKey,
        },
      });
      return this.toView(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /** In-app inbox row + queued email row for one customer event. The email
   *  row carries the `:email` dedupe suffix so channels never collide. */
  private async notifyUser(input: {
    userId: string;
    bookingId: string;
    type: NotificationType;
    title: string;
    content: string;
    dedupeBase: string;
  }): Promise<void> {
    await this.createInApp({
      userId: input.userId,
      bookingId: input.bookingId,
      type: input.type,
      title: input.title,
      content: input.content,
      dedupeKey: input.dedupeBase,
    });
    await this.createEmail({
      userId: input.userId,
      bookingId: input.bookingId,
      type: input.type,
      title: input.title,
      content: input.content,
      dedupeKey: `${input.dedupeBase}:email`,
    });
  }

  // ---------- Customer self-service ----------

  async findMine(user: AuthUser, query: ListNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.userId,
      channel: 'IN_APP',
      ...(query.status === 'unread'
        ? { readAt: null }
        : query.status === 'read'
          ? { readAt: { not: null } }
          : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data: data.map((n) => this.toView(n)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: user.userId, channel: 'IN_APP', readAt: null },
    });
    return { count };
  }

  /**
   * Idempotent: an already-read notification is returned unchanged (readAt is
   * not bumped). A foreign or unknown id is a 404, never a 403 — resource
   * existence is not leaked, matching the project ownership convention.
   */
  async markMineRead(user: AuthUser, id: string): Promise<NotificationView> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId: user.userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt) {
      return this.toView(existing);
    }
    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });
    return this.toView(updated);
  }

  async markAllMineRead(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ---------- Staff operations (read-only) ----------

  /**
   * Paginated admin monitoring list over ALL recipients' notification rows.
   * Authorization is enforced by the controller (@Permissions
   * 'notifications:read'); this method deliberately returns only the opaque
   * admin view — no recipient names/emails, tokens, or provider internals.
   */
  async listAdmin(query: AdminNotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      // Exact FK match — no text/recipient inference.
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(query.read === 'unread'
        ? { readAt: null }
        : query.read === 'read'
          ? { readAt: { not: null } }
          : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data: data.map((n) => this.toAdminView(n)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private toAdminView(notification: Notification): AdminNotificationView {
    return {
      id: notification.id,
      type: notification.type,
      channel: notification.channel,
      status: notification.status,
      title: notification.title,
      content: notification.content,
      userId: notification.userId,
      bookingId: notification.bookingId,
      readAt: notification.readAt,
      attempts: notification.attempts,
      error: notification.error,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
    };
  }

  private toView(notification: Notification): NotificationView {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      bookingId: notification.bookingId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
