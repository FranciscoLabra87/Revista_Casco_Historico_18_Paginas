import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { randomInt, webcrypto } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);

async function text(relativePath) {
  return readFile(join(projectRoot, relativePath), "utf8");
}

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `No se encontró el contrato: ${startMarker}`);
  assert.notEqual(end, -1, `No se encontró el límite del contrato: ${endMarker}`);
  return source.slice(start, end);
}

async function loadBackupTools() {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const filename of [
    "assets/core/modelo-editorial.js",
    "assets/core/esquema-registros.js",
    "assets/backup-tools.js"
  ]) {
    vm.runInContext(await text(filename), sandbox, { filename });
  }
  assert.ok(sandbox.MagazineBackupTools, "backup-tools.js debe publicar MagazineBackupTools");
  return sandbox.MagazineBackupTools;
}

function loadCoreModule(source, globalName, filename) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename });
  assert.ok(sandbox[globalName], `${filename} debe publicar ${globalName}`);
  return sandbox[globalName];
}

function validDynamicStructure() {
  return {
    version: 1,
    secciones: [
      {
        id: "portada",
        titulo: "Portada",
        proposito: "Presentar la edición.",
        tono: "gold",
        base: true,
        paginas: [{ id: "p01", titulo: "Portada", layout: "cover" }]
      },
      {
        id: "participacion",
        titulo: "Participación vecinal",
        proposito: "Reunir noticias creadas para esta edición.",
        tono: "palm",
        base: false,
        paginas: [{ id: "pcomunidad1", titulo: "Noticias del barrio", layout: "texto-foto" }]
      },
      {
        id: "contraportada",
        titulo: "Contraportada",
        proposito: "Cerrar la revista.",
        tono: "wood",
        base: true,
        paginas: [{ id: "p12", titulo: "Contraportada", layout: "back" }]
      }
    ]
  };
}

test("el programa editorial carga 10 segmentos y las 12 páginas P01–P12", async () => {
  const segmentsRoot = join(projectRoot, "segments");
  const directories = (await readdir(segmentsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  assert.equal(directories.length, 10, "deben existir exactamente diez carpetas de segmento");

  const sandbox = { window: { MAGAZINE_SEGMENTS: [] } };
  vm.createContext(sandbox);
  for (const directory of directories) {
    const file = join(segmentsRoot, directory, "segmento.js");
    const source = await readFile(file, "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }

  const segments = Array.from(sandbox.window.MAGAZINE_SEGMENTS);
  const pages = segments.reduce((all, segment) => all.concat(Array.from(segment.pages || [])), []);
  const expectedIds = Array.from({ length: 12 }, (_, index) => `p${String(index + 1).padStart(2, "0")}`);
  const expectedNumbers = Array.from({ length: 12 }, (_, index) => index + 1);

  assert.equal(segments.length, 10);
  assert.equal(pages.length, 12);
  assert.deepEqual(pages.map((page) => page.id), expectedIds);
  assert.deepEqual(pages.map((page) => page.number), expectedNumbers);
  assert.equal(new Set(pages.map((page) => page.id)).size, 12, "no puede haber páginas repetidas");
  assert.equal(pages[0].layout, "cover");
  assert.equal(pages.at(-1).layout, "back");
});

test("index.html carga el núcleo antes de infraestructura y aplicación", async () => {
  const html = await text("index.html");
  const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
  const modelIndex = scripts.indexOf("./assets/core/modelo-editorial.js");
  const structureIndex = scripts.indexOf("./assets/core/estructura.js");
  const migrationsIndex = scripts.indexOf("./assets/core/migraciones.js");
  const schemaIndex = scripts.indexOf("./assets/core/esquema-registros.js");
  const backupIndex = scripts.indexOf("./assets/backup-tools.js");
  const storeIndex = scripts.indexOf("./assets/data-store.js");
  const appIndex = scripts.indexOf("./assets/app.js");

  assert.notEqual(modelIndex, -1, "falta el modelo editorial");
  assert.notEqual(structureIndex, -1, "faltan las herramientas de estructura");
  assert.notEqual(migrationsIndex, -1, "falta el módulo de migraciones");
  assert.notEqual(schemaIndex, -1, "falta el esquema común de registros");
  assert.notEqual(backupIndex, -1, "falta assets/backup-tools.js");
  assert.notEqual(storeIndex, -1, "falta assets/data-store.js");
  assert.notEqual(appIndex, -1, "falta assets/app.js");
  assert.ok(modelIndex < schemaIndex && schemaIndex < backupIndex && structureIndex < backupIndex && migrationsIndex < storeIndex,
    "el núcleo puro debe cargarse antes de sus adaptadores");
  assert.ok(backupIndex < storeIndex && storeIndex < appIndex, "el orden seguro debe terminar en backup-tools → data-store → app");
});

test("la fachada de almacenamiento arranca con sus dependencias explícitas", async () => {
  const sandbox = {
    console,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    document: { addEventListener() {}, visibilityState: "visible" }
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.dispatchEvent = () => true;
  vm.createContext(sandbox);
  for (const filename of [
    "assets/core/modelo-editorial.js",
    "assets/core/migraciones.js",
    "assets/core/esquema-registros.js",
    "assets/data-store.js"
  ]) {
    vm.runInContext(await text(filename), sandbox, { filename });
  }
  assert.ok(sandbox.MagazineData);
  for (const method of ["init", "create", "switchTo", "putMany", "importProject", "exportProject"]) {
    assert.equal(typeof sandbox.MagazineData[method], "function", `MagazineData.${method} debe existir`);
  }
});

test("backup-tools conserva un respaldo dinámico completo", async () => {
  const backupTools = await loadBackupTools();
  const entries = [
    ["settings:issue", JSON.stringify({
      edition: "Edición comunitaria de prueba",
      formato: "a4",
      programVersion: "12",
      verified: false
    })],
    ["settings:estructura", JSON.stringify(validDynamicStructure())],
    ["text:pcomunidad1.title", "Una noticia creada para esta edición"],
    ["image:pcomunidad1.principal", "data:image/png;base64,iVBORw0KGgo="],
    ["image-meta:pcomunidad1.principal", JSON.stringify({
      width: 1600,
      height: 1200,
      originalWidth: 3200,
      originalHeight: 2400,
      alt: "Vecinas reunidas en la plaza",
      caption: "Encuentro comunitario de agosto.",
      credit: "Archivo de la agrupación",
      permission: true,
      minors: false,
      fit: "cover"
    })],
    ["done:pcomunidad1", "1"]
  ];

  const validated = backupTools.validateEntries(entries);
  assert.deepEqual(JSON.parse(JSON.stringify(validated)), entries);
});

test("backup-tools rechaza claves ajenas y configuraciones inválidas", async () => {
  const backupTools = await loadBackupTools();

  assert.throws(
    () => backupTools.validateEntries([["secret:p01", "no pertenece al taller"]]),
    /clave editorial.*no es válida/i
  );
  assert.throws(
    () => backupTools.validateEntries([["settings:otro", "{}"]]),
    /configuración.*no está registrado/i
  );
  assert.throws(
    () => backupTools.validateEntries([["settings:issue", JSON.stringify({ formato: "carta" })]]),
    /formato.*no está registrado/i
  );

  const structure = validDynamicStructure();
  structure.secciones[1].paginas[0].layout = "maqueta-inexistente";
  assert.throws(
    () => backupTools.validateEntries([["settings:estructura", JSON.stringify(structure)]]),
    /maqueta.*no registrada/i
  );
});

test("showEditor espera migraciones y el núcleo calcula formatos y PDF", async () => {
  const app = await text("assets/app.js");
  const showEditor = sectionBetween(app, "async function showEditor(options = {})", "async function showProjectHome(options = {})");
  const migration = showEditor.indexOf("await migrarADocePaginas()");
  const reloads = Array.from(showEditor.matchAll(/recargarEstructura\(\)/g), (match) => match.index);

  assert.notEqual(migration, -1, "showEditor debe esperar la migración de páginas");
  assert.ok(reloads.length >= 2, "showEditor debe recargar la estructura antes y después de migrar");
  assert.ok(reloads[0] < migration, "la edición activa debe cargarse antes de migrar");
  assert.ok(reloads.some((position) => position > migration), "la estructura migrada debe recargarse antes de renderizar");
  assert.match(showEditor, /await migrarSumarioAntiguo\(\)/);
  assert.match(showEditor, /await limpiarCamposRetirados\(\)/);

  const model = loadCoreModule(
    await text("assets/core/modelo-editorial.js"),
    "CascoModeloEditorial",
    "assets/core/modelo-editorial.js"
  );
  assert.equal(model.reglaPagina("a5", "office"), "@page { size: 148mm 210mm; margin: 0; }");
  assert.equal(model.reglaPagina("a4", "press"), "@page { size: 272mm 384mm; margin: 0; }");
  assert.deepEqual(JSON.parse(JSON.stringify(model.dimensionesSalida("tabloide", "press"))), { ancho: 342, alto: 487 });
  assert.match(model.pasosImpresion("a4", "press").join(" "), /272 × 384 mm/);
  assert.match(model.pasosImpresion("a4", "press").join(" "), /3 mm/);
  assert.equal(model.normalizarAjustesParaGuardar({ formato: "carta" }).formato, "a5");
});

test("la migración real 18→12 conserva datos retirados y reabre aprobaciones", async () => {
  const migrationTools = loadCoreModule(
    await text("assets/core/migraciones.js"),
    "CascoMigraciones",
    "assets/core/migraciones.js"
  );
  const legacyStructure = JSON.stringify({
    version: 1,
    secciones: [
      { id: "portada18", titulo: "Portada", paginas: [{ id: "p01", layout: "cover" }] },
      { id: "cierre18", titulo: "Contraportada", paginas: [{ id: "p18", layout: "back" }] }
    ]
  });
  const records = new Map([
    ["settings:issue", JSON.stringify({ edition: "Edición histórica" })],
    ["settings:estructura", legacyStructure],
    ["text:p03.title", "Carta de la dirección"],
    ["text:p05.title", "Avances del barrio"],
    ["text:p12extra.title", "Página dinámica que no pertenece al folio P12"],
    ["text:p09.q3", "¿Qué mensaje deja al barrio?"],
    ["text:p09.a3", "Cuidemos nuestra memoria común."],
    ["text:p09.quote", "Aquí aprendimos a trabajar juntos."],
    ["text:p09.credit", "Entrevista: Equipo editorial"],
    ["text:p11.body1", "Lo que permanece de esta historia."],
    ["text:p11.quote", "El patrimonio también está vivo."],
    ["text:p13.title", "Almacén La Estación"],
    ["text:p13.contact", "Calle Principal 123 · 9 a 18 h"],
    ["text:p13.label", "Contenido editorial"],
    ["text:p13.body1", "Historia extensa del comercio"],
    ["image:p13.commerce", "data:image/png;base64,aG9sYQ=="],
    ["image-meta:p13.commerce", JSON.stringify({ width: 1200, height: 800 })],
    ["text:p15.title", "Agenda comunitaria"],
    ["text:p15.deck", "Fechas verificadas antes del cierre"],
    ["text:p15.agenda.count", "4"],
    ["text:p15.agenda.0.day", "05"],
    ["text:p15.agenda.0.title", "Reunión vecinal"],
    ["text:p15.agenda.3.day", "28"],
    ["text:p15.agenda.3.title", "Cuarta actividad histórica"],
    ["image:p09.historic", "data:image/png;base64,iVBORw0KGgo="],
    ["image:plegacy09.historic", "data:image/png;base64,b2xk"],
    ["done:p03", "1"],
    ["done:p05", "1"]
  ]);
  const result = migrationTools.planificarMigracionADoce({
    entries: [...records.entries()],
    ajustesGuardados: JSON.parse(records.get("settings:issue")),
    ajustesNormalizados: { edition: "Edición histórica", formato: "a5", verified: false, programVersion: "12" }
  });
  for (const [key, value] of result.cambios) {
    if (value === null) records.delete(key);
    else records.set(key, value);
  }

  assert.equal(records.get("text:p02.edTitle"), "Carta de la dirección");
  assert.equal(records.get("text:p04.title"), "Avances del barrio");
  assert.equal(records.get("text:p12extra.title"), "Página dinámica que no pertenece al folio P12");
  assert.equal(records.get("text:p07.q3"), "¿Qué mensaje deja al barrio?");
  assert.equal(records.get("text:p07.a3"), "Cuidemos nuestra memoria común.");
  assert.equal(records.get("text:p07.quote"), "Aquí aprendimos a trabajar juntos.");
  assert.equal(records.get("text:p07.credit"), "Entrevista: Equipo editorial");
  assert.equal(records.get("text:p08.body3"), "Lo que permanece de esta historia.");
  assert.equal(records.get("text:p08.quote"), "El patrimonio también está vivo.");
  assert.equal(records.get("text:p07.negocio"), "Almacén La Estación");
  assert.equal(records.get("text:p07.visita"), "Calle Principal 123 · 9 a 18 h");
  assert.equal(records.get("text:p07.aviso"), "Contenido editorial");
  assert.equal(records.get("image:p07.commerce"), "data:image/png;base64,aG9sYQ==");
  assert.equal(JSON.parse(records.get("image-meta:p07.commerce")).width, 1200);
  assert.equal(records.get("text:plegacy13.body1"), "Historia extensa del comercio");
  assert.equal(records.get("text:p10.agendaLabel"), "Agenda comunitaria");
  assert.equal(records.get("text:p10.agendaNota"), "Fechas verificadas antes del cierre");
  assert.equal(records.get("text:p10.agenda.count"), "3");
  assert.equal(records.get("text:p10.agenda.0.day"), "05");
  assert.equal(records.get("text:p10.agenda.0.title"), "Reunión vecinal");
  assert.equal(records.has("text:p10.agenda.3.title"), false,
    "la maqueta de 12 páginas no debe conservar una cuarta ficha invisible");
  assert.equal(records.get("text:plegacy15.agenda.count"), "4");
  assert.equal(records.get("text:plegacy15.agenda.3.title"), "Cuarta actividad histórica",
    "la cuarta ficha debe quedar recuperable en el respaldo histórico");
  assert.equal(records.has("settings:estructura"), false, "la estructura antigua no debe gobernar las páginas nuevas");
  assert.equal(records.get("settings:estructura-legacy"), legacyStructure,
    "la estructura histórica debe conservarse dentro del respaldo");
  assert.equal(records.get("image:plegacy09.historic"), "data:image/png;base64,b2xk");
  assert.equal(records.get("image:plegacy09x2.historic"), "data:image/png;base64,iVBORw0KGgo=",
    "una migración no debe sobrescribir un archivo histórico anterior");
  assert.equal(records.get("done:p02"), undefined, "la página fusionada debe volver a revisión");
  assert.equal(records.get("done:p04"), undefined, "la página recompuesta debe volver a revisión");
  assert.equal(records.get("done:plegacy03"), "1", "el estado histórico puede quedar archivado sin contar como vigente");
  assert.equal(JSON.parse(records.get("settings:issue")).programVersion, "12");
  assert.ok(result.movidas >= 2);
  assert.ok(result.archivadas >= 3);
  const secondPass = migrationTools.planificarMigracionADoce({
    entries: [...records.entries()],
    ajustesGuardados: JSON.parse(records.get("settings:issue")),
    ajustesNormalizados: JSON.parse(records.get("settings:issue"))
  });
  assert.equal(secondPass.cambios.size, 0, "la migración debe ser idempotente");
  assert.equal(secondPass.omitida, true);
  assert.equal(migrationTools.detectarProgramaHeredado([["image:p14.culture", "x"]]), 16);
  assert.equal(migrationTools.detectarProgramaHeredado([["image:p16.culture", "x"]]), 18);
  assert.equal(migrationTools.remapearClaveDieciseis("text:p16.tagline"), "text:p18.tagline");
  const mapPlan = migrationTools.planificarMigracionADoce({
    entries: new Map([["text:p15.agenda.1.title", "Feria local"]]),
    ajustesGuardados: {},
    ajustesNormalizados: { programVersion: "12" }
  });
  assert.equal(mapPlan.cambios.get("text:p10.agenda.1.title"), "Feria local",
    "la API de migración debe aceptar Map además de listas de pares");

  const legacySixteen = migrationTools.remapearEntradasDieciseis([
    ["text:p08.q3", "Pregunta final de la entrevista de 16 páginas"],
    ["text:p11.title", "Comercio de la edición de 16 páginas"],
    ["image:p11.commerce", "data:image/png;base64,aG9sYQ=="],
    ["text:p13.agenda.0.title", "Actividad heredada de 16 páginas"]
  ]);
  const chainedPlan = migrationTools.planificarMigracionADoce({
    entries: legacySixteen,
    ajustesGuardados: {},
    ajustesNormalizados: { programVersion: "12" }
  });
  assert.equal(chainedPlan.cambios.get("text:p07.q3"), "Pregunta final de la entrevista de 16 páginas");
  assert.equal(chainedPlan.cambios.get("text:p07.negocio"), "Comercio de la edición de 16 páginas");
  assert.equal(chainedPlan.cambios.get("image:p07.commerce"), "data:image/png;base64,aG9sYQ==");
  assert.equal(chainedPlan.cambios.get("text:p10.agenda.0.title"), "Actividad heredada de 16 páginas");
});

test("estructura y registro de maquetas permanecen en correspondencia", async () => {
  const model = loadCoreModule(
    await text("assets/core/modelo-editorial.js"),
    "CascoModeloEditorial",
    "assets/core/modelo-editorial.js"
  );
  const structure = loadCoreModule(
    await text("assets/core/estructura.js"),
    "CascoEstructura",
    "assets/core/estructura.js"
  );
  const app = await text("assets/app.js");
  const rendererBlock = sectionBetween(app, "const renderers = {", "function renderPage(page)");
  const rendererNames = new Set(Array.from(
    rendererBlock.matchAll(/^\s*(?:"([^"]+)"|([a-z][a-z0-9-]*)):\s*render[A-Za-z]+/gm),
    (match) => match[1] || match[2]
  ));
  assert.deepEqual(
    [...model.LAYOUTS_PERMITIDOS].filter((layout) => !rendererNames.has(layout)),
    [],
    "toda maqueta admitida debe tener renderizador"
  );
  assert.deepEqual(
    [...rendererNames].filter((layout) => !model.LAYOUTS_PERMITIDOS.includes(layout)),
    [],
    "no debe haber renderizadores huérfanos fuera del registro editorial"
  );

  const segments = [{
    id: "portada",
    title: "Portada",
    purpose: "Abrir",
    pages: [{ id: "p01", number: 1, title: "Portada", layout: "cover", fields: {}, lists: {} }]
  }];
  const custom = [
    ...structure.estructuraBase(segments, { portada: "gold" }),
    { id: "vecindad", titulo: "Vecindad", tono: "palm", paginas: [{ id: "pvecindad", layout: "texto-2col", titulo: "Noticias" }] }
  ];
  const pages = structure.construirPaginas({
    secciones: custom,
    segmentos: segments,
    catalogo: model.CATALOGO_MAQUETAS,
    tonos: model.TONOS_SECCION
  });
  assert.deepEqual(Array.from(pages, (page) => page.id), ["p01", "pvecindad"]);
  assert.equal(pages[1].number, 2);
  assert.equal(pages[1].delCatalogo, true);
  assert.equal(pages[1].fields.title, "Título de la sección");
});

test("el núcleo permanece puro y no reaparecen fuentes de verdad duplicadas", async () => {
  const coreFiles = [
    "assets/core/modelo-editorial.js",
    "assets/core/estructura.js",
    "assets/core/migraciones.js",
    "assets/core/esquema-registros.js"
  ];
  for (const filename of coreFiles) {
    const source = await text(filename);
    assert.doesNotMatch(source, /\bdocument\b|\bindexedDB\b|\bfetch\s*\(/,
      `${filename} no debe depender del DOM, la base de datos ni la red`);
  }

  const app = await text("assets/app.js");
  const store = await text("assets/data-store.js");
  const backup = await text("assets/backup-tools.js");
  const writerLock = sectionBetween(app, "async function acquireWriterLock()", "if (!await acquireWriterLock())");
  assert.match(writerLock, /\.catch\(\(\) => resolve\(false\)\)/,
    "si Web Locks falla, una segunda ventana no debe continuar escribiendo sin exclusión");
  assert.doesNotMatch(app, /const\s+FORMATOS\s*=|const\s+MAPA_DOCE\s*=|const\s+CATALOGO_MAQUETAS\s*=\s*\[/);
  assert.doesNotMatch(store, /const\s+LEGACY_16_PAGE_MAP\s*=\s*Object\.freeze\s*\(\s*\{/);
  assert.doesNotMatch(store, /const\s+DATA_IMAGE_PATTERN\s*=|const\s+RELATIVE_KEY_PATTERN\s*=/);
  assert.match(store, /versionsBeforeWrite/);
  assert.match(store, /activeRecordVersions\.get\(key\).*versionsBeforeWrite\.get\(key\)/s,
    "un lote no debe pisar en caché una edición más nueva de la misma clave");
  assert.ok(backup.split(/\r?\n/).length < 60, "backup-tools debe seguir siendo una fachada del esquema común");
  assert.ok(app.split(/\r?\n/).length < 5_200, "el controlador no debe volver a absorber el dominio extraído");
});

test("el esquema común aplica la misma validación a almacenamiento y respaldo", async () => {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const filename of ["assets/core/modelo-editorial.js", "assets/core/esquema-registros.js"]) {
    vm.runInContext(await text(filename), sandbox, { filename });
  }
  const schema = sandbox.CascoEsquemaRegistros;
  const metadata = JSON.stringify({
    width: 1600,
    height: 900,
    alt: "Feria comunitaria",
    credit: "Archivo vecinal",
    permission: true,
    minors: false,
    fit: "cover"
  });
  assert.equal(schema.validarEntrada("image-meta:p03.principal", metadata), "image-meta:p03.principal");
  assert.throws(
    () => schema.validarEntrada("image-meta:p03.principal", JSON.stringify({ ...JSON.parse(metadata), rutaPrivada: "C:/secreto" })),
    /campo desconocido/i
  );
  const normalized = schema.normalizarColeccion([
    ["text:p03.title", "Noticias"],
    ["done:p03", null]
  ], { permitirBorrado: true });
  assert.equal(normalized.get("text:p03.title"), "Noticias");
  assert.equal(normalized.get("done:p03"), null);
  assert.doesNotThrow(() => schema.validarAjustesEdicion(
    JSON.stringify({ edition: "Edición heredada", programVersion: "18" }),
    { versionesPrograma: ["16", "18"] }
  ));
  assert.throws(
    () => schema.validarAjustesEdicion(JSON.stringify({ programVersion: "99" }), { versionesPrograma: ["16", "18"] }),
    /no es compatible/i
  );
  const oldStructure = JSON.stringify({
    version: 1,
    secciones: [
      { id: "inicio", titulo: "Portada", paginas: [{ id: "p01", layout: "cover" }] },
      { id: "fin", titulo: "Cierre", paginas: [{ id: "p18", layout: "back" }] }
    ]
  });
  assert.doesNotThrow(() => schema.validarEntrada("settings:estructura-legacy", oldStructure));
  assert.throws(() => schema.validarEntrada("settings:estructura", oldStructure), /contraportada P12/i);
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function httpGet(port, path, hostHeader = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: { Host: hostHeader }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.setTimeout(2_000, () => req.destroy(new Error("El servidor local no respondió a tiempo.")));
    req.on("error", reject);
    req.end();
  });
}

function httpPost(port, path, body, origin) {
  return new Promise((resolve, reject) => {
    const headers = {
      Host: `127.0.0.1:${port}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    };
    if (origin) headers.Origin = origin;
    const req = request({ hostname: "127.0.0.1", port, path, method: "POST", headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.setTimeout(2_000, () => req.destroy(new Error("El servidor local no respondió a tiempo.")));
    req.on("error", reject);
    req.end(body);
  });
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit").catch(() => undefined);
  child.kill();
  await Promise.race([exited, delay(2_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit").catch(() => undefined), delay(2_000)]);
  }
}

async function startServer() {
  const serverFile = join(projectRoot, "servidor-local.mjs");
  let lastLog = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = randomInt(20_000, 60_000);
    const child = spawn(process.execPath, [serverFile, String(port)], {
      cwd: projectRoot,
      env: { ...process.env, ANTHROPIC_API_KEY: "clave-de-prueba-no-real" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    child.stdout.on("data", (chunk) => { lastLog += chunk.toString(); });
    child.stderr.on("data", (chunk) => { lastLog += chunk.toString(); });

    for (let poll = 0; poll < 60; poll += 1) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      try {
        const health = await httpGet(port, "/__casco_health");
        if (health.status === 200) return { child, port };
      } catch {
        // El proceso todavía está iniciando; se vuelve a consultar.
      }
      await delay(50);
    }
    await stopServer(child);
  }

  throw new Error(`No se pudo iniciar servidor-local.mjs en un puerto libre. ${lastLog}`);
}

test("el servidor local entrega la revista y salud, y bloquea rutas sensibles", { timeout: 15_000 }, async () => {
  const { child, port } = await startServer();
  try {
    const home = await httpGet(port, "/");
    assert.equal(home.status, 200);
    assert.match(home.headers["content-type"] || "", /text\/html/);
    assert.match(home.body, /Revista Casco Histórico/i);

    for (const corePath of [
      "/assets/core/modelo-editorial.js",
      "/assets/core/estructura.js",
      "/assets/core/migraciones.js",
      "/assets/core/esquema-registros.js"
    ]) {
      const moduleResponse = await httpGet(port, corePath);
      assert.equal(moduleResponse.status, 200, `${corePath} debe quedar disponible para la aplicación`);
      assert.match(moduleResponse.headers["content-type"] || "", /javascript/);
    }

    const health = await httpGet(port, "/__casco_health");
    assert.equal(health.status, 200);
    assert.equal(health.headers["x-casco-studio"], "2");
    const healthData = JSON.parse(health.body);
    assert.equal(healthData.status, "CASCO_STUDIO_OK");
    assert.equal(healthData.revision, "casco-studio-12-2026-08-20");
    assert.equal(healthData.root, projectRoot);

    const invalidJsonShape = await httpPost(port, "/api/asistente", "null", `http://127.0.0.1:${port}`);
    assert.equal(invalidJsonShape.status, 400, "un JSON nulo debe rechazarse sin terminar el proceso");
    const healthAfterInvalid = await httpGet(port, "/__casco_health");
    assert.equal(healthAfterInvalid.status, 200, "el servidor debe seguir vivo tras una entrada inválida");

    const noOrigin = await httpPost(port, "/api/asistente", "null");
    assert.equal(noOrigin.status, 403, "el proxy facturable debe exigir el origen local esperado");

    for (const sensitivePath of [
      "/servidor-local.mjs",
      "/clave-ia.txt",
      "/.git/config",
      "/package.json",
      "/%2e%2e/servidor-local.mjs"
    ]) {
      const response = await httpGet(port, sensitivePath);
      assert.notEqual(response.status, 200, `${sensitivePath} no debe ser público`);
    }

    const hostileHost = await httpGet(port, "/", "sitio-malicioso.example");
    assert.equal(hostileHost.status, 403, "el servidor sólo debe aceptar localhost");
  } finally {
    await stopServer(child);
  }
});
