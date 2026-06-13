import { roomStatusClass, roomStatusLabel } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${roomStatusClass(status)}`}>
      {roomStatusLabel(status)}
    </span>
  );
}
