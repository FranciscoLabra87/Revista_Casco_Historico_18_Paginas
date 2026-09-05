// Compila el taller en un ejecutable único.
//
//   npm run build
//
// El resultado queda en `dist/` y no necesita Node instalado: el runtime y
// todos los archivos del taller viajan dentro del .exe.
//
// Cómo funciona, en tres pasos:
//   1. Se arma la lista de archivos que el taller sirve y se escribe una
//      configuración SEA con esa lista como recursos embebidos.
//   2. `node --experimental-sea-config` empaqueta el código y los recursos en
//      un blob.
//   3. Se copia el propio `node.exe` y se le inyecta el blob con postject.
//
// La única herramienta externa es postject, y se descarga en el momento con
// `npx`. El taller sigue sin dependencias en tiempo de ejecución.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const salida = join(raiz, "dist");
const intermedios = join(salida, "intermedios");
const POSTJECT = "postject@1.0.0-alpha.6";
const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const nombreEjecutable = process.platform === "win32"
  ? "TallerCascoHistorico.exe"
  : "TallerCascoHistorico";

// Lo que el servidor sirve, según su propia lista blanca.
const ARCHIVOS_SUELTOS = ["index.html", "LEEME_PRIMERO.md", "ESTRUCTURA_RAMIFICADA.md"];
const CARPETAS = ["assets", "segments", "DOCUMENTACION", "PLANTILLAS"];

// Lo que no tiene sentido cargar dentro del ejecutable.
//
// `assets/demo` son las maquetas de referencia del rediseño y sus fotografías:
// 15 MB de andamio que no forma parte del programa. Los tres archivos pesados de
// DOCUMENTACION son material de consulta de la versión anterior; el manual y las
// demás guías, que sí se abren desde el taller, van en .md y sí se embeben.
const EXCLUIDOS = [
  "assets/demo",
  "DOCUMENTACION/Vista_previa_revista_Casco_Historico.pdf",
  "DOCUMENTACION/Programa_editorial_revista_Casco_Historico.docx",
  "DOCUMENTACION/Vista_general_18_paginas.png"
];

function excluido(clave) {
  return EXCLUIDOS.some((patron) => clave === patron || clave.startsWith(`${patron}/`));
}

function recorrer(carpeta, acumulado = []) {
  for (const entrada of readdirSync(join(raiz, carpeta), { withFileTypes: true })) {
    if (entrada.name.startsWith(".")) continue;
    const clave = `${carpeta}/${entrada.name}`;
    if (excluido(clave)) continue;
    if (entrada.isDirectory()) recorrer(clave, acumulado);
    else if (entrada.isFile()) acumulado.push(clave);
  }
  return acumulado;
}

function humano(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// `shell: true` en Windows parte la ruta del ejecutable en el primer espacio, y
// Node vive en «C:\Program Files». Sólo npx lo necesita, porque es un .cmd.
function ejecutar(orden, argumentos, descripcion, { shell = false } = {}) {
  const resultado = spawnSync(orden, argumentos, { cwd: raiz, stdio: "inherit", shell });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`${descripcion} falló con código ${resultado.status}.`);
  }
}

console.log("Compilando el taller editorial\n");

// 1 · Reunir los archivos ----------------------------------------------------

const claves = [];
for (const archivo of ARCHIVOS_SUELTOS) {
  try {
    statSync(join(raiz, archivo));
    claves.push(archivo);
  } catch {
    throw new Error(`Falta un archivo que el servidor declara público: ${archivo}`);
  }
}
for (const carpeta of CARPETAS) recorrer(carpeta, claves);

const recursos = {};
let pesoRecursos = 0;
const porCarpeta = new Map();
for (const clave of claves) {
  const absoluta = join(raiz, clave.split("/").join(sep));
  recursos[clave] = absoluta;
  const bytes = statSync(absoluta).size;
  pesoRecursos += bytes;
  const grupo = clave.includes("/") ? clave.split("/")[0] : "(raíz)";
  porCarpeta.set(grupo, (porCarpeta.get(grupo) || 0) + bytes);
}

console.log(`  ${claves.length} archivos embebidos, ${humano(pesoRecursos)} en total:`);
for (const [grupo, bytes] of [...porCarpeta].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${grupo.padEnd(16)} ${humano(bytes).padStart(9)}`);
}
console.log(`  excluidos: ${EXCLUIDOS.join(", ")}\n`);

// 2 · Preparar el blob -------------------------------------------------------

rmSync(salida, { recursive: true, force: true });
mkdirSync(intermedios, { recursive: true });

const configuracion = join(intermedios, "sea-config.json");
const blob = join(intermedios, "taller.blob");
writeFileSync(configuracion, `${JSON.stringify({
  main: "servidor/nucleo.cjs",
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: recursos
}, null, 2)}\n`);

ejecutar(process.execPath, ["--experimental-sea-config", configuracion], "La preparación del blob");

// 3 · Inyectar en una copia del runtime --------------------------------------

const ejecutable = join(salida, nombreEjecutable);
copyFileSync(process.execPath, ejecutable);
console.log(`\n  runtime copiado: ${humano(statSync(ejecutable).size)}`);

ejecutar("npx", ["--yes", POSTJECT, ejecutable, "NODE_SEA_BLOB", blob, "--sentinel-fuse", FUSE], "La inyección con postject", { shell: process.platform === "win32" });

// 4 · Informe ----------------------------------------------------------------

rmSync(intermedios, { recursive: true, force: true });

const bytes = statSync(ejecutable).size;
const sha = createHash("sha256").update(readFileSync(ejecutable)).digest("hex");

console.log(`\nListo: dist/${nombreEjecutable}`);
console.log(`  tamaño   ${humano(bytes)}`);
console.log(`  sha256   ${sha}`);
console.log(`\nCompruebe que arranca antes de publicarlo:`);
console.log(`  dist/${nombreEjecutable} 8791`);
console.log(`\nEl ejecutable no está firmado, así que Windows mostrará el aviso de`);
console.log(`SmartScreen la primera vez. Publique el sha256 junto al archivo para`);
console.log(`que quien lo descargue pueda comprobar que es el mismo.`);
