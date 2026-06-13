import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RoomDetail({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  redirect(`/mobile/rooms/${roomId}/inspect`);
}
