import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DIST_DIR = path.resolve(process.cwd(), "..", "frontend", "dist");

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const params = await ctx.params;
  const parts = params.path ?? [];

  const rel = parts.join("/");
  const abs = path.resolve(DIST_DIR, rel);

  // Prevent path traversal
  if (!abs.startsWith(DIST_DIR)) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  try {
    const s = await stat(abs);
    if (!s.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buf = await readFile(abs);
    const contentType = guessContentType(abs);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

function guessContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    case ".glb":
      return "model/gltf-binary";
    case ".mp4":
      return "video/mp4";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

