import type { ChecklistItem, ItemCategory } from "@/generated/prisma/client";

export interface EffectiveChecklistItem {
  id: string;
  sectionId: string;
  code: string;
  prompt: string;
  helpText: string | null;
  category: ItemCategory;
  isRequired: boolean;
  isCritical: boolean;
  sortOrder: number;
}

export interface ChecklistItemWithOverride extends ChecklistItem {
  roomOverrides?: Array<{
    prompt: string | null;
    helpText: string | null;
    category: ItemCategory | null;
    isCritical: boolean | null;
    isActive: boolean;
    sortOrder: number | null;
  }>;
}

function appliesToRoom(item: Pick<ChecklistItem, "appliesToRoomTypeSlugs">, roomId: string, roomTypeSlug: string) {
  if (item.appliesToRoomTypeSlugs.length === 0) return true;
  return item.appliesToRoomTypeSlugs.includes(roomTypeSlug) || item.appliesToRoomTypeSlugs.includes(`__room:${roomId}`);
}

export function getEffectiveChecklistItems<T extends ChecklistItemWithOverride>(items: T[], roomId: string, roomTypeSlug: string): EffectiveChecklistItem[] {
  return items
    .filter((item) => item.isActive && appliesToRoom(item, roomId, roomTypeSlug))
    .map((item) => {
      const override = item.roomOverrides?.[0];
      if (override && !override.isActive) return null;
      return {
        id: item.id,
        sectionId: item.sectionId,
        code: item.code,
        prompt: override?.prompt || item.prompt,
        helpText: override?.helpText ?? item.helpText,
        category: override?.category || item.category,
        isRequired: item.isRequired,
        isCritical: override?.isCritical ?? item.isCritical,
        sortOrder: override?.sortOrder ?? item.sortOrder,
      } satisfies EffectiveChecklistItem;
    })
    .filter((item): item is EffectiveChecklistItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
