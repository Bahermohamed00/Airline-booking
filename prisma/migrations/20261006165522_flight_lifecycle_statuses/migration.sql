-- Extend flight_status with the lifecycle states for Flight Status Management.
-- Existing values (SCHEDULED, ACTIVE, DELAYED, CANCELLED, COMPLETED) are kept
-- unchanged; ACTIVE/DELAYED remain for backward compatibility with existing rows.
ALTER TYPE "flight_status" ADD VALUE IF NOT EXISTS 'BOARDING';
ALTER TYPE "flight_status" ADD VALUE IF NOT EXISTS 'DEPARTED';
ALTER TYPE "flight_status" ADD VALUE IF NOT EXISTS 'ARRIVED';
