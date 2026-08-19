import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.argv[2] || "8787", 10);
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65_535
  ? requestedPort
  : 8787;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = normalize(decoded === "/" ? "index.html" : decoded.replace(/^\/+/, ""));
  const target = join(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) return null;
  return target;
}

const server = createServer(async (request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Método no permitido");
    return;
  }

  if (request.url.split("?")[0] === "/__casco_health") {
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Casco-Studio": "1"
    });
    response.end(request.method === "HEAD" ? undefined : "CASCO_STUDIO_OK");
    return;
  }

  let target;
  try {
    target = safePath(request.url);
  } catch {
    target = null;
  }
  if (!target) {
    response.writeHead(400);
    response.end("Solicitud no válida");
    return;
  }

  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = join(target, "index.html");
      info = await stat(target);
    }
    if (!info.isFile()) throw new Error("not-file");
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Archivo no encontrado");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") process.exit(0);
  throw error;
});

server.listen(port, host, () => {
  console.log(`Taller editorial disponible en http://${host}:${port}/`);
});
