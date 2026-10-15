-- Email-OTP MFA migration (intentional security-method change; approved):
-- * TOTP is removed entirely. Dropping mfa_secret / mfa_backup_codes destroys
--   the stored TOTP secrets — that is deliberate and irreversible.
-- * Accounts with mfa_enabled = true keep it: at their next login they must
--   complete an email-OTP challenge, which doubles as their email-MFA
--   enrollment confirmation. They cannot bypass MFA — the challenge is
--   mandatory — and no TOTP state is silently treated as email MFA, because
--   no valid code exists until the user reads it from their own mailbox.
-- * Accounts that started but never completed TOTP setup (mfa_enabled = false)
--   simply re-enroll via the email-code flow.

-- CreateEnum
CREATE TYPE "mfa_email_purpose" AS ENUM ('LOGIN', 'ENABLE', 'DISABLE');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfa_backup_codes",
DROP COLUMN "mfa_secret";

-- CreateTable
CREATE TABLE "mfa_email_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "mfa_email_purpose" NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_email_tokens_user_id_purpose_used_at_idx" ON "mfa_email_tokens"("user_id", "purpose", "used_at");

-- AddForeignKey
ALTER TABLE "mfa_email_tokens" ADD CONSTRAINT "mfa_email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
