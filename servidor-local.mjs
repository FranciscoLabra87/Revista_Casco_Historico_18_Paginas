import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const host = "127.0.0.1";
const HEALTH_REVISION = "casco-studio-12-2026-08-20";
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

// El servidor entregaba cualquier archivo de la carpeta, incluidos clave-ia.txt
// y todo el historial de .git. Ahora sólo sirve lo que el taller necesita: una
// lista blanca, no una lista de exclusiones, para que un archivo nuevo no quede
// expuesto por olvido.
const CARPETAS_PUBLICAS = new Set(["assets", "segments", "DOCUMENTACION", "PLANTILLAS"]);
const ARCHIVOS_PUBLICOS = new Set([
  "index.html",
  "LEEME_PRIMERO.md",
  "ESTRUCTURA_RAMIFICADA.md"
]);

function rutaPublica(relative) {
  const partes = String(relative).split(/[\\/]+/).filter(Boolean);
  if (!partes.length) return false;
  if (partes.some((parte) => parte.startsWith("."))) return false;
  if (partes.length === 1) return ARCHIVOS_PUBLICOS.has(partes[0]);
  return CARPETAS_PUBLICAS.has(partes[0]);
}

// Sin comprobar la cabecera Host, un sitio cualquiera puede apuntar su dominio
// a 127.0.0.1 y leer las respuestas como si fueran del mismo origen.
function anfitrionValido(request) {
  const host = String(request.headers.host || "").toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = normalize(decoded === "/" ? "index.html" : decoded.replace(/^\/+/, ""));
  if (!rutaPublica(relative)) return null;
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
const ASISTENTE_TIMEOUT_MS = 65_000;
const IDLE_SHUTDOWN_MS = 45 * 60_000;
const localAppData = String(process.env.LOCALAPPDATA || "").trim();
const directorioLlave = localAppData
  ? join(localAppData, "CascoHistorico")
  : join(homedir(), ".casco-historico");
const archivoLlave = join(directorioLlave, "clave-ia.txt");
let asistenteEnCurso = false;
let ultimaActividad = Date.now();
const ORIGENES_PERMITIDOS = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`
]);

async function leerLlave() {
  const desdeEntorno = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (desdeEntorno) return desdeEntorno;
  try {
    const archivo = await readFile(archivoLlave, "utf8");
    return archivo.trim();
  } catch {
    return "";
  }
}

function responderJson(response, status, cuerpo) {
  if (response.destroyed || response.writableEnded) return;
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
  if (!ORIGENES_PERMITIDOS.has(origen)) {
    responderJson(response, 403, { error: "Origen no permitido." });
    return;
  }

  const llave = await leerLlave();
  if (!llave) {
    responderJson(response, 503, {
      error: "Falta la llave de la API.",
      detalle: "Guarde clave-ia.txt en la carpeta local CascoHistorico indicada en DOCUMENTACION/ASISTENTE_IA.md, o defina ANTHROPIC_API_KEY, y vuelva a iniciar el taller."
    });
    return;
  }

  let peticion;
  try {
    peticion = JSON.parse(await leerCuerpo(request));
    if (!peticion || typeof peticion !== "object" || Array.isArray(peticion)) {
      throw new TypeError("La solicitud debe contener un objeto JSON.");
    }
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

  if (asistenteEnCurso) {
    responderJson(response, 429, { error: "El asistente ya está atendiendo otra solicitud. Espere a que termine." });
    return;
  }

  asistenteEnCurso = true;
  const controller = new AbortController();
  const cancelarCliente = () => controller.abort(new Error("El cliente cerró la solicitud."));
  const temporizador = setTimeout(() => controller.abort(new Error("La API agotó el tiempo de espera.")), ASISTENTE_TIMEOUT_MS);
  request.once("aborted", cancelarCliente);
  response.once("close", cancelarCliente);
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
      }),
      signal: controller.signal
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
    if (response.destroyed) return;
    if (controller.signal.aborted) {
      responderJson(response, 504, {
        error: "La solicitud del asistente fue cancelada o agotó el tiempo de espera."
      });
      return;
    }
    responderJson(response, 502, {
      error: "No se pudo contactar la API.",
      detalle: "Compruebe la conexión a internet. El resto del taller funciona sin conexión."
    });
  } finally {
    clearTimeout(temporizador);
    request.removeListener("aborted", cancelarCliente);
    response.removeListener("close", cancelarCliente);
    asistenteEnCurso = false;
  }
}

const server = createServer(async (request, response) => {
  try {
    ultimaActividad = Date.now();
    const ruta = (request.url || "").split("?")[0];

  if (!anfitrionValido(request)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Solicitud no permitida");
    return;
  }

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
    const cuerpo = JSON.stringify({ status: "CASCO_STUDIO_OK", revision: HEALTH_REVISION, root });
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(cuerpo),
      "Cache-Control": "no-store",
      "X-Casco-Studio": "2"
    });
    response.end(request.method === "HEAD" ? undefined : cuerpo);
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
  } catch (error) {
    console.error("Solicitud local no controlada:", error);
    if (response.headersSent) {
      response.destroy();
    } else {
      responderJson(response, 500, { error: "El servidor local no pudo completar la solicitud." });
    }
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") process.exit(0);
  throw error;
});

server.listen(port, host, () => {
  console.log(`Taller editorial disponible en http://${host}:${port}/`);
});

const idleTimer = setInterval(() => {
  if (!asistenteEnCurso && Date.now() - ultimaActividad >= IDLE_SHUTDOWN_MS) {
    clearInterval(idleTimer);
    server.close(() => process.exit(0));
  }
}, 60_000);
idleTimer.unref();
