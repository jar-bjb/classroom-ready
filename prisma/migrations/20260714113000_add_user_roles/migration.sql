-- AlterTable: capability set so one person can hold multiple roles
ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[];

-- Backfill: the existing single role becomes the initial capability
UPDATE "User" SET "roles" = ARRAY["role"]::"UserRole"[];
