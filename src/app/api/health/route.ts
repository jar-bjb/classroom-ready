import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

async function checkDatabase(): Promise<CheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkUploadDirectory(): Promise<CheckStatus> {
  try {
    await access(process.env.UPLOAD_DIR || "/tmp/classroom-ready-uploads", constants.R_OK | constants.W_OK);
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const checks = {
    database: await checkDatabase(),
    uploadDirectory: await checkUploadDirectory(),
  };
  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      checks,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
