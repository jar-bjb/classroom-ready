-- Tahap 2 (penugasan per-issue): a Supervisor assigns an issue to a specific
-- Tindak Lanjut officer. NULL = unassigned → still visible to every officer
-- (shared pool), so work continues while no SUPERVISOR account exists yet.

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "assignedToId" TEXT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Issue_assignedToId_status_idx" ON "Issue"("assignedToId", "status");
