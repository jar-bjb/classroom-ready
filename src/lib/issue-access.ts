import { readSession } from "@/lib/auth";
import { hasRole } from "@/lib/access";

// Viewer/actor context for the issue workflow under the dual-mode transition.
// Separation of duties (per operator spec): Supervisor assigns + monitors but
// does NOT resolve; the Tindak Lanjut (FOLLOWUP) officer resolves.
// - legacy basic-auth requests carry no session → full access (assign + work),
//   anonymous actor picked from a dropdown (kiosk, unchanged during onboarding)
// - SUPERVISOR / ADMIN sessions: canAssign, monitor everything, but canWork only
//   if they also hold FOLLOWUP
// - FOLLOWUP officers: canWork, act as themselves, and (unless also privileged)
//   only see/work issues assigned to them or still unassigned (shared pool)
export type IssueViewer = {
  userId: string | null; // session user id (null under legacy basic-auth)
  canAssign: boolean; // may (re)assign issues to officers — Supervisor/Admin
  canWork: boolean; // may mark-in-progress / resolve — Tindak Lanjut officer
  restrictedToUserId: string | null; // non-null → sees only own + pool issues
};

export async function getIssueViewer(): Promise<IssueViewer> {
  const session = await readSession();
  if (!session) return { userId: null, canAssign: true, canWork: true, restrictedToUserId: null };

  const privileged = hasRole(session.roles, "SUPERVISOR") || hasRole(session.roles, "ADMIN");
  return {
    userId: session.sub,
    canAssign: privileged,
    canWork: hasRole(session.roles, "FOLLOWUP"),
    restrictedToUserId: privileged ? null : session.sub,
  };
}
