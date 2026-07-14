import { readSession } from "@/lib/auth";
import { hasRole } from "@/lib/access";

// Viewer/actor context for the issue workflow under the dual-mode transition:
// - legacy basic-auth requests carry no session → full access, anonymous actor
//   (pre-auth behavior, unchanged while accounts are still being onboarded)
// - SUPERVISOR / ADMIN sessions oversee every issue, manage assignment, and may
//   act on behalf of a chosen officer (dropdown)
// - FOLLOWUP-only sessions act as themselves and only see/work issues assigned
//   to them or still unassigned (shared pool)
export type IssueViewer = {
  userId: string | null; // session user id (null under legacy basic-auth)
  canAssign: boolean;
  restrictedToUserId: string | null; // non-null → FOLLOWUP-only viewer
};

export async function getIssueViewer(): Promise<IssueViewer> {
  const session = await readSession();
  if (!session) return { userId: null, canAssign: true, restrictedToUserId: null };

  const privileged = hasRole(session.roles, "SUPERVISOR") || hasRole(session.roles, "ADMIN");
  return {
    userId: session.sub,
    canAssign: privileged,
    restrictedToUserId: privileged ? null : session.sub,
  };
}
