import type { ItemCategory, RoomCertificationStatus, InspectionResult, IssuePriority, UserRole } from "@/generated/prisma/client";

export function getEffectiveRoomStatus(status: RoomCertificationStatus, expiresAt?: Date | null) {
  if (expiresAt && expiresAt.getTime() < Date.now() && status !== "NOT_CERTIFIED") return "EXPIRED";
  return status;
}

export function roomStatusLabel(status: string) {
  const labels: Record<string, string> = {
    UNCHECKED: "Belum diperiksa",
    CERTIFIED: "Siap digunakan",
    CERTIFIED_WITH_NOTES: "Perlu tindakan",
    NOT_CERTIFIED: "Perlu tindakan",
    EXPIRED: "Belum diperiksa",
  };
  return labels[status] ?? status;
}

export function roomStatusClass(status: string) {
  const classes: Record<string, string> = {
    CERTIFIED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CERTIFIED_WITH_NOTES: "border-amber-200 bg-amber-50 text-amber-800",
    NOT_CERTIFIED: "border-amber-200 bg-amber-50 text-amber-800",
    EXPIRED: "border-zinc-200 bg-zinc-100 text-zinc-700",
    UNCHECKED: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return classes[status] ?? classes.UNCHECKED;
}

export function inspectionResultLabel(result: InspectionResult) {
  const labels: Record<InspectionResult, string> = {
    CERTIFIED: "Siap digunakan",
    CERTIFIED_WITH_NOTES: "Perlu tindakan",
    NOT_CERTIFIED: "Perlu tindakan",
  };
  return labels[result];
}

export function categoryLabel(category: ItemCategory) {
  const labels: Record<ItemCategory, string> = {
    FACILITY: "Fasilitas",
    HVAC: "AC",
    LIGHTING: "Lampu",
    ELECTRICAL: "Listrik",
    AV: "AV",
    IT: "IT",
    CONSUMABLE: "Perlengkapan",
    CLEANLINESS: "Kebersihan",
    SAFETY: "Safety",
  };
  return labels[category];
}

export function priorityForItem(isCritical: boolean): IssuePriority {
  return isCritical ? "P2" : "P3";
}

export function assignedRoleForCategory(category: ItemCategory): UserRole {
  if (["AV", "IT"].includes(category)) return "IT_AV";
  if (["CONSUMABLE"].includes(category)) return "INSPECTOR";
  return "FACILITY";
}
