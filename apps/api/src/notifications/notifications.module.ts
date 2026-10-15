import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NotificationsController } from './notifications.controller.js';
import { AdminNotificationsController } from './admin-notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';

/**
 * Notifications: persisted in-app inbox + queued transactional email (Patch 3).
 * NotificationsService is exported so domain modules (payments today;
 * bookings/refunds later) can create notifications post-commit, fail-soft,
 * with dedupe keys. Email delivery runs exclusively through
 * NotificationDeliveryService's bounded sweep via the MailModule's exported
 * MAIL_ADAPTER — MailService is untouched. There is deliberately no
 * client-accessible creation endpoint.
 */
@Module({
  imports: [MailModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
