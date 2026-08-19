import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
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

// ---------------------------------------------------------------------------
// Asistente editorial
//
// La llave de la API vive aquí, en el servidor local, y nunca llega al
// navegador: la página pide /api/asistente a su propio equipo y es este proceso
// el que habla con la API. Así la llave no viaja en la carpeta de la revista
// cuando se copia, se comparte o se respalda.
// ---------------------------------------------------------------------------

const MODELO = "claude-sonnet-5";
const MAX_CUERPO_BYTES = 200_000;
const MAX_TOKENS_RESPUESTA = 1_500;
const ORIGENES_PERMITIDOS = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`
]);

async function leerLlave() {
  const desdeEntorno = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (desdeEntorno) return desdeEntorno;
  try {
    const archivo = await readFile(join(root, "clave-ia.txt"), "utf8");
    return archivo.trim();
  } catch {
    return "";
  }
}

function responderJson(response, status, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
    "Cache-Control": "no-store"
  });
  response.end(texto);
}

function leerCuerpo(request) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const partes = [];
    request.on("data", (parte) => {
      total += parte.length;
      if (total > MAX_CUERPO_BYTES) {
        reject(new Error("La solicitud es demasiado grande."));
        request.destroy();
        return;
      }
      partes.push(parte);
    });
    request.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    request.on("error", reject);
  });
}

async function manejarAsistente(request, response) {
  const origen = request.headers.origin;
  if (origen && !ORIGENES_PERMITIDOS.has(origen)) {
    responderJson(response, 403, { error: "Origen no permitido." });
    return;
  }

  const llave = await leerLlave();
  if (!llave) {
    responderJson(response, 503, {
      error: "Falta la llave de la API.",
      detalle: "Cree el archivo clave-ia.txt junto a servidor-local.mjs con la llave dentro, o defina la variable de entorno ANTHROPIC_API_KEY, y vuelva a iniciar el taller."
    });
    return;
  }

  let peticion;
  try {
    peticion = JSON.parse(await leerCuerpo(request));
  } catch (error) {
    responderJson(response, 400, { error: error.message || "No se pudo leer la solicitud." });
    return;
  }

  const sistema = String(peticion.sistema || "").slice(0, 8_000);
  const mensaje = String(peticion.mensaje || "").slice(0, 40_000);
  if (!mensaje.trim()) {
    responderJson(response, 400, { error: "La solicitud no incluye texto." });
    return;
  }

  try {
    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": llave,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS_RESPUESTA,
        system: sistema || undefined,
        messages: [{ role: "user", content: mensaje }]
      })
    });

    const datos = await respuesta.json();
    if (!respuesta.ok) {
      responderJson(response, respuesta.status, {
        error: datos?.error?.message || "La API rechazó la solicitud.",
        tipo: datos?.error?.type || ""
      });
      return;
    }

    const texto = (datos.content || [])
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("")
      .trim();

    responderJson(response, 200, {
      texto,
      uso: {
        entrada: datos.usage?.input_tokens ?? null,
        salida: datos.usage?.output_tokens ?? null
      }
    });
  } catch (error) {
    responderJson(response, 502, {
      error: "No se pudo contactar la API.",
      detalle: "Compruebe la conexión a internet. El resto del taller funciona sin conexión."
    });
  }
}

const server = createServer(async (request, response) => {
  const ruta = (request.url || "").split("?")[0];

  if (ruta === "/api/asistente") {
    if (request.method === "POST") {
      await manejarAsistente(request, response);
      return;
    }
    if (request.method === "GET") {
      responderJson(response, 200, { disponible: Boolean(await leerLlave()), modelo: MODELO });
      return;
    }
    responderJson(response, 405, { error: "Método no permitido." });
    return;
  }

  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD, POST" });
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
