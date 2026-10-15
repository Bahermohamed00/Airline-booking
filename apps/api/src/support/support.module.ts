import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { SupportService } from './support.service.js';
import { CustomerSupportController } from './customer-support.controller.js';
import { AdminSupportController } from './admin-support.controller.js';

@Module({
  imports: [MailModule],
  controllers: [CustomerSupportController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
