import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });

  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const url = `${baseUrl}/mobile/rooms/${room.id}`;
  const png = await QRCode.toBuffer(url, { width: 320, margin: 1, errorCorrectionLevel: "M" });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
