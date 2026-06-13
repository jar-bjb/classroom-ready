import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const allowedImageTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filePath: string[] }> }) {
  const { filePath } = await params;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "/tmp/classroom-ready-uploads");
  const requestedPath = path.resolve(uploadRoot, ...filePath);
  const relativePath = path.relative(uploadRoot, requestedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return new Response("Forbidden", { status: 403 });
  }

  const extension = path.extname(requestedPath).toLowerCase();
  const contentType = allowedImageTypes[extension];
  if (!contentType) {
    return new Response("Unsupported media type", { status: 415 });
  }

  try {
    const file = await readFile(requestedPath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
