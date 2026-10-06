-- Phase 1 (NovaAir foundation): normalize persisted seed/reference identifiers
-- from the old Lufthansa-style scheme to the fictional NovaAir scheme.
-- Every statement is idempotent (no-op when the old identifier is absent).

UPDATE "aircraft" SET "registration" = 'NV-320A' WHERE "registration" = 'D-AIRA';
UPDATE "aircraft" SET "registration" = 'NV-321B' WHERE "registration" = 'D-AIRB';
UPDATE "aircraft" SET "registration" = 'NV-748X' WHERE "registration" = 'D-ABYA';
UPDATE "aircraft" SET "registration" = 'NV-359Y' WHERE "registration" = 'D-AIXA';

UPDATE "flights"
SET "flight_number" = 'NV' || substring("flight_number" FROM 3)
WHERE "flight_number" LIKE 'LH%';

UPDATE "loyalty_accounts"
SET "member_number" = 'NV' || substring("member_number" FROM 3)
WHERE "member_number" LIKE 'LH%';
