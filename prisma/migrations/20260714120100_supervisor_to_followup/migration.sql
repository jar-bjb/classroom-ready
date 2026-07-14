-- The role historically called SUPERVISOR was really the issue-resolver
-- ("Tindak Lanjut"). Move existing holders to FOLLOWUP, freeing SUPERVISOR to
-- mean the actual assigner going forward.
UPDATE "User" SET "roles" = array_replace("roles", 'SUPERVISOR'::"UserRole", 'FOLLOWUP'::"UserRole") WHERE 'SUPERVISOR' = ANY("roles");
UPDATE "User" SET "role" = 'FOLLOWUP' WHERE "role" = 'SUPERVISOR';
