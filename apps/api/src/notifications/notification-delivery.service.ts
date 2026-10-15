import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAIL_ADAPTER, type MailAdapter } from '../mail/mail.adapter.js';

/**
 * Bounded email delivery for notification rows (Patch 3, hardened in Patch 4).
 *
 * - The ONLY sender: hooks queue EMAIL rows as PENDING; this sweep delivers
 *   them. Business requests never wait on SMTP and email is never sent from
 *   inside a database transaction.
 * - Status machine: PENDING → (attempt fails, attempts left) RETRYING with a
 *   nextRetryAt backoff → exhausted → FAILED (terminal, never re-selected).
 *   Success → SENT with sentAt. DELIVERED stays unused (the adapter offers
 *   no delivery receipts).
 * - Claiming (Patch 4): candidates are claimed in a SHORT transaction using
 *   SELECT ... FOR UPDATE SKIP LOCKED + the claim update, committed BEFORE
 *   any send. Concurrent workers/instances therefore can never claim the
 *   same row — the previous conditional-update claim let a second worker
 *   re-match a row already flipped to RETRYING. Sending always happens after
 *   the claim commits, never while the row lock is held.
 * - Crash safety: the claim already sets a provisional nextRetryAt (one base
 *   delay), so a process crash mid-send leaves the row backoff-gated instead
 *   of immediately re-eligible (no crash hot-loop). Failure finalization
 *   overwrites it with the exponential value; success clears it.
 * - Delivery guarantee (documented, Patch 4): the adapter/SMTP offers no
 *   idempotent submission, so the guarantee is AT-LEAST-ONCE with bounded
 *   duplicates — a crash or timeout after the provider accepted a message
 *   re-sends it on the next eligible sweep. A deterministic Message-ID per
 *   row (receiving-side dedupe) requires extending the B-owned MailMessage
 *   and is a recorded coordination proposal, not implemented here.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private sweepRunning = false;

  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs = 30 * 60 * 1000;
  private readonly batchSize = 20;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MAIL_ADAPTER) private readonly mail: MailAdapter,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    this.maxAttempts = Math.max(
      1,
      Number(this.config.get<string>('NOTIFICATION_EMAIL_MAX_ATTEMPTS', '5')),
    );
    this.baseDelayMs = Math.max(
      1000,
      Number(this.config.get<string>('NOTIFICATION_EMAIL_RETRY_BASE_MS', '60000')),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async deliverScheduledEmails(): Promise<void> {
    if (this.sweepRunning) {
      return;
    }
    this.sweepRunning = true;
    try {
      const { sent, failed, terminal } = await this.sweepPendingEmails();
      if (sent + failed + terminal > 0) {
        this.logger.log(
          `email sweep: sent=${sent} retryScheduled=${failed} terminal=${terminal}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `email sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.sweepRunning = false;
    }
  }

  /** One bounded batch. Safe to run concurrently across workers/instances:
   *  claiming is SKIP LOCKED-protected; each claimed row is sent exactly once
   *  per claim. */
  async sweepPendingEmails(): Promise<{
    sent: number;
    failed: number;
    terminal: number;
  }> {
    const claimedIds = await this.claimBatch();
    if (claimedIds.length === 0) {
      return { sent: 0, failed: 0, terminal: 0 };
    }
    const claimed = await this.prisma.notification.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { email: true } },
        booking: { select: { contactEmail: true } },
      },
    });

    let sent = 0;
    let failed = 0;
    let terminal = 0;
    for (const candidate of claimed) {
      // Each record is isolated: one failure must never abort the batch.
      try {
        const outcome = await this.deliverOne(candidate.id, candidate.attempts, {
          to: candidate.booking?.contactEmail ?? candidate.user?.email ?? null,
          subject: candidate.title,
          text: candidate.content,
        });
        if (outcome === 'sent') {
          sent += 1;
        } else if (outcome === 'terminal') {
          terminal += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `email delivery bookkeeping failed for notification ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { sent, failed, terminal };
  }

  /**
   * Claims up to batchSize eligible rows in one short transaction. SKIP
   * LOCKED makes concurrent workers skip rows already being claimed instead
   * of double-sending them. The claim increments attempts and sets a
   * provisional backoff; it commits before any network I/O.
   */
  private async claimBatch(): Promise<string[]> {
    const now = new Date();
    const provisionalNextRetry = new Date(now.getTime() + this.baseDelayMs);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "notifications"
        WHERE channel = 'EMAIL'::"notification_channel"
          AND status = ANY(ARRAY['PENDING','RETRYING']::"notification_status"[])
          AND attempts < ${this.maxAttempts}
          AND (next_retry_at IS NULL OR next_retry_at <= ${now})
        ORDER BY created_at ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) {
        return [];
      }
      const ids = rows.map((r) => r.id);
      await tx.notification.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'RETRYING',
          attempts: { increment: 1 },
          nextRetryAt: provisionalNextRetry,
        },
      });
      return ids;
    });
  }

  /**
   * Attempts one claimed record (attempts already incremented by the batch
   * claim). Returns 'sent' | 'retry' | 'terminal'.
   */
  private async deliverOne(
    id: string,
    attempt: number,
    message: { to: string | null; subject: string; text: string },
  ): Promise<'sent' | 'retry' | 'terminal'> {
    if (!message.to) {
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'FAILED',
          error: 'no recipient address resolvable',
          nextRetryAt: null,
        },
      });
      return 'terminal';
    }

    try {
      await this.mail.send({
        to: message.to,
        subject: message.subject || 'NovaAir notification',
        text: message.text,
      });
      await this.prisma.notification.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), error: null, nextRetryAt: null },
      });
      return 'sent';
    } catch (error) {
      // Ambiguous outcome: the provider may have accepted the message before
      // the failure (timeout/lost response). It is NEVER marked SENT or
      // definitively rejected here — it backs off and retries within the
      // attempt budget (at-least-once), then lands in terminal FAILED for
      // operator review. Store only a bounded, sanitized message — never
      // provider payloads, credentials, or stack traces.
      const safeError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      if (attempt >= this.maxAttempts) {
        await this.prisma.notification.update({
          where: { id },
          data: { status: 'FAILED', error: safeError, nextRetryAt: null },
        });
        this.logger.warn(
          `email notification ${id} terminally failed after ${attempt} attempts: ${safeError}`,
        );
        return 'terminal';
      }
      const delayMs = Math.min(
        this.baseDelayMs * 2 ** (attempt - 1),
        this.maxDelayMs,
      );
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'RETRYING',
          error: safeError,
          nextRetryAt: new Date(Date.now() + delayMs),
        },
      });
      return 'retry';
    }
  }
}
