-- Add FOLLOWUP (Tindak Lanjut) capability. Must be its own migration: Postgres
-- cannot use a newly added enum value in the same transaction that adds it.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FOLLOWUP';
