import QRCode from "qrcode";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function publicAppUrl(origin: string) {
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).trim().replace(/\/+$/, "");
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "");
  if (!basePath) return configuredUrl;

  try {
    const url = new URL(configuredUrl);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname === basePath) return configuredUrl;

    url.pathname = `${pathname}${basePath}`;
    return url.toString().replace(/\/+$/, "");
  } catch {
    if (configuredUrl.endsWith(basePath)) return configuredUrl;
    return `${configuredUrl}${basePath}`;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });

  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const baseUrl = publicAppUrl(request.nextUrl.origin);
  const url = `${baseUrl}/mobile/rooms/${room.id}/inspect`;
  const png = await QRCode.toBuffer(url, { width: 320, margin: 1, errorCorrectionLevel: "M" });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
