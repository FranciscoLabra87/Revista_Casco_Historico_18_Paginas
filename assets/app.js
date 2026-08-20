(async function () {
  "use strict";

  const LEGACY_STORAGE_PREFIX = "casco-revista:";
  const projectStorage = window.MagazineData;
  if (!projectStorage) throw new Error("El taller no pudo iniciar su almacenamiento.");
  async function acquireWriterLock() {
    if (!navigator.locks?.request) return true;
    return new Promise((resolve) => {
      navigator.locks.request("casco-revista-studio-writer", { mode: "exclusive", ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        return new Promise((release) => window.addEventListener("pagehide", release, { once: true }));
      }).catch(() => resolve(true));
    });
  }
  if (!await acquireWriterLock()) {
    const home = document.getElementById("projectHome");
    if (home) {
      home.innerHTML = `<main class="project-home__main"><div class="project-empty-state"><div><h1>El taller ya está abierto</h1><p>Para proteger tus revistas, sólo se permite una ventana de edición a la vez. Vuelve a la pestaña anterior y cierra ésta.</p><button type="button" class="button button--primary" id="retryWriterLock">Reintentar</button></div></div></main>`;
      home.querySelector("#retryWriterLock")?.addEventListener("click", () => window.location.reload());
    }
    return;
  }
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
  try {
    await projectStorage.init();
    const migrationNotice = projectStorage.notice?.();
    if (migrationNotice?.code === "LEGACY_PROGRAM_AMBIGUOUS") {
      const answer = window.prompt("Encontramos un borrador de la versión anterior, pero no indica si tenía 16 o 18 páginas. Escribe 16 o 18 para recuperarlo ahora. Si pulsas Cancelar, se conservará intacto para decidirlo más tarde.", "18");
      if (answer !== null) {
        const pageCount = Number(String(answer).trim());
        if (pageCount === 16 || pageCount === 18) {
          try {
            await projectStorage.recoverLegacy(pageCount);
          } catch (migrationError) {
            window.alert(migrationError?.message || "No se pudo recuperar el borrador antiguo; sus datos se conservaron sin cambios.");
          }
        } else {
          window.alert("No se importó el borrador antiguo: debes escribir 16 o 18.");
        }
      }
    }
  } catch (error) {
    const home = document.getElementById("projectHome");
    if (home) {
      home.innerHTML = `<main class="project-home__main"><div class="project-empty-state"><h1>No se pudo abrir el taller editorial</h1><p>${String(error?.message || "El almacenamiento local no está disponible.").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p><p>Abre la revista con <strong>ABRIR_REVISTA.cmd</strong> y vuelve a intentarlo.</p></div></main>`;
    }
    return;
  }
  if (window.location.protocol === "file:") {
    const warning = document.createElement("div");
    warning.className = "local-file-warning";
    warning.setAttribute("role", "alert");
    warning.innerHTML = `<div><strong>Modo básico: esta ventana no guarda en el mismo lugar que el taller</strong>`
      + `<p>Abriste <code>index.html</code> directamente. Las revistas que crees aquí no aparecerán al iniciar el software con <code>ABRIR_REVISTA.cmd</code>, porque el navegador guarda por separado los archivos locales y la dirección del servidor. Cierra esta ventana y usa el lanzador.</p></div>`
      + `<button type="button" class="button button--ghost">Entendido</button>`;
    warning.querySelector("button").addEventListener("click", () => warning.remove());
    document.body.prepend(warning);
  }

  const EXPECTED_PAGE_COUNT = 18;
  const MAGAZINE_SIZE_LABEL = "18 páginas";
  const ISSUE_DEFAULTS = {
    edition: "Edición N.° 1 · Mes 2026",
    responsible: "",
    closingDate: "",
    email: "",
    whatsapp: "",
    location: "Puente Alto · Chile",
    motto: "Un barrio con historia es un barrio con futuro",
    verified: false,
    verifiedAt: "",
    formato: "a5"
  };
  const DATA_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i;
  const MAX_IMAGE_CHARACTERS = 6_300_000;
  const MAX_SOURCE_IMAGE_BYTES = 20_000_000;
  const IMAGE_MAX_EDGE = 1600;
  const PRINT_TARGET_PPI = 300;
  const MAX_BACKUP_CHARACTERS = 40_000_000;
  const IMAGE_SLOTS = new Set([
    "p01.hero",
    "p03.portrait",
    "p05.progress",
    "p06.main",
    "p07.support",
    "p08.portrait",
    "p09.context",
    "p10.historic",
    "p11.memory",
    "p12.service",
    "p13.commerce",
    "p16.culture",
    "brand.logo",
    "p17.primary",
    "p17.ad1",
    "p17.ad2",
    "p18.ad",
    ...["p02", "p03", "p04", "p05", "p06", "p07", "p08", "p09", "p10", "p11", "p12", "p13", "p14", "p15", "p16"].map((id) => `${id}.ad`)
  ]);
  const WORD_BUDGET_EXCLUDED = new Set([
    "title", "subtitle", "ribbon", "kicker", "headline", "edition", "label", "contact",
    "contact1", "contact2", "contact3", "credits", "credit", "photoCredit", "signature",
    "source", "caption", "stat", "statLabel", "deadline", "tagline", "section", "page",
    "day", "month", "date", "status", "meta", "author", "teaser1", "teaser2", "nextTitle"
  ]);
  const PAGE_WORD_BUDGETS = {
    p03: { min: 250, max: 350, label: "Carta editorial: 250 a 350 palabras" },
    p04: { min: 240, max: 700, label: "Noticias breves: 3 a 5 noticias de 80 a 140 palabras" },
    p06: { min: 350, max: 450, label: "Reportaje central: 700 a 900 palabras en P06 y P07" },
    p07: { min: 350, max: 450, label: "Reportaje central: 700 a 900 palabras en P06 y P07" },
    p05: { min: 250, max: 400, label: "Información institucional: 250 a 400 palabras" },
    p08: { min: 80, max: 260, label: "Entrevista: 80 a 120 palabras de presentación más las respuestas" },
    p12: { min: 350, max: 500, label: "Comunidad y servicios: 350 a 500 palabras" },
    p13: { min: 300, max: 450, label: "Comercio local: 300 a 450 palabras" },
    p14: { min: 120, max: 720, label: "Cartas: máximo 180 palabras por carta" }
  };

  function countWords(value) {
    const text = String(value ?? "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  function countPageWords(pageElement) {
    if (!pageElement) return 0;
    return [...pageElement.querySelectorAll("[data-edit-key]")].reduce((total, node) => {
      const clave = String(node.dataset.editKey || "");
      const lastPart = clave.split(".").at(-1);
      // Los rótulos permanentes y el aviso publicitario no son cuerpo editorial:
      // sumarlos hacía que una carta escrita a su medida se marcara excedida.
      if (labelKeys.has(clave)) return total;
      if (WORD_BUDGET_EXCLUDED.has(lastPart)) return total;
      if (lastPart === "adTitle" || lastPart === "adBody") return total;
      return total + countWords(node.textContent);
    }, 0);
  }

  // Rango por elemento para las páginas cuyo número de elementos es variable.
  const RANGO_POR_ELEMENTO = {
    p04: { lista: "briefs", min: 80, max: 140 },
    p14: { lista: "letters", min: 30, max: 180 },
    p15: { lista: "agenda", min: 12, max: 45 }
  };

  function factorSuperficie() {
    return FORMATOS[formatoActual()]?.superficie || 1;
  }

  function wordBudgetState(pageId, pageElement) {
    const budget = PAGE_WORD_BUDGETS[pageId];
    if (!budget) return null;
    const factor = factorSuperficie();
    const porElemento = RANGO_POR_ELEMENTO[pageId];
    if (porElemento) {
      const page = pages.find((entry) => entry.id === pageId);
      const defaults = page?.lists?.[porElemento.lista] || [];
      const total = listCount(page, porElemento.lista, defaults);
      const words = countPageWords(pageElement);
      const min = Math.round(total * porElemento.min * factor);
      const max = Math.round(total * porElemento.max * factor);
      return {
        min,
        max,
        label: `${total} ${total === 1 ? "elemento" : "elementos"} · entre ${porElemento.min} y ${porElemento.max} palabras cada uno`,
        words,
        status: words < min ? "short" : words > max ? "long" : "ok"
      };
    }
    const words = countPageWords(pageElement);
    const min = Math.round(budget.min * factor);
    const max = Math.round(budget.max * factor);
    const status = words < min ? "short" : words > max ? "long" : "ok";
    return { ...budget, min, max, words, status };
  }

  function updateWordBudget() {
    if (!els.wordBudget) return;
    const page = pages[state.current];
    const pageElement = page ? els.host.querySelector(`[data-page-id="${page.id}"]`) : null;
    const budget = pageElement ? wordBudgetState(page.id, pageElement) : null;
    if (!state.editing || !budget) {
      els.wordBudget.hidden = true;
      return;
    }
    els.wordBudget.hidden = false;
    els.wordBudget.dataset.status = budget.status;
    els.wordBudget.textContent = `${budget.words} palabras · objetivo ${budget.min}–${budget.max}`;
    els.wordBudget.title = budget.label;
  }

  // El justificado sólo se ve bien si el navegador puede partir palabras. Chrome
  // necesita el diccionario del idioma y no siempre lo tiene; si falta, el texto
  // justificado abre ríos de espacio en columnas estrechas. Se comprueba una vez.
  function hyphenationAvailable() {
    try {
      const probe = document.createElement("div");
      probe.lang = "es";
      probe.textContent = "responsabilidad";
      probe.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;font:12px serif;";
      document.body.appendChild(probe);
      const anchoSinPartir = probe.scrollWidth;
      probe.style.hyphens = "auto";
      probe.style.webkitHyphens = "auto";
      const anchoPartido = probe.scrollWidth;
      probe.remove();
      return anchoPartido < anchoSinPartir;
    } catch {
      return false;
    }
  }

  document.documentElement.classList.toggle("sin-particion", !hyphenationAvailable());


  // ---------------------------------------------------------------------------
  // Formato de página
  //
  // El tamaño estaba clavado en 148 x 210 mm en el CSS, en la regla @page y en
  // la salida de imprenta. Ahora es un dato de la edición: la retícula, los
  // márgenes, la línea base y el cuerpo de lectura se derivan de él.
  // ---------------------------------------------------------------------------

  const FORMATOS = {
    a5: {
      etiqueta: "A5 · 148 × 210 mm",
      descripcion: "Revista de bolsillo. Es el formato con el que nació esta publicación.",
      ancho: 148, alto: 210,
      cabeza: 13.5, pie: 16.5, interior: 13, exterior: 10,
      medianil: 4, base: 4.5, cuerpo: 9,
      texto: 82, apoyo: 39, medida: 82, medidaCorta: 60, superficie: 1
    },
    a4: {
      etiqueta: "A4 · 210 × 297 mm",
      descripcion: "El doble de superficie. Cabe más texto y la fotografía respira.",
      ancho: 210, alto: 297,
      cabeza: 16, pie: 20, interior: 16, exterior: 13,
      medianil: 5, base: 5, cuerpo: 10,
      texto: 98, apoyo: 78, medida: 98, medidaCorta: 86, superficie: 2.1
    },
    tabloide: {
      etiqueta: "Tabloide · 280 × 400 mm",
      descripcion: "Formato de diario. Titulares grandes y varias noticias por página.",
      ancho: 280, alto: 400,
      cabeza: 18, pie: 22, interior: 18, exterior: 15,
      medianil: 5, base: 5.5, cuerpo: 10.5,
      texto: 165, apoyo: 77, medida: 78, medidaCorta: 78, superficie: 3.9
    }
  };

  function formatoActual() {
    const guardado = issueSettings().formato;
    return FORMATOS[guardado] ? guardado : "a5";
  }

  function aplicarFormato() {
    const clave = formatoActual();
    const f = FORMATOS[clave];
    const raiz = document.documentElement.style;
    raiz.setProperty("--formato-ancho", `${f.ancho}mm`);
    raiz.setProperty("--formato-alto", `${f.alto}mm`);
    raiz.setProperty("--margen-cabeza", `${f.cabeza}mm`);
    raiz.setProperty("--margen-pie", `${f.pie}mm`);
    raiz.setProperty("--margen-int", `${f.interior}mm`);
    raiz.setProperty("--margen-ext", `${f.exterior}mm`);
    raiz.setProperty("--medianil", `${f.medianil}mm`);
    raiz.setProperty("--linea-base", `${f.base}mm`);
    raiz.setProperty("--cuerpo-texto", `${f.cuerpo}pt`);
    raiz.setProperty("--ancho-texto", `${f.texto}mm`);
    raiz.setProperty("--ancho-apoyo", `${f.apoyo}mm`);
    raiz.setProperty("--medida-texto", `${f.medida}mm`);
    raiz.setProperty("--medida-corta", `${f.medidaCorta}mm`);
    document.body.dataset.formato = clave;
    applyPageRule(state.pressOutput === true ? "press" : "office");
  }

  async function cambiarFormato(clave) {
    if (!FORMATOS[clave] || clave === formatoActual()) return;
    try {
      const ajustes = { ...issueSettings(), formato: clave };
      await projectStorage.putMany(new Map([[storageKey("settings", "issue"), JSON.stringify(ajustes)]]));
    } catch (error) {
      showToast(error?.message || "No se pudo cambiar el formato.");
      return;
    }
    aplicarFormato();
    invalidatePreflight();
    renderTree();
    renderMagazine();
    const f = FORMATOS[clave];
    showToast(`Formato ${f.etiqueta}. Revisa las páginas: el contenido se recompone y puede sobrar o faltar texto.`);
  }

  const TRIM_LABEL = "148 × 210 mm";
  function etiquetaCorte() {
    const f = FORMATOS[formatoActual()];
    return `${f.ancho} × ${f.alto} mm`;
  }
  const PRESS_BLEED_LABEL = "3 mm";
  // La hoja de imprenta lleva la página centrada con sangrado y marcas: necesita
  // margen alrededor, así que crece 62 x 87 mm respecto del corte.
  function reglaPagina(modo) {
    const f = FORMATOS[formatoActual()];
    if (modo === "press") return `@page { size: ${f.ancho + 62}mm ${f.alto + 87}mm; margin: 0; }`;
    return `@page { size: ${f.ancho}mm ${f.alto}mm; margin: 0; }`;
  }

  // El tamaño de hoja no se puede elegir con una clase: @page es una regla de
  // documento. Se inyecta la que corresponde justo antes de imprimir.
  function applyPageRule(nombre) {
    let hoja = document.getElementById("pageSizeRule");
    if (!hoja) {
      hoja = document.createElement("style");
      hoja.id = "pageSizeRule";
      document.head.appendChild(hoja);
    }
    hoja.textContent = reglaPagina(nombre);
  }

  const FRAME_WAIT_TIMEOUT = 400;
  const FONT_WAIT_TIMEOUT = 3_000;

  // Si la pestaña está en segundo plano, el navegador puede no resolver nunca la
  // carga de fuentes ni disparar el dibujo. Estas esperas siempre terminan.
  function withTimeout(promise, milliseconds) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => window.setTimeout(resolve, milliseconds))
    ]);
  }

  async function waitForFonts() {
    try {
      if (document.fonts?.ready) await withTimeout(document.fonts.ready, FONT_WAIT_TIMEOUT);
    } catch {
      // La composición continúa con las tipografías alternativas locales.
    }
  }

  function afterNextFrames() {
    return new Promise((resolve) => {
      let listo = false;
      const terminar = () => {
        if (listo) return;
        listo = true;
        resolve();
      };
      window.setTimeout(terminar, FRAME_WAIT_TIMEOUT);
      requestAnimationFrame(() => requestAnimationFrame(terminar));
    });
  }

  const LIST_SPECS = {
    "p04.briefs":     { parts: 3, min: 2, max: 6, uno: "noticia",    varias: "noticias" },
    "p05.milestones": { parts: 4, min: 2, max: 6, uno: "avance",     varias: "avances" },
    "p14.letters":    { parts: 3, min: 1, max: 5, uno: "carta",      varias: "cartas" },
    "p15.agenda":     { parts: 4, min: 1, max: 6, uno: "actividad",  varias: "actividades" },
    "p16.registros":  { parts: 5, min: 3, max: 9,  uno: "registro",   varias: "registros" },
    "p16.lineas":     { parts: 2, min: 2, max: 3,  uno: "línea",      varias: "líneas de trabajo" }
  };

  function listCountKey(pageId, listName) {
    return `${pageId}.${listName}.count`;
  }

  function listCount(page, listName, defaults) {
    const spec = LIST_SPECS[`${page.id}.${listName}`];
    const stored = Number(projectStorage.getItem(storageKey("text", listCountKey(page.id, listName))));
    const base = Number.isInteger(stored) && stored > 0 ? stored : (defaults?.length || 0);
    if (!spec) return base;
    return Math.min(spec.max, Math.max(spec.min, base));
  }

  function listControls(page, listName, total) {
    const spec = LIST_SPECS[`${page.id}.${listName}`];
    if (!state.editing || !spec) return "";
    const clave = `${page.id}.${listName}`;
    return `<div class="list-controls app-chrome">
      <span>${total} ${total === 1 ? spec.uno : spec.varias}</span>
      <button type="button" data-list-remove="${clave}"${total <= spec.min ? " disabled" : ""} aria-label="Quitar ${escapeHtml(spec.uno)}">−</button>
      <button type="button" data-list-add="${clave}"${total >= spec.max ? " disabled" : ""} aria-label="Agregar ${escapeHtml(spec.uno)}">+</button>
    </div>`;
  }

  // renderMagazine reemplaza el contenido entero, así que el botón recién
  // pulsado deja de existir y el foco cae al documento: para agregar tres
  // noticias había que tabular desde el principio tres veces.
  function recuperarFoco(selector) {
    // Síncrono a propósito: el contenido ya está reconstruido cuando se llama, y
    // esperar al siguiente cuadro deja el foco perdido si la ventana está en
    // segundo plano, que es justo cuando el navegador no dibuja.
    els.host.querySelector(selector)?.focus({ preventScroll: true });
  }

  function changeListCount(listKey, delta) {
    const spec = LIST_SPECS[listKey];
    if (!spec) return;
    const [pageId, listName] = String(listKey).split(".");
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    const defaults = page.lists?.[listName] || [];
    const actual = listCount(page, listName, defaults);
    const siguiente = Math.min(spec.max, Math.max(spec.min, actual + delta));
    if (siguiente === actual) return;
    try {
      projectStorage.setItem(storageKey("text", listCountKey(pageId, listName)), String(siguiente));
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      showToast("No se pudo guardar el cambio. Respalda la edición antes de continuar.");
      return;
    }
    markPageDirty(pageId);
    renderTree();
    renderMagazine();
    recuperarFoco(`[data-list-${delta > 0 ? "add" : "remove"}="${listKey}"]`);
    showToast(delta > 0
      ? `Se agregó ${spec.uno}. Quedan ${siguiente} en la página ${page.number}.`
      : `Se quitó ${spec.uno}. Su texto se conserva por si vuelves a agregarla.`);
  }

  const LOGO_FILE = "./assets/brand/logo-casco-historico.webp";
  const LOGO_KEY = "brand.logo";

  function brandLogoSource() {
    const guardado = projectStorage.getItem(storageKey("image", LOGO_KEY));
    return isValidImageData(guardado) ? guardado : LOGO_FILE;
  }

  function refreshBrandLogo() {
    const origen = brandLogoSource();
    const propio = origen !== LOGO_FILE;
    document.querySelectorAll("[data-brand-logo]").forEach((image) => { image.src = origen; });
    const vista = document.getElementById("identityLogoPreview");
    if (vista) vista.src = origen;
    const restaurar = document.getElementById("restoreLogoButton");
    if (restaurar) restaurar.hidden = !propio;
  }

  const SECTION_TONES = {
    "01_portada": "gold",
    "02_sumario_creditos": "gold",
    "03_carta_editorial": "gold",
    "04_noticias_breves": "ceramic",
    "05_reportaje_central": "ceramic",
    "06_entrevista": "palm",
    "07_memoria_patrimonio": "wood",
    "08_comunidad_servicios": "palm",
    "09_comercio_local": "wood",
    "10_cartas_director": "palm",
    "11_agenda_datos": "ceramic",
    "12_cultura_participacion": "palm",
    "13_cierre_publicidad": "wood",
    "14_contraportada": "gold"
  };
  const MASTHEAD_DEFAULTS = {
    title: "Casco Histórico",
    tagline: "Patrimonio · Comunidad · Historia · Comercio local"
  };
  const MODEL_TEXT_SAMPLE = 3;
  const modelDefaults = new Map();

  function normalizeComparableText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
  }

  function rememberModelDefault(editKey, fallback) {
    const normalized = normalizeComparableText(fallback);
    if (normalized) modelDefaults.set(editKey, normalized);
    else modelDefaults.delete(editKey);
  }

  const labelKeys = new Set();

  function isModelText(editKey, value) {
    if (labelKeys.has(editKey)) return false;
    const model = modelDefaults.get(editKey);
    if (!model) return false;
    return normalizeComparableText(value) === model;
  }


  // ---------------------------------------------------------------------------
  // Formato por elemento
  //
  // Cada texto y cada fotografía pueden llevar ajustes propios: tipografía,
  // cuerpo, color, alineación, interlineado; encuadre, altura y tratamiento.
  // Se guardan como un registro aparte de su contenido, de modo que cambiar el
  // texto no borra su formato ni al revés.
  // ---------------------------------------------------------------------------

  const ESTILO_SUFIJO = "__estilo";
  const MARCO_SUFIJO = "__marco";

  const TIPOGRAFIAS = {
    titulo: { etiqueta: "Título", valor: "var(--font-title)" },
    subtitulo: { etiqueta: "Subtítulo", valor: "var(--font-subtitle)" },
    texto: { etiqueta: "Texto", valor: "var(--font-body)" },
    serif: { etiqueta: "Serif de lectura", valor: "var(--font-serif)" },
    condensada: { etiqueta: "Condensada", valor: "var(--font-condensed)" }
  };

  const COLORES_IDENTIDAD = [
    { etiqueta: "Tinta", valor: "#1d140d" },
    { etiqueta: "Chocolate", valor: "#391e14" },
    { etiqueta: "Madera", valor: "#57381d" },
    { etiqueta: "Dorado", valor: "#79501d" },
    { etiqueta: "Palmera", valor: "#365448" },
    { etiqueta: "Cerámica", valor: "#2f6e92" },
    { etiqueta: "Ladrillo", valor: "#8a3025" }
  ];

  const ALINEACIONES = [
    { etiqueta: "Izquierda", valor: "left" },
    { etiqueta: "Centro", valor: "center" },
    { etiqueta: "Derecha", valor: "right" },
    { etiqueta: "Justificado", valor: "justify" }
  ];

  const TRATAMIENTOS = [
    { etiqueta: "Color", valor: "color" },
    { etiqueta: "Blanco y negro", valor: "bn" },
    { etiqueta: "Sepia", valor: "sepia" }
  ];

  const CUERPO_MIN = 5;
  const CUERPO_MAX = 48;
  const ALTURA_MIN = 18;
  const ALTURA_MAX = 190;

  function leerRegistro(pageId, key, sufijo) {
    try {
      const crudo = projectStorage.getItem(storageKey("text", `${pageId}.${key}.${sufijo}`));
      if (!crudo) return null;
      const dato = JSON.parse(crudo);
      return dato && typeof dato === "object" && !Array.isArray(dato) ? dato : null;
    } catch {
      return null;
    }
  }

  function guardarRegistro(pageId, key, sufijo, dato) {
    const clave = storageKey("text", `${pageId}.${key}.${sufijo}`);
    const limpio = dato && Object.keys(dato).length ? dato : null;
    if (!limpio) projectStorage.removeItem(clave);
    else projectStorage.setItem(clave, JSON.stringify(limpio));
  }

  function estiloTexto(pageId, key) {
    return leerRegistro(pageId, key, ESTILO_SUFIJO);
  }

  function marcoImagen(pageId, slot) {
    return leerRegistro(pageId, slot, MARCO_SUFIJO);
  }

  function declaracionesTexto(estilo) {
    if (!estilo) return "";
    const partes = [];
    if (TIPOGRAFIAS[estilo.familia]) partes.push(`font-family:${TIPOGRAFIAS[estilo.familia].valor}`);
    if (Number.isFinite(estilo.cuerpo)) partes.push(`font-size:${estilo.cuerpo}pt`);
    if (Number.isFinite(estilo.interlineado)) partes.push(`line-height:${estilo.interlineado}`);
    if (typeof estilo.color === "string" && /^#[0-9a-f]{6}$/i.test(estilo.color)) partes.push(`color:${estilo.color}`);
    if (ALINEACIONES.some((a) => a.valor === estilo.alineacion)) partes.push(`text-align:${estilo.alineacion}`);
    if (estilo.negrita === true) partes.push("font-weight:700");
    if (estilo.cursiva === true) partes.push("font-style:italic");
    if (estilo.subrayado === true) partes.push("text-decoration:underline");
    return partes.join(";");
  }

  function declaracionesMarco(marco) {
    if (!marco) return "";
    const partes = [];
    if (Number.isFinite(marco.altura)) partes.push(`min-height:${marco.altura}mm`);
    return partes.join(";");
  }

  function claseTratamiento(marco) {
    if (marco?.tratamiento === "bn") return " trata-bn";
    if (marco?.tratamiento === "sepia") return " trata-sepia";
    return "";
  }


  // ---------------------------------------------------------------------------
  // Rótulo comercial
  //
  // Era un campo de texto libre que además quedaba fuera del control de texto de
  // muestra: cualquiera podía reescribirlo o dejarlo en blanco y la revisión
  // final no decía nada. Es lo único que separa una revista de un volante, así
  // que pasa a ser un valor de una lista cerrada.
  // ---------------------------------------------------------------------------

  const ROTULOS_COMERCIALES = ["Publicidad", "Contenido patrocinado", "Espacio cedido"];
  const DESCARGO_CARTAS = "Publicamos cartas con nombre y sector verificados. No publicamos cartas anónimas, insultos, amenazas, acusaciones sin respaldo ni datos personales de terceros. Podemos abreviar por espacio sin alterar el sentido, y avisamos antes de hacerlo. Si una carta alude a una persona u organización, le ofrecemos responder en la misma edición o en la siguiente. Las opiniones son de sus autores.";

  function rotuloComercial(pageId, slot) {
    const guardado = projectStorage.getItem(storageKey("text", `${pageId}.${slot}.rotulo`));
    return ROTULOS_COMERCIALES.includes(guardado) ? guardado : ROTULOS_COMERCIALES[0];
  }

  function marcaComercial(page, slot) {
    const valor = rotuloComercial(page.id, slot);
    if (!state.editing) return `<span class="ad-label">${escapeHtml(valor)}</span>`;
    const siguiente = ROTULOS_COMERCIALES[(ROTULOS_COMERCIALES.indexOf(valor) + 1) % ROTULOS_COMERCIALES.length];
    return `<button type="button" class="ad-label ad-label--editable app-chrome" data-ad-rotulo="${page.id}.${slot}" title="Pulsa para cambiar a “${escapeHtml(siguiente)}”">${escapeHtml(valor)}</button>`;
  }

  function cambiarRotuloComercial(clave) {
    const punto = String(clave).indexOf(".");
    const pageId = String(clave).slice(0, punto);
    const slot = String(clave).slice(punto + 1);
    const actual = rotuloComercial(pageId, slot);
    const siguiente = ROTULOS_COMERCIALES[(ROTULOS_COMERCIALES.indexOf(actual) + 1) % ROTULOS_COMERCIALES.length];
    try {
      projectStorage.setItem(storageKey("text", `${pageId}.${slot}.rotulo`), siguiente);
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      return;
    }
    markPageDirty(pageId);
    renderMagazine();
    showToast(`Este espacio se identifica ahora como “${siguiente}”.`);
  }

  const UNDO_LIMIT = 60;
  const undoStack = [];
  const editSnapshots = new WeakMap();

  function normalizeEditedText(value) {
    return String(value ?? "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function insertPlainText(raw) {
    const text = String(raw ?? "").replace(/\r\n?/g, "\n");
    if (!text) return;
    document.execCommand("insertText", false, text);
  }

  function syncUndoButton() {
    if (!els.undo) return;
    const available = state.editing && undoStack.length > 0;
    els.undo.hidden = !state.editing;
    els.undo.disabled = !available;
    els.undo.title = available
      ? `Deshacer el último cambio de texto (${undoStack.length} disponibles)`
      : "No hay cambios de texto que deshacer.";
  }

  function pushUndo(editKey, before, after) {
    if (!editKey || before === after) return;
    undoStack.push({ key: editKey, before, after });
    while (undoStack.length > UNDO_LIMIT) undoStack.shift();
    syncUndoButton();
  }

  function undoLastEdit() {
    const entry = undoStack.pop();
    syncUndoButton();
    if (!entry) {
      showToast("No hay cambios de texto que deshacer.");
      return;
    }
    try {
      projectStorage.setItem(storageKey("text", entry.key), entry.before);
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      showToast("No se pudo deshacer el cambio. Descarga un respaldo antes de continuar.");
      return;
    }
    const pageId = String(entry.key).split(".")[0];
    markPageDirty(pageId);
    renderTree();
    renderMagazine();
    const page = pages.find((item) => item.id === pageId);
    showToast(`Se deshizo el cambio en ${humanFieldLabel(entry.key)}${page ? ` de la página ${page.number}` : ""}.`);
  }

  const SEVERITY_ORDER = { review: 1, warning: 2, critical: 3 };
  const segments = (window.MAGAZINE_SEGMENTS || [])
    .slice()
    .sort((a, b) => Math.min(...a.pages.map((page) => page.number)) - Math.min(...b.pages.map((page) => page.number)));
  const pages = segments
    .flatMap((segment) => {
      const firstNumber = Math.min(...segment.pages.map((page) => page.number));
      return segment.pages.map((page) => ({
        ...page,
        segmentId: segment.id,
        segmentTitle: segment.title,
        segmentPurpose: segment.purpose,
        isOpener: page.number === firstNumber,
        tone: SECTION_TONES[segment.id] || "gold"
      }));
    })
    .sort((a, b) => a.number - b.number);

  const printPreview = new URLSearchParams(window.location.search).get("print") === "1";
  const compactQuery = window.matchMedia("(max-width: 760px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    view: printPreview ? "all" : compactQuery.matches ? "single" : "spread",
    current: compactQuery.matches ? 0 : 1,
    zoom: compactQuery.matches ? 56 : 78,
    safe: false,
    editing: false,
    activeImageKey: null,
    pendingImage: null,
    restoreViewAfterPrint: null,
    originalTitle: document.title,
    printMode: "review",
    pressOutput: false,
    formatTarget: null,
    preflightByPage: new Map(),
    lastPreflight: null,
    renamingProjectId: null
  };

  const els = {
    host: document.getElementById("pageHost"),
    tree: document.getElementById("segmentTree"),
    zoom: document.getElementById("zoomRange"),
    zoomValue: document.getElementById("zoomValue"),
    sidebarZoom: document.getElementById("sidebarZoomRange"),
    sidebarZoomValue: document.getElementById("sidebarZoomValue"),
    safe: document.getElementById("safeToggle"),
    edit: document.getElementById("editButton"),
    undo: document.getElementById("undoButton"),
    assistant: document.getElementById("assistantPanel"),
    format: document.getElementById("formatPanel"),
    formatButton: document.getElementById("formatButton"),
    formatContext: document.getElementById("formatContext"),
    formatBody: document.getElementById("formatBody"),
    assistantButton: document.getElementById("assistantButton"),
    assistantContext: document.getElementById("assistantContext"),
    assistantState: document.getElementById("assistantState"),
    assistantCaution: document.getElementById("assistantCaution"),
    assistantResult: document.getElementById("assistantResult"),
    assistantOutput: document.getElementById("assistantOutput"),
    assistantUsage: document.getElementById("assistantUsage"),
    prev: document.getElementById("prevButton"),
    next: document.getElementById("nextButton"),
    navComplete: document.getElementById("pageCompleteButton"),
    position: document.getElementById("pagePosition"),
    wordBudget: document.getElementById("wordBudget"),
    message: document.getElementById("workspaceMessage"),
    autosave: document.getElementById("autosaveStatus"),
    progressBar: document.getElementById("progressBar"),
    progressCount: document.getElementById("progressCount"),
    progressLabel: document.getElementById("progressLabel"),
    editionLabel: document.getElementById("editionLabel"),
    identity: document.getElementById("identityDialog"),
    settings: document.getElementById("settingsDialog"),
    settingsForm: document.getElementById("settingsForm"),
    imageMeta: document.getElementById("imageMetaDialog"),
    imageMetaForm: document.getElementById("imageMetaForm"),
    preflight: document.getElementById("preflightDialog"),
    preflightSummary: document.getElementById("preflightSummary"),
    preflightResults: document.getElementById("preflightResults"),
    print: document.getElementById("printDialog"),
    printModeNotice: document.getElementById("printModeNotice"),
    importFile: document.getElementById("importFile"),
    imageFile: document.getElementById("imageFile"),
    toast: document.getElementById("toast"),
    sidebar: document.getElementById("sidebar"),
    sidebarScrim: document.getElementById("sidebarScrim"),
    menuButton: document.getElementById("menuButton"),
    workspace: document.getElementById("workspace"),
    topbarActions: document.querySelector(".topbar__actions"),
    projectHome: document.getElementById("projectHome"),
    projectHomeMain: document.getElementById("projectHomeMain"),
    projectHomeList: document.getElementById("projectHomeList"),
    projectTrashPanel: document.getElementById("projectTrashPanel"),
    projectTrashList: document.getElementById("projectTrashList"),
    studioShell: document.getElementById("studioShell"),
    currentProjectName: document.getElementById("currentProjectName"),
    newProject: document.getElementById("newProjectDialog"),
    newProjectForm: document.getElementById("newProjectForm"),
    renameProject: document.getElementById("renameProjectDialog"),
    renameProjectForm: document.getElementById("renameProjectForm"),
    newProjectButton: document.getElementById("newProjectButton"),
    importProjectButton: document.getElementById("importProjectButton"),
    openTrashButton: document.getElementById("openTrashButton"),
    backToProjectsButton: document.getElementById("backToProjectsButton")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function storageKey(kind, key) {
    return `${kind}:${key}`;
  }

  // Un fallo de guardado no puede avisarse con un mensaje que se va solo: la
  // persona sigue escribiendo media hora sobre texto que no se conserva. Se
  // muestra una franja fija que no se cierra hasta que un guardado tenga éxito.
  function mostrarFalloDeGuardado(detalle) {
    const franja = document.getElementById("saveAlert");
    if (!franja) return;
    const texto = document.getElementById("saveAlertDetail");
    if (texto && detalle) texto.textContent = detalle;
    franja.hidden = false;
    document.body.classList.add("has-save-alert");
  }

  function ocultarFalloDeGuardado() {
    const franja = document.getElementById("saveAlert");
    if (!franja || franja.hidden) return;
    franja.hidden = true;
    document.body.classList.remove("has-save-alert");
  }

  function setAutosaveStatus(message, error = false) {
    els.autosave.textContent = message;
    els.autosave.classList.toggle("is-error", error);
    els.autosave.setAttribute("aria-live", error ? "assertive" : "polite");
    // La franja no se retira porque llegue un "Guardado" de otra escritura que
    // sí funcionó: eso la hacía desaparecer sola a los pocos cientos de
    // milisegundos y devolvía el problema al terreno del aviso fugaz. Se retira
    // únicamente cuando el reintento explícito termina bien.
    if (error) mostrarFalloDeGuardado();
  }

  function savedNowLabel() {
    return `Guardado ${new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
  }

  function issueSettings() {
    try {
      const saved = JSON.parse(projectStorage.getItem(storageKey("settings", "issue")) || "{}");
      return {
        ...ISSUE_DEFAULTS,
        edition: projectStorage.active()?.edition || ISSUE_DEFAULTS.edition,
        ...saved,
        verified: saved?.verified === true,
        verifiedAt: typeof saved?.verifiedAt === "string" ? saved.verifiedAt : ""
      };
    } catch {
      return { ...ISSUE_DEFAULTS };
    }
  }

  function localizedDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  function setTextOverride(updates, pageId, fieldKey, value) {
    const key = storageKey("text", `${pageId}.${fieldKey}`);
    const normalized = String(value || "").trim();
    updates.set(key, normalized || null);
  }

  // Los datos de la edición se copian a varias páginas. Antes se escribían sin
  // condición, así que un texto que alguien había redactado a mano en la
  // contraportada volvía al modelo por cambiar una fecha en el formulario, y un
  // campo vacío del formulario lo borraba. Ahora se recuerda lo que se aplicó la
  // vez anterior: si el texto actual coincide, se actualiza; si no, se respeta y
  // se informa.
  const APLICADO_SUFIJO = "__aplicado";

  function valorAplicado(pageId, key) {
    return projectStorage.getItem(storageKey("text", `${pageId}.${key}.${APLICADO_SUFIJO}`));
  }

  function puedeSobrescribir(pageId, key, modelo) {
    const actual = savedText(pageId, key, modelo ?? "");
    const anterior = valorAplicado(pageId, key);
    if (anterior === null) {
      // Nunca se aplicó: sólo se escribe si el campo sigue con el texto del modelo.
      return normalizeComparableText(actual) === normalizeComparableText(modelo ?? "");
    }
    return normalizeComparableText(actual) === normalizeComparableText(anterior);
  }

  function textoDeModelo(pageId, key) {
    const page = pages.find((entry) => entry.id === pageId);
    return page?.fields?.[key] ?? "";
  }

  async function applyIssueSettings(settings) {
    const normalized = {
      ...ISSUE_DEFAULTS,
      ...settings,
      verified: settings.verified === true,
      verifiedAt: settings.verified === true ? new Date().toISOString() : ""
    };
    const updates = new Map([[storageKey("settings", "issue"), JSON.stringify(normalized)]]);
    const respetados = [];

    // Escribe el valor sólo si nadie lo cambió a mano desde la última vez.
    function aplicarDato(pageId, key, valor) {
      if (!puedeSobrescribir(pageId, key, textoDeModelo(pageId, key))) {
        respetados.push(`P${pageId.slice(1)} · ${humanFieldLabel(key)}`);
        return false;
      }
      setTextOverride(updates, pageId, key, valor);
      updates.set(storageKey("text", `${pageId}.${key}.${APLICADO_SUFIJO}`), String(valor || ""));
      return true;
    }

    const contact = [normalized.email, normalized.whatsapp].filter(Boolean).join(" · ");
    const closing = localizedDate(normalized.closingDate);
    const tocadas = new Set();
    if (aplicarDato("p01", "edition", normalized.edition)) tocadas.add("p01");
    const indexPage = pages.find((page) => page.id === "p02");
    const currentCredits = savedText("p02", "credits", indexPage?.fields?.credits || "");
    const creditLines = currentCredits.split(/\r?\n/);
    const responsibleLine = `Dirección editorial: ${normalized.responsible || "[nombre]"}`;
    const responsibleIndex = creditLines.findIndex((line) => /^Direcci[oó]n editorial\s*:/i.test(line));
    if (responsibleIndex >= 0) creditLines[responsibleIndex] = responsibleLine;
    else creditLines.unshift(responsibleLine);
    if (aplicarDato("p02", "credits", creditLines.join(String.fromCharCode(10)))) tocadas.add("p02");
    if (aplicarDato("p02", "contact", contact ? `Contacto editorial: ${contact}` : "")) tocadas.add("p02");
    if (aplicarDato("p03", "signature", normalized.responsible)) tocadas.add("p03");
    if (aplicarDato("p16", "deadline", closing || contact ? `Recepción de aportes: ${[closing, contact].filter(Boolean).join(" · ")}` : "")) tocadas.add("p16");
    if (aplicarDato("p17", "contact", contact || closing ? `Reserva de avisos y recepción de contenidos: ${[contact, closing].filter(Boolean).join(" · ")}` : "")) tocadas.add("p17");
    if (aplicarDato("p18", "tagline", normalized.motto)) tocadas.add("p18");
    if (aplicarDato("p18", "contact1", normalized.email)) tocadas.add("p18");
    if (aplicarDato("p18", "contact2", normalized.whatsapp)) tocadas.add("p18");
    if (aplicarDato("p18", "contact3", normalized.location)) tocadas.add("p18");
    // Sólo vuelven a pendiente las páginas que realmente cambiaron.
    tocadas.forEach((pageId) => updates.set(storageKey("done", pageId), null));
    await projectStorage.putMany(updates);
    return { respetados, tocadas: [...tocadas] };
  }

  function savedText(pageId, key, fallback) {
    return projectStorage.getItem(storageKey("text", `${pageId}.${key}`)) ?? fallback ?? "";
  }

  const FIELD_LABELS = {
    title: "título",
    subtitle: "subtítulo",
    body: "texto",
    intro: "entrada",
    deck: "bajada",
    headline: "titular",
    kicker: "antetítulo",
    ribbon: "cintillo",
    quote: "frase destacada",
    callout: "recuadro",
    caption: "pie de foto",
    credit: "crédito",
    credits: "créditos",
    photoCredit: "crédito de la fotografía",
    source: "fuentes",
    signature: "firma",
    contact: "contacto",
    edition: "edición",
    section: "sección",
    page: "página",
    detail: "detalle",
    meta: "fecha y lugar",
    author: "autor",
    day: "día",
    month: "mes",
    date: "fecha",
    status: "estado",
    label: "etiqueta",
    stat: "dato clave",
    statLabel: "descripción del dato",
    deadline: "plazo",
    tagline: "lema",
    nextTitle: "título de próximos pasos",
    nextBody: "texto de próximos pasos"
  };

  function humanFieldLabel(key) {
    const lastPart = String(key).split(".").at(-1);
    if (FIELD_LABELS[lastPart]) return FIELD_LABELS[lastPart];
    if (/^body\d+$/.test(lastPart)) return "texto";
    if (/^teaser\d+$/.test(lastPart)) return "llamado de portada";
    if (/^contact\d+$/.test(lastPart)) return "contacto";
    if (/^q\d+$/.test(lastPart)) return "pregunta";
    if (/^a\d+$/.test(lastPart)) return "respuesta";
    if (/^fact\d+$/.test(lastPart)) return "dato";
    if (/^ad\d+(Title|Body)$/.test(lastPart)) return "aviso";
    if (/^block\d+(Title|Body)$/.test(lastPart)) return "bloque informativo";
    if (/^primary(Title|Body)$/.test(lastPart)) return "aviso destacado";
    return String(lastPart).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }

  function editableValue(page, key, fallback, tag = "span", className = "") {
    rememberModelDefault(`${page.id}.${key}`, fallback);
    const value = savedText(page.id, key, fallback);
    const declaraciones = declaracionesTexto(estiloTexto(page.id, key));
    const atributoEstilo = declaraciones ? ` style="${escapeHtml(declaraciones)}"` : "";
    const editAttributes = state.editing
      ? ` tabindex="0" role="textbox" aria-multiline="true" aria-label="${escapeHtml(`${page.title}: ${humanFieldLabel(key)}`)}"`
      : "";
    return `<${tag} class="editable ${className}" data-edit-key="${escapeHtml(page.id)}.${escapeHtml(key)}"${atributoEstilo}${editAttributes}>${escapeHtml(value)}</${tag}>`;
  }

  function editableLabel(page, key, fallback, tag = "span", className = "") {
    labelKeys.add(`${page.id}.${key}`);
    return editableValue(page, key, fallback, tag, className);
  }

  function editable(page, key, tag = "span", className = "") {
    return editableValue(page, key, page.fields?.[key] ?? "", tag, className);
  }

  function editableList(page, listName, index, part, fallback, tag = "span", className = "") {
    return editableValue(page, `${listName}.${index}.${part}`, fallback, tag, className);
  }

  function splitItem(value, expected) {
    const parts = String(value ?? "").split("|");
    while (parts.length < expected) parts.push("");
    return parts;
  }

  function imageData(pageId, slot) {
    const data = projectStorage.getItem(storageKey("image", `${pageId}.${slot}`));
    return isValidImageData(data) ? data : null;
  }

  function isValidImageData(data) {
    return typeof data === "string"
      && data.length <= MAX_IMAGE_CHARACTERS
      && DATA_IMAGE_PATTERN.test(data);
  }

  function imageMetadata(imageKey) {
    try {
      const metadata = JSON.parse(projectStorage.getItem(storageKey("image-meta", imageKey)) || "null");
      return metadata && typeof metadata === "object" ? metadata : null;
    } catch {
      return null;
    }
  }

  function imageSlot(page, slot, label, className = "") {
    const data = imageData(page.id, slot);
    const imageKey = `${page.id}.${slot}`;
    const marco = marcoImagen(page.id, slot);
    const marcoCss = declaracionesMarco(marco);
    const atributoMarco = marcoCss ? ` style="${escapeHtml(marcoCss)}"` : "";
    const tratamiento = claseTratamiento(marco);
    const metadata = imageMetadata(imageKey);
    const description = String(metadata?.alt || label).trim();
    const actionLabel = data ? `Cambiar fotografía. ${description}` : label;
    if (state.editing) {
      return `<button type="button" class="image-slot ${data ? "has-image" : ""} ${className}${tratamiento}" data-image-key="${imageKey}"${atributoMarco} aria-label="${escapeHtml(actionLabel)}"><span>${escapeHtml(data ? "Cambiar foto" : label)}</span></button>`;
    }
    return `<div class="image-slot ${data ? "has-image" : ""} ${className}${tratamiento}" data-image-key="${imageKey}"${atributoMarco} role="img" aria-label="${escapeHtml(description)}"><span>${escapeHtml(label)}</span></div>`;
  }

  const FIT_CROP_LIMIT = 0.3;

  // Proporcion de la imagen que se pierde si se recorta para llenar el hueco.
  function cropLoss(imageRatio, slotRatio) {
    if (!(imageRatio > 0) || !(slotRatio > 0)) return 0;
    const mayor = Math.max(imageRatio, slotRatio);
    const menor = Math.min(imageRatio, slotRatio);
    return 1 - menor / mayor;
  }

  function slotRatioFor(imageKey) {
    const elemento = document.querySelector(`[data-image-key="${CSS.escape(imageKey)}"]`);
    if (!elemento) return 0;
    const caja = elemento.getBoundingClientRect();
    return caja.width > 0 && caja.height > 0 ? caja.width / caja.height : 0;
  }

  // Una fotografía se recorta para llenar; un logotipo o un aviso apaisado se
  // muestra entero. La diferencia se decide por cuánto se perdería al recortar.
  function suggestedFit(metadata, imageKey) {
    const proporcionImagen = metadata?.width > 0 && metadata?.height > 0 ? metadata.width / metadata.height : 0;
    const proporcionHueco = slotRatioFor(imageKey);
    const perdida = cropLoss(proporcionImagen, proporcionHueco);
    return { fit: perdida > FIT_CROP_LIMIT ? "contain" : "cover", perdida, proporcionImagen, proporcionHueco };
  }

  function imageFit(imageKey) {
    const metadata = imageMetadata(imageKey);
    return metadata?.fit === "contain" ? "contain" : "cover";
  }

  function hydrateImageSlots(root = els.host) {
    root?.querySelectorAll?.("[data-image-key]").forEach((slot) => {
      const clave = String(slot.dataset.imageKey || "");
      const [pageId, imageSlotName] = clave.split(".");
      const data = imageData(pageId, imageSlotName);
      slot.style.backgroundImage = data ? `url("${data}")` : "";
      slot.style.backgroundRepeat = data ? "no-repeat" : "";
      const marcoGuardado = marcoImagen(pageId, imageSlotName);
      slot.style.backgroundPosition = data ? (marcoGuardado?.encuadre || "center") : "";
      slot.style.backgroundSize = data ? imageFit(clave) : "";
      slot.classList.toggle("is-contained", Boolean(data) && imageFit(clave) === "contain");
    });
  }

  function cornerMarkup() {
    return `
      <i class="heritage-corner heritage-corner--tl"></i>
      <i class="heritage-corner heritage-corner--tr"></i>
      <i class="heritage-corner heritage-corner--bl"></i>
      <i class="heritage-corner heritage-corner--br"></i>
      <i class="safe-line"></i>`;
  }

  function pageFrame(page, content, extraClass = "") {
    const complete = projectStorage.getItem(storageKey("done", page.id)) === "1";
    const folio = page.number === 1 || page.number === pages.length ? "" : `<span class="page-folio">${page.number}</span>`;
    const completeButton = `<button type="button" class="page-complete-toggle app-chrome ${complete ? "is-complete" : ""}" data-page-complete="${page.id}" aria-pressed="${complete}">${complete ? "Página lista" : "Marcar como lista"}</button>`;
    const overflowBadge = `<span class="page-overflow-badge app-chrome" hidden>Texto fuera del marco</span>`;
    // En un cuadernillo la impar va a la derecha y la par a la izquierda. Con
    // márgenes simétricos el lomo se lee como un canal doble y el folio de las
    // pares cae dentro del lomo, que es el único sitio donde no sirve.
    const sideClass = page.number % 2 === 1 ? "page--recto" : "page--verso";
    const roleClass = `${page.isOpener ? "page--opener" : "page--continuation"} ${sideClass} page--tone-${page.tone || "gold"}`;
    const sheetLabel = escapeHtml(`P${String(page.number).padStart(2, "0")} · ${issueSettings().edition} · corte ${etiquetaCorte()} · sangrado ${PRESS_BLEED_LABEL}`);
    return `<div class="page-sheet" data-sheet="${sheetLabel}"><article class="mag-page ${roleClass} ${extraClass} ${state.safe ? "show-safe" : ""}" data-page-id="${page.id}">${cornerMarkup()}${completeButton}${adStripToggle(page)}${overflowBadge}${content}${adStrip(page)}${folio}</article></div>`;
  }

  // El faldón se ofrece en las páginas impares: en un cuadernillo son las de la
  // derecha, las que el lector ve al abrir, y por eso son las que se venden.
  // Quedan fuera la portada, la contraportada y la página que ya es de
  // publicidad completa.
  const AD_STRIP_EXCLUDED_SEGMENTS = new Set(["13_cierre_publicidad"]);

  // La carta editorial y el cierre del reportaje central no llevan aviso: son
  // las dos páginas donde la revista habla con su propia voz, y un faldón
  // pagado al pie de ellas confunde lo editorial con lo comercial.
  const AD_STRIP_EXCLUDED_PAGES = new Set([3, 7]);

  function pageAllowsAdStrip(page) {
    if (!page || page.number % 2 !== 1) return false;
    if (page.number === 1 || page.number === pages.length) return false;
    if (AD_STRIP_EXCLUDED_PAGES.has(page.number)) return false;
    return !AD_STRIP_EXCLUDED_SEGMENTS.has(page.segmentId);
  }

  function adStripEnabled(page) {
    return projectStorage.getItem(storageKey("text", `${page.id}.adStrip`)) === "1";
  }

  function adStripToggle() {
    return "";
  }

  function adStrip(page) {
    if (!pageAllowsAdStrip(page)) return "";

    if (!adStripEnabled(page)) {
      if (!state.editing) return "";
      return `<button type="button" class="ad-strip-placeholder app-chrome" data-ad-strip="${page.id}" aria-pressed="false">
        <span class="ad-strip-placeholder__plus" aria-hidden="true">+</span>
        <span><strong>Agregar un aviso al pie</strong><small>Con título, contacto e imagen, en la franja inferior. Disponible en las páginas impares.</small></span>
      </button>`;
    }

    const quitar = state.editing
      ? `<button type="button" class="ad-strip-remove app-chrome" data-ad-strip="${page.id}" aria-pressed="true">Quitar el aviso</button>`
      : "";
    return `<aside class="page-ad-strip">
      ${marcaComercial(page, "ad")}
      <div class="page-ad-strip__body">
        <h3>${editableValue(page, "adTitle", "Nombre del comercio o servicio")}</h3>
        <p>${editableValue(page, "adBody", "Una línea que describa el aviso, con dirección, horario y teléfono verificados.")}</p>
      </div>
      ${imageSlot(page, "ad", "Agregar imagen del aviso", "page-ad-strip__image")}
      ${quitar}
    </aside>`;
  }

  function toggleAdStrip(pageId) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    const clave = storageKey("text", `${pageId}.adStrip`);
    const activo = adStripEnabled(page);
    try {
      if (activo) projectStorage.removeItem(clave);
      else projectStorage.setItem(clave, "1");
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      showToast("No se pudo guardar el cambio.");
      return;
    }
    markPageDirty(pageId);
    renderTree();
    renderMagazine();
    recuperarFoco(`[data-ad-strip="${pageId}"]`);
    showToast(activo
      ? `El aviso al pie se quitó de la página ${page.number}. Su contenido se conserva.`
      : `Se agregó un aviso al pie de la página ${page.number}.`);
  }

  const PAGINAS_CON_FIRMA = new Set(["p04", "p06", "p10", "p12", "p13", "p16"]);

  function firma(page) {
    if (!PAGINAS_CON_FIRMA.has(page.id)) return "";
    return editableValue(page, "byline", "Por [nombre y apellido]", "p", "byline");
  }

  function runningHead(page, label) {
    return editableLabel(page, "runningHead", label || page.segmentTitle, "div", "page-running-head");
  }

  function renderCover(page) {
    const content = `
      ${imageSlot(page, "hero", "Agregar fotografía principal", "cover-hero")}
      <div class="cover-content">
        <div class="cover-masthead">
          <img src="${escapeHtml(brandLogoSource())}" alt="Logo Casco Histórico" />
          <div>
            ${editableLabel(page, "mastheadTitle", MASTHEAD_DEFAULTS.title, "h2", "preline")}
            ${editableLabel(page, "mastheadTagline", MASTHEAD_DEFAULTS.tagline, "p")}
          </div>
        </div>
        <div class="cover-edition">${editable(page, "edition")}</div>
        <div class="cover-story">
          <span class="kicker">${editable(page, "kicker")}</span>
          <h3>${editable(page, "headline")}</h3>
          <p>${editable(page, "deck")}</p>
          <div class="cover-teasers">
            <div class="cover-teaser">${editable(page, "teaser1")}</div>
            <div class="cover-teaser">${editable(page, "teaser2")}</div>
          </div>
        </div>
      </div>`;
    return pageFrame(page, content, "cover-page");
  }

  function contentsRows() {
    const lastNumber = pages.length;
    return segments
      .filter((segment) => segment.pages.some((entry) => entry.number > 2 && entry.number < lastNumber))
      .map((segment) => {
        const numbers = segment.pages.map((entry) => entry.number).sort((a, b) => a - b);
        const first = numbers[0];
        const last = numbers[numbers.length - 1];
        return {
          segmentId: segment.id,
          title: segment.title,
          marker: String(first).padStart(2, "0"),
          range: first === last ? String(first) : `${first}–${last}`
        };
      });
  }

  function renderIndex(page) {
    const rows = contentsRows().map((row) => `<div class="contents-row">
        <strong>${escapeHtml(row.marker)}</strong>
        <span>${editableValue(page, `contents.${row.segmentId}.title`, row.title)}</span>
        <em>${escapeHtml(row.range)}</em>
      </div>`).join("");
    const content = `
      ${runningHead(page)}
      <h2 class="page-title">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "intro")}</p>
      <div class="index-grid">
        <div class="contents-list">${rows}</div>
        <aside class="credits-box">
          ${editableLabel(page, "creditsLabel", "Quiénes hacemos esta revista", "h3")}
          <p class="preline">${editable(page, "credits")}</p>
          ${editableLabel(page, "participateLabel", "Participa", "h3")}
          ${editableLabel(page, "participateBody", "Envía noticias, fotografías y cartas para el próximo número.", "p")}
          <p><strong>${editable(page, "contact")}</strong></p>
        </aside>
      </div>`;
    return pageFrame(page, content);
  }

  function renderEditorial(page) {
    const content = `
      ${runningHead(page)}
      <h2 class="page-title">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      <div class="feature-grid page-fill editorial-grid">
        <div class="editorial-main">
          <div class="two-columns">
            <p class="body-copy lead-copy">${editable(page, "body1")}</p>
            <p class="body-copy">${editable(page, "body2")}</p>
            <p class="body-copy">${editable(page, "body3")}</p>
            <p class="body-copy"><strong>${editable(page, "signature")}</strong></p>
          </div>
          <div class="contact-card">${editableLabel(page, "inviteLabel", "Nuestra invitación", "h3")}${editableLabel(page, "inviteBody", "Esta revista se construye con las voces y aportes de la comunidad.", "p")}</div>
        </div>
        <aside class="feature-aside editorial-aside">
          ${imageSlot(page, "portrait", "Agregar retrato de quien firma", "portrait-slot")}
          <p class="caption">${editableValue(page, "portraitCaption", "Retrato: [nombre]. Pie de foto de quien firma la carta.")}</p>
        </aside>
      </div>`;
    return pageFrame(page, content);
  }

  function renderFeatureOpen(page) {
    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${firma(page)}
      ${imageSlot(page, "main", "Agregar fotografía principal del reportaje", "feature-image")}
      <p class="caption">${editableValue(page, "mainCaption", "Pie de la fotografía principal: qué se ve, dónde y cuándo. Crédito: [nombre].")}</p>
      <div class="feature-grid page-fill">
        <div class="two-columns">
          <p class="body-copy lead-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editable(page, "body2")}</p>
          <p class="body-copy">${editableValue(page, "body3", "Tercer párrafo del desarrollo: antecedentes comprobados, cifras con su fuente y el estado real del asunto.")}</p>
          <p class="body-copy">${editableValue(page, "body4", "Cuarto párrafo: qué falta por resolver y quién tiene que responder. Continúa en la página siguiente.")}</p>
        </div>
        <aside class="feature-aside">
          <div class="stat-card">
            <strong>${editable(page, "stat")}</strong>
            <span>${editable(page, "statLabel")}</span>
          </div>
          <div class="contact-card">
            ${editableLabel(page, "sourcesLabel", "Cómo lo comprobamos", "h3")}
            <p>${editableValue(page, "sources", "Documentos consultados, organismos a los que se preguntó y quién no respondió al cierre.")}</p>
          </div>
        </aside>
      </div>`;
    return pageFrame(page, content);
  }

  function renderFeatureClose(page) {
    const facts = ["fact1", "fact2", "fact3"].map((key) => {
      const [label, value] = splitItem(page.fields?.[key], 2);
      return `<div class="fact-row"><strong>${editableValue(page, `${key}.label`, label)}</strong><span>${editableValue(page, `${key}.value`, value)}</span></div>`;
    }).join("");
    const content = `
      ${runningHead(page, "Reportaje principal · continuación")}
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <div class="feature-grid feature-grid--close page-fill">
        <div class="feature-close__texto">
          <p class="body-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editableValue(page, "body2b", "Segundo párrafo de la continuación: consecuencias, opiniones relevantes y datos que las sostienen.")}</p>
          <h3 class="ladillo">${editableValue(page, "ladillo", "Un ladillo que ordena la lectura")}</h3>
          <p class="body-copy">${editable(page, "body2")}</p>
          <p class="body-copy">${editableValue(page, "body3", "Penúltimo párrafo: qué puede esperar la comunidad y dónde encontrar información actualizada.")}</p>
          <div class="quote-card">${editable(page, "quote")}${editableValue(page, "quoteAuthor", "[Nombre y quién es]", "span", "quote-author")}</div>
          <p class="body-copy">${editableValue(page, "body4", "Cierre: la pregunta que queda abierta y la forma concreta de participar o informarse.")}</p>
        </div>
        <aside class="feature-close__apoyo">
          ${imageSlot(page, "support", "Agregar la segunda fotografía del reportaje", "feature-close__foto")}
          <p class="caption">${editable(page, "caption")}</p>
          <div class="fact-list">${facts}</div>
        </aside>
      </div>`;
    return pageFrame(page, content);
  }

  function renderBriefs(page) {
    const defaults = page.lists?.briefs || [];
    const total = listCount(page, "briefs", defaults);
    const cards = Array.from({ length: total }, (unused, index) => {
      const [title, body, meta] = splitItem(defaults[index], 3);
      const wide = index === 4 ? "brief-card--wide" : "";
      return `<article class="brief-card ${wide}">
        <h3>${editableList(page, "briefs", index, "title", title)}</h3>
        <p>${editableList(page, "briefs", index, "body", body)}</p>
        <span class="brief-meta">${editableList(page, "briefs", index, "meta", meta)}</span>
      </article>`;
    }).join("");
    const content = `${runningHead(page)}<h2 class="page-title">${editable(page, "title")}</h2><p class="page-deck">${editable(page, "deck")}</p>${firma(page)}<div class="brief-grid page-fill">${cards}</div>${listControls(page, "briefs", total)}`;
    return pageFrame(page, content);
  }

  function renderAdvances(page) {
    const defaults = page.lists?.milestones || [];
    const total = listCount(page, "milestones", defaults);
    const milestones = Array.from({ length: total }, (unused, index) => {
      const [date, title, detail, status] = splitItem(defaults[index], 4);
      return `<article class="milestone-card">
        <div class="milestone-meta">
          <span class="milestone-date">${editableList(page, "milestones", index, "date", date)}</span>
          <span class="milestone-status">${editableList(page, "milestones", index, "status", status)}</span>
        </div>
        <h3>${editableList(page, "milestones", index, "title", title)}</h3>
        <p>${editableList(page, "milestones", index, "detail", detail)}</p>
      </article>`;
    }).join("");
    const content = `
      ${runningHead(page)}
      ${editableLabel(page, "ribbon", "Gestión y avances", "span", "section-ribbon")}
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      <div class="advances-top">
        ${imageSlot(page, "progress", "Agregar fotografía de una gestión o actividad", "advances-photo")}
        <p class="body-copy lead-copy">${editable(page, "body")}</p>
      </div>
      <div class="milestone-grid page-fill">${milestones}</div>${listControls(page, "milestones", total)}
      <div class="contact-card advances-next"><h3>${editable(page, "nextTitle")}</h3><p>${editable(page, "nextBody")}</p></div>`;
    return pageFrame(page, content);
  }

  function qa(page, qKey, aKey) {
    return `<div class="qa"><h3>${editable(page, qKey)}</h3><p>${editable(page, aKey)}</p></div>`;
  }

  function renderInterviewOpen(page) {
    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      <div class="interview-grid">
        <div>
          ${imageSlot(page, "portrait", "Agregar retrato de la persona entrevistada", "portrait-slot")}
          <p class="caption">${editableValue(page, "photoCredit", "Retrato: [nombre del fotógrafo].")}</p>
        </div>
        <div>
          <p class="body-copy lead-copy">${editable(page, "intro")}</p>
          ${qa(page, "q1", "a1")}
          ${qa(page, "q2", "a2")}
        </div>
      </div>`;
    return pageFrame(page, content);
  }

  function renderInterviewClose(page) {
    const content = `
      ${runningHead(page, "Voces del barrio · entrevista")}
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <div class="quote-card">${editable(page, "quote")}${editableValue(page, "quoteAuthor", "[Nombre y quién es]", "span", "quote-author")}</div>
      <div class="two-columns">
        ${qa(page, "q1", "a1")}
        ${qa(page, "q2", "a2")}
        ${qa(page, "q3", "a3")}
      </div>
      ${imageSlot(page, "context", "Agregar fotografía de contexto")}
      <p class="caption">${editable(page, "credit")}</p>`;
    return pageFrame(page, content);
  }

  function renderHeritage(page) {
    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${firma(page)}
      <div class="heritage-grid">
        <div>
          ${imageSlot(page, "historic", "Agregar fotografía histórica", "heritage-photo")}
          <p class="caption">${editable(page, "caption")}</p>
        </div>
        <div>
          <p class="body-copy lead-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editable(page, "body2")}</p>
          <div class="contact-card">${editableLabel(page, "sourceLabel", "Fuentes", "h3")}<p>${editable(page, "source")}</p></div>
        </div>
      </div>`;
    return pageFrame(page, content);
  }

  function renderHeritageClose(page) {
    const content = `
      ${runningHead(page, "Memoria y patrimonio · continuación")}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${imageSlot(page, "memory", "Agregar fotografía actual o detalle patrimonial", "heritage-close-photo")}
      <p class="caption">${editable(page, "caption")}</p>
      <div class="heritage-close-grid">
        <div class="two-columns">
          <p class="body-copy lead-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editable(page, "body2")}</p>
        </div>
        <aside>
          <div class="quote-card">${editable(page, "quote")}${editableValue(page, "quoteAuthor", "[Nombre y quién es]", "span", "quote-author")}</div>
          <div class="contact-card heritage-source">${editableLabel(page, "sourceLabel", "Fuentes y memoria oral", "h3")}<p>${editable(page, "source")}</p></div>
        </aside>
      </div>`;
    return pageFrame(page, content);
  }

  function renderCommunity(page) {
    const blocks = [1, 2, 3].map((index) => `<article class="contact-card"><span class="icon-chip">${index}</span><h3>${editable(page, `block${index}Title`)}</h3><p>${editable(page, `block${index}Body`)}</p></article>`).join("");
    const content = `
      ${runningHead(page)}
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${firma(page)}
      ${imageSlot(page, "service", "Agregar fotografía de la iniciativa", "feature-image")}
      <div class="community-grid page-fill">${blocks}</div>
      <div class="two-columns community-body">
        <p class="body-copy lead-copy">${editable(page, "body1")}</p>
        <p class="body-copy">${editable(page, "body2")}</p>
        <p class="body-copy">${editable(page, "body3")}</p>
      </div>
      <div class="contact-card">${editableLabel(page, "contactLabel", "Información práctica", "h3")}<p><strong>${editable(page, "contact")}</strong></p></div>`;
    return pageFrame(page, content);
  }

  function renderCommerce(page) {
    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${firma(page)}
      <div class="heritage-grid">
        <div>
          ${imageSlot(page, "commerce", "Agregar fotografía del comercio", "heritage-photo")}
          ${marcaComercial(page, "perfil")}
        </div>
        <div>
          <p class="body-copy lead-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editable(page, "body2")}</p>
          <div class="quote-card">${editable(page, "quote")}${editableValue(page, "quoteAuthor", "[Nombre y quién es]", "span", "quote-author")}</div>
          <div class="contact-card">${editableLabel(page, "contactLabel", "Visítalo", "h3")}<p>${editable(page, "contact")}</p></div>
        </div>
      </div>`;
    return pageFrame(page, content);
  }

  function renderLetters(page) {
    const defaults = page.lists?.letters || [];
    const total = listCount(page, "letters", defaults);
    const cards = Array.from({ length: total }, (unused, index) => {
      const [title, body, author] = splitItem(defaults[index], 3);
      return `<article class="letter-card"><h3>${editableList(page, "letters", index, "title", title)}</h3><p>${editableList(page, "letters", index, "body", body)}</p><span class="letter-author">${editableList(page, "letters", index, "author", author)}</span></article>`;
    }).join("");
    const content = `${runningHead(page)}<h2 class="page-title page-title--compact">${editable(page, "title")}</h2><p class="page-deck">${editable(page, "deck")}</p><div class="letter-grid page-fill">${cards}</div>${listControls(page, "letters", total)}${editableValue(page, "disclaimer", DESCARGO_CARTAS, "p", "caption")}`;
    return pageFrame(page, content);
  }

  function renderAgenda(page) {
    const defaults = page.lists?.agenda || [];
    const total = listCount(page, "agenda", defaults);
    const items = Array.from({ length: total }, (unused, index) => {
      const [day, month, title, detail] = splitItem(defaults[index], 4);
      return `<article class="agenda-item"><div class="agenda-date"><strong>${editableList(page, "agenda", index, "day", day)}</strong><span>${editableList(page, "agenda", index, "month", month)}</span></div><div class="agenda-detail"><h3>${editableList(page, "agenda", index, "title", title)}</h3><p>${editableList(page, "agenda", index, "detail", detail)}</p></div></article>`;
    }).join("");
    const content = `${runningHead(page)}<h2 class="page-title page-title--compact">${editable(page, "title")}</h2><p class="page-deck">${editable(page, "deck")}</p><div class="agenda-list page-fill">${items}</div>${listControls(page, "agenda", total)}<div class="contact-card">${editableLabel(page, "noticeLabel", "Antes de asistir", "h3")}${editableLabel(page, "noticeBody", "Verifica la información con la organización responsable. Los datos de esta página deben revisarse 48 horas antes del cierre.", "p")}</div>`;
    return pageFrame(page, content);
  }

  function renderCulture(page) {
    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editable(page, "ribbon")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${imageSlot(page, "culture", "Agregar imagen, ilustración o fotografía", "culture-hero")}
      <div class="two-columns">
        <p class="body-copy lead-copy">${editable(page, "body1")}</p>
        <p class="body-copy">${editable(page, "body2")}</p>
      </div>
      <div class="quote-card">${editable(page, "callout")}</div>
      <p class="caption"><strong>${editable(page, "deadline")}</strong></p>`;
    return pageFrame(page, content);
  }

  function renderAds(page) {
    const content = `
      ${runningHead(page)}
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      <div class="ad-grid page-fill">
        <article class="ad-card ad-card--primary">${marcaComercial(page, "primary")}${imageSlot(page, "primary", "Agregar el aviso o su logotipo", "ad-card__image")}<h3>${editable(page, "primaryTitle")}</h3><p>${editable(page, "primaryBody")}</p></article>
        <article class="ad-card">${marcaComercial(page, "ad1")}${imageSlot(page, "ad1", "Agregar el aviso o su logotipo", "ad-card__image")}<h3>${editable(page, "ad1Title")}</h3><p>${editable(page, "ad1Body")}</p></article>
        <article class="ad-card">${marcaComercial(page, "ad2")}${imageSlot(page, "ad2", "Agregar el aviso o su logotipo", "ad-card__image")}<h3>${editable(page, "ad2Title")}</h3><p>${editable(page, "ad2Body")}</p></article>
      </div>
      <div class="contact-card">${editableLabel(page, "materialLabel", "Envía tu material", "h3")}<p><strong>${editable(page, "contact")}</strong></p></div>`;
    return pageFrame(page, content);
  }

  function contraportadaComercial(page) {
    return projectStorage.getItem(storageKey("text", `${page.id}.modo`)) === "aviso";
  }

  function alternarContraportada(pageId) {
    const clave = storageKey("text", `${pageId}.modo`);
    const comercial = projectStorage.getItem(clave) === "aviso";
    try {
      if (comercial) projectStorage.removeItem(clave);
      else projectStorage.setItem(clave, "aviso");
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      return;
    }
    markPageDirty(pageId);
    renderTree();
    renderMagazine();
    showToast(comercial
      ? "La contraportada vuelve a su versión institucional."
      : "La contraportada pasa a espacio publicitario, a página completa y a sangre.");
  }

  function listaEnEspanol(partes) {
    if (partes.length <= 1) return partes[0] || "";
    return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  }

  function renderObservatorio(page) {
    const defaults = page.lists?.registros || [];
    const total = listCount(page, "registros", defaults);
    const filas = Array.from({ length: total }, (unused, index) => {
      const [anio, nombre, via, estado, monto] = splitItem(defaults[index], 5);
      return `<tr>
        <td class="dato-anio">${editableList(page, "registros", index, "anio", anio)}</td>
        <td class="dato-nombre">${editableList(page, "registros", index, "nombre", nombre)}</td>
        <td class="dato-via">${editableList(page, "registros", index, "via", via)}</td>
        <td class="dato-estado">${editableList(page, "registros", index, "estado", estado)}</td>
        <td class="dato-monto">${editableList(page, "registros", index, "monto", monto)}</td>
      </tr>`;
    }).join("");

    const modeloLineas = page.lists?.lineas || [];
    const totalLineas = listCount(page, "lineas", modeloLineas);
    const lineas = Array.from({ length: totalLineas }, (unused, index) => {
      const [titulo, detalle] = splitItem(modeloLineas[index], 2);
      return `<li>
        <strong>${editableList(page, "lineas", index, "titulo", titulo)}</strong>
        <span>${editableList(page, "lineas", index, "detalle", detalle)}</span>
      </li>`;
    }).join("");

    const content = `
      ${runningHead(page)}
      <span class="section-ribbon">${editableValue(page, "ribbon", "Observatorio de datos públicos")}</span>
      <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
      <p class="page-deck">${editable(page, "deck")}</p>
      ${firma(page)}
      <div class="observatorio">
        <div class="observatorio__texto">
          <p class="body-copy">${editable(page, "body1")}</p>
          <p class="body-copy">${editableValue(page, "body2", "Qué se va a publicar, con qué periodicidad y de dónde sale cada dato.")}</p>
        </div>
        <aside class="observatorio__cifra">
          <strong>${editableValue(page, "cifra", "243")}</strong>
          <span>${editableValue(page, "cifraPie", "proyectos ingresados al sistema ambiental en la comuna desde 1995.")}</span>
        </aside>
      </div>
      <h3 class="ladillo">${editableValue(page, "tablaTitulo", "Primera entrega")}</h3>
      <table class="tabla-datos">
        <thead>
          <tr>
            <th>${editableValue(page, "colAnio", "Año")}</th>
            <th>${editableValue(page, "colNombre", "Proyecto")}</th>
            <th>${editableValue(page, "colVia", "Vía")}</th>
            <th>${editableValue(page, "colEstado", "Estado")}</th>
            <th>${editableValue(page, "colMonto", "Inversión")}</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      ${listControls(page, "registros", total)}
      <div class="observatorio__lineas">
        ${editableLabel(page, "lineasLabel", "En qué se está trabajando", "h3")}
        <ul>${lineas}</ul>
        ${listControls(page, "lineas", totalLineas)}
      </div>
      <div class="observatorio__fuente contact-card">
        ${editableLabel(page, "fuenteLabel", "De dónde salen estos datos", "h3")}
        <p>${editableValue(page, "fuente", "Fuente, fecha de consulta y dirección donde cualquiera puede comprobarlo.")}</p>
      </div>`;
    return pageFrame(page, content);
  }

  function renderBack(page) {
    if (contraportadaComercial(page)) {
      const alternar = state.editing
        ? `<button type="button" class="back-mode-toggle app-chrome" data-back-mode="${page.id}">Volver a contraportada institucional</button>`
        : "";
      const contenido = `${imageSlot(page, "ad", "Agregar el aviso de contraportada", "back-ad__image")}
        <div class="back-ad__foot">
          ${marcaComercial(page, "ad")}
          <h2>${editableValue(page, "adTitle", "Nombre del anunciante")}</h2>
          <p>${editableValue(page, "adBody", "Dirección, horario, teléfono y redes, verificados con el anunciante.")}</p>
        </div>
        ${alternar}`;
      return pageFrame(page, contenido, "back-page back-page--ad");
    }

    const alternarModo = state.editing
      ? `<button type="button" class="back-mode-toggle app-chrome" data-back-mode="${page.id}">Usar como espacio publicitario</button>`
      : "";
    const content = `${alternarModo}<div class="back-inner"><img data-brand-logo src="${escapeHtml(brandLogoSource())}" alt="Logo Casco Histórico" /><h2>${editable(page, "title")}</h2><p>${editable(page, "tagline")}</p><div class="contact-lines"><span>${editable(page, "contact1")}</span><span>${editable(page, "contact2")}</span><span>${editable(page, "contact3")}</span></div><span class="ad-label ad-label--suelta">${editable(page, "label")}</span></div>`;
    return pageFrame(page, content, "back-page");
  }

  const renderers = {
    cover: renderCover,
    index: renderIndex,
    editorial: renderEditorial,
    "feature-open": renderFeatureOpen,
    "feature-close": renderFeatureClose,
    briefs: renderBriefs,
    advances: renderAdvances,
    "interview-open": renderInterviewOpen,
    "interview-close": renderInterviewClose,
    heritage: renderHeritage,
    "heritage-close": renderHeritageClose,
    community: renderCommunity,
    commerce: renderCommerce,
    letters: renderLetters,
    agenda: renderAgenda,
    culture: renderCulture,
    observatorio: renderObservatorio,
    ads: renderAds,
    back: renderBack
  };

  function renderPage(page) {
    const renderer = renderers[page.layout];
    return renderer ? renderer(page) : pageFrame(page, `${runningHead(page)}<h2 class="page-title">${escapeHtml(page.title)}</h2>`);
  }

  function spreadAnchors() {
    const anchors = [0];
    for (let index = 1; index < pages.length - 1; index += 2) anchors.push(index);
    if (pages.length > 1) anchors.push(pages.length - 1);
    return anchors;
  }

  function spreadAnchor(index) {
    const page = pages[index];
    if (!page || page.number === 1 || page.number === pages.length) return index;
    return page.number % 2 === 0 ? index : index - 1;
  }

  function visiblePages() {
    if (state.view === "all") return pages;
    if (state.view === "single") return [pages[state.current]];
    const anchor = spreadAnchor(state.current);
    if (anchor === 0 || anchor === pages.length - 1) return [pages[anchor]];
    return pages.slice(anchor, Math.min(anchor + 2, pages.length));
  }

  function pageIsOverflowing(pageElement) {
    if (!pageElement) return false;
    return Math.ceil(pageElement.scrollHeight) > Math.ceil(pageElement.clientHeight) + 2
      || Math.ceil(pageElement.scrollWidth) > Math.ceil(pageElement.clientWidth) + 2;
  }

  function updateOverflowBadge(pageElement) {
    if (!pageElement) return false;
    const overflowing = pageIsOverflowing(pageElement);
    const badge = pageElement.querySelector(".page-overflow-badge");
    const completeButton = pageElement.querySelector("[data-page-complete]");
    pageElement.classList.toggle("has-overflow", overflowing);
    if (badge) badge.hidden = !overflowing;
    if (completeButton) {
      completeButton.disabled = overflowing;
      completeButton.title = overflowing ? "No se puede marcar como lista: hay texto que no cabe en la página." : "";
    }
    if (state.view === "single" && pages[state.current]?.id === pageElement.dataset.pageId) {
      els.navComplete.disabled = overflowing;
      els.navComplete.title = overflowing ? "No se puede marcar como lista: hay texto que no cabe en la página." : "";
    }
    return overflowing;
  }

  function refreshVisibleOverflows() {
    els.host.querySelectorAll(".mag-page").forEach(updateOverflowBadge);
  }

  function invalidatePreflight(pageId) {
    state.lastPreflight = null;
    state.printMode = "review";
    if (!pageId) {
      state.preflightByPage.clear();
      return;
    }
    state.preflightByPage.delete(pageId);
    const pageIndex = pages.findIndex((page) => page.id === pageId);
    const status = els.tree.querySelector(`[data-page-index="${pageIndex}"] .page-status`);
    status?.classList.remove("has-critical", "has-warning", "needs-review");
  }

  function markPageDirty(pageId) {
    if (!pageId) return;
    projectStorage.removeItem(storageKey("done", pageId));
    invalidatePreflight(pageId);
    const pageIndex = pages.findIndex((page) => page.id === pageId);
    const status = els.tree.querySelector(`[data-page-index="${pageIndex}"] .page-status`);
    status?.classList.remove("is-complete");
    updateProgress();
  }

  function setSidebarOpen(open) {
    if (!compactQuery.matches) return;
    els.sidebar.classList.toggle("is-open", open);
    els.sidebar.inert = !open;
    els.workspace.inert = open;
    els.topbarActions.inert = open;
    els.sidebarScrim.hidden = !open;
    els.menuButton.setAttribute("aria-expanded", String(open));
    els.menuButton.setAttribute("aria-label", open ? "Cerrar estructura" : "Abrir estructura");
    document.body.classList.toggle("sidebar-open", open);
    if (open) requestAnimationFrame(() => els.sidebar.querySelector(".page-link")?.focus());
    else els.menuButton.focus({ preventScroll: true });
  }

  function renderMagazine() {
    const visible = visiblePages();
    const groupClass = state.view === "all" ? "page-group page-group--all" : "page-group";
    els.host.style.setProperty("--preview-zoom", String(state.zoom / 100));
    els.host.innerHTML = `<div class="${groupClass}">${visible.map(renderPage).join("")}</div>`;
    hydrateImageSlots(els.host);
    document.body.classList.toggle("edit-mode", state.editing);
    attachPageEvents();
    updateNavigation(visible);
    updateTreeCurrent();
    // El contador y el asistente sólo leen texto, así que se actualizan de
    // inmediato: si la pestaña está en segundo plano el navegador no dispara el
    // dibujo y se quedaban con la página anterior. La comprobación de desborde
    // sí necesita medir, y por eso espera al siguiente cuadro.
    updateWordBudget();
    asistenteRefrescar();
    guiaRefrescar();
    if (els.format && !els.format.hidden) {
      const objetivo = formatoObjetivo();
      if (objetivo) formatoSeleccionar(objetivo.tipo, objetivo.clave);
    }
    requestAnimationFrame(refreshVisibleOverflows);
  }

  function renderTree() {
    els.tree.innerHTML = segments.map((segment, segmentIndex) => {
      const pageLinks = segment.pages.map((page) => {
        const complete = projectStorage.getItem(storageKey("done", page.id)) === "1";
        const issues = state.preflightByPage.get(page.id) || [];
        const highestSeverity = issues.reduce((highest, issue) => SEVERITY_ORDER[issue.severity] > SEVERITY_ORDER[highest] ? issue.severity : highest, "review");
        const issueClass = issues.length ? highestSeverity === "critical" ? "has-critical" : highestSeverity === "warning" ? "has-warning" : "needs-review" : "";
        const statusText = issues.length ? `${issues.length} ${issues.length === 1 ? "observación" : "observaciones"} en la revisión final` : complete ? "marcada como lista" : "en preparación";
        return `<button type="button" class="page-link" data-page-index="${pages.findIndex((entry) => entry.id === page.id)}" aria-label="Página ${page.number}: ${escapeHtml(page.title)}; ${escapeHtml(statusText)}"><span>P${String(page.number).padStart(2, "0")}</span><span>${escapeHtml(page.title)}</span><i class="page-status ${complete ? "is-complete" : ""} ${issueClass}" aria-hidden="true"></i></button>`;
      }).join("");
      return `<details class="segment-group" open><summary><span class="segment-index">${String(segmentIndex + 1).padStart(2, "0")}</span><span class="segment-name">${escapeHtml(segment.title)}</span><span class="segment-count">${segment.pages.length} pág.</span></summary><div class="segment-pages">${pageLinks}</div></details>`;
    }).join("");
    els.tree.querySelectorAll("[data-page-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.current = Number(button.dataset.pageIndex);
        if (state.view === "all") {
          renderMagazine();
          requestAnimationFrame(() => document.querySelector(`[data-page-id="${pages[state.current].id}"]`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }));
        } else {
          renderMagazine();
        }
        if (compactQuery.matches) setSidebarOpen(false);
      });
    });
    updateTreeCurrent();
    updateProgress();
  }

  function updateTreeCurrent() {
    const visibleIds = new Set(visiblePages().map((page) => page.id));
    els.tree.querySelectorAll(".page-link").forEach((link) => {
      const page = pages[Number(link.dataset.pageIndex)];
      const visible = visibleIds.has(page.id);
      const current = Number(link.dataset.pageIndex) === state.current;
      link.classList.toggle("is-current", visible);
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function updateNavigation(visible) {
    const first = visible[0]?.number || 1;
    const last = visible[visible.length - 1]?.number || first;
    els.position.textContent = first === last ? `Página ${first} de ${pages.length}` : `Páginas ${first}–${last} de ${pages.length}`;
    const descripcionVista = state.view === "single"
      ? "Vista de página: una hoja a la vez."
      : state.view === "spread"
        ? "Doble página: se ven dos páginas juntas, como al abrir la revista."
        : "Vista completa: las 18 páginas seguidas.";
    els.message.textContent = state.editing
      ? descripcionVista
      : `${descripcionVista} Estás mirando la revista: pulsa Editar para cambiar textos y fotografías.`;
    const currentPage = pages[state.current];
    const currentComplete = projectStorage.getItem(storageKey("done", currentPage.id)) === "1";
    els.navComplete.hidden = !state.editing;
    els.navComplete.disabled = false;
    els.navComplete.classList.toggle("is-complete", currentComplete);
    els.navComplete.setAttribute("aria-pressed", String(currentComplete));
    els.navComplete.textContent = currentComplete ? `P${String(currentPage.number).padStart(2, "0")} lista` : `Marcar P${String(currentPage.number).padStart(2, "0")} como lista`;
    els.navComplete.setAttribute("aria-label", currentComplete ? `Página ${currentPage.number} lista; pulsar para reabrir` : `Marcar página ${currentPage.number} como lista`);
    if (state.view === "all") {
      els.prev.disabled = state.current <= 0;
      els.next.disabled = state.current >= pages.length - 1;
    } else if (state.view === "spread") {
      const anchors = spreadAnchors();
      const pos = anchors.indexOf(spreadAnchor(state.current));
      els.prev.disabled = pos <= 0;
      els.next.disabled = pos >= anchors.length - 1;
    } else {
      els.prev.disabled = state.current <= 0;
      els.next.disabled = state.current >= pages.length - 1;
    }
  }

  function attachPageEvents() {
    els.host.querySelectorAll("[data-edit-key]").forEach((node) => {
      node.contentEditable = state.editing ? "true" : "false";
      node.addEventListener("focusin", () => {
        editSnapshots.set(node, normalizeEditedText(node.innerText));
        if (els.format && !els.format.hidden) formatoSeleccionar("texto", node.dataset.editKey);
      });
      node.addEventListener("focusout", () => {
        const before = editSnapshots.get(node);
        editSnapshots.delete(node);
        if (before === undefined) return;
        pushUndo(node.dataset.editKey, before, normalizeEditedText(node.innerText));
      });
      node.addEventListener("paste", (event) => {
        if (node.contentEditable !== "true") return;
        event.preventDefault();
        insertPlainText(event.clipboardData?.getData("text/plain"));
      });
      node.addEventListener("drop", (event) => {
        if (node.contentEditable !== "true") return;
        event.preventDefault();
        insertPlainText(event.dataTransfer?.getData("text/plain"));
      });
      node.addEventListener("input", () => {
        const value = node.innerText.replace(/\n{3,}/g, "\n\n").trim();
        try {
          projectStorage.setItem(storageKey("text", node.dataset.editKey), value);
          setAutosaveStatus("Guardando…");
        } catch {
          setAutosaveStatus("Error al guardar", true);
          showToast("No se pudo guardar el cambio. Descarga un respaldo antes de continuar.");
        }
        const pageElement = node.closest(".mag-page");
        markPageDirty(pageElement?.dataset.pageId);
        clearTimeout(node.overflowTimer);
        node.overflowTimer = setTimeout(() => {
          updateOverflowBadge(pageElement);
          updateWordBudget();
        }, 80);
      });
    });
    els.host.querySelectorAll("[data-image-key]").forEach((node) => {
      if (!(node instanceof HTMLButtonElement)) return;
      node.addEventListener("click", () => {
        // Con el panel de formato abierto, pulsar una fotografía la selecciona
        // para ajustarla; cambiar el archivo se hace desde el propio panel.
        if (els.format && !els.format.hidden) {
          formatoSeleccionar("imagen", node.dataset.imageKey);
          return;
        }
        state.activeImageKey = node.dataset.imageKey;
        els.imageFile.click();
      });
    });
    els.host.querySelectorAll("[data-ad-rotulo]").forEach((button) => {
      button.addEventListener("click", (evento) => {
        evento.preventDefault();
        cambiarRotuloComercial(button.dataset.adRotulo);
      });
    });
    els.host.querySelectorAll("[data-back-mode]").forEach((button) => {
      button.addEventListener("click", () => alternarContraportada(button.dataset.backMode));
    });
    els.host.querySelectorAll("[data-ad-strip]").forEach((button) => {
      button.addEventListener("click", () => toggleAdStrip(button.dataset.adStrip));
    });
    els.host.querySelectorAll("[data-list-add], [data-list-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const agregar = button.dataset.listAdd;
        changeListCount(agregar || button.dataset.listRemove, agregar ? 1 : -1);
      });
    });
    els.host.querySelectorAll("[data-page-complete]").forEach((button) => {
      button.addEventListener("click", () => togglePageCompletion(button.dataset.pageComplete));
    });
  }

  function togglePageCompletion(pageId) {
    const key = storageKey("done", pageId);
    if (projectStorage.getItem(key) === "1") {
      projectStorage.removeItem(key);
    } else {
      const scoped = collectPreflightIssues({ pageIds: [pageId] });
      const blocking = scoped.filter((issue) => issue.pageId === pageId && (issue.severity === "warning" || issue.severity === "critical"));
      if (blocking.length) {
        renderPreflightReport(collectPreflightIssues());
        if (!els.preflight.open) els.preflight.showModal();
        requestAnimationFrame(() => els.preflight.querySelector(`[data-preflight-page="${pages.findIndex((page) => page.id === pageId)}"]`)?.focus());
        showToast(`Corrige ${blocking.length} ${blocking.length === 1 ? "pendiente" : "pendientes"} antes de aprobar la página.`);
        return;
      }
      projectStorage.setItem(key, "1");
    }
    invalidatePreflight(pageId);
    setAutosaveStatus("Guardando…");
    renderTree();
    renderMagazine();
  }

  function updateProgress() {
    const completed = pages.filter((page) => projectStorage.getItem(storageKey("done", page.id)) === "1").length;
    const percent = Math.round((completed / pages.length) * 100);
    els.progressBar.style.width = `${percent}%`;
    els.progressCount.textContent = `${completed}/${pages.length}`;
    els.progressLabel.textContent = completed === pages.length ? "Lista para revisión final" : completed ? "Edición en desarrollo" : "Modelo preparado";
    els.editionLabel.textContent = savedText("p01", "edition", issueSettings().edition);
    const progress = els.progressBar.parentElement;
    progress.setAttribute("aria-valuemax", String(pages.length));
    progress.setAttribute("aria-valuenow", String(completed));
    progress.setAttribute("aria-valuetext", `${completed} de ${pages.length} páginas listas`);
  }

  function syncEditButton() {
    els.edit.setAttribute("aria-pressed", String(state.editing));
    els.edit.textContent = state.editing ? "Terminar edición" : "Editar";
    syncUndoButton();
  }

  function setEditing(active, announce = true) {
    state.editing = Boolean(active);
    syncEditButton();
    renderMagazine();
    if (announce) showToast(state.editing ? "Edición activa: toca textos o fotografías." : "Edición cerrada. Los cambios quedaron guardados.");
  }

  function navigate(direction) {
    if (state.view === "spread") {
      const anchors = spreadAnchors();
      const currentAnchor = spreadAnchor(state.current);
      const pos = Math.max(0, anchors.indexOf(currentAnchor));
      state.current = anchors[Math.max(0, Math.min(anchors.length - 1, pos + direction))];
    } else {
      state.current = Math.max(0, Math.min(pages.length - 1, state.current + direction));
    }
    renderMagazine();
    if (state.view === "all") requestAnimationFrame(() => document.querySelector(`[data-page-id="${pages[state.current].id}"]`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }));
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderMagazine();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }

  function pintarOpcionesFormato() {
    const caja = document.getElementById("formatoOpciones");
    if (!caja) return;
    const actual = formatoActual();
    caja.innerHTML = Object.entries(FORMATOS).map(([clave, f]) => `
      <label class="formato-opcion${clave === actual ? " is-active" : ""}" for="formato-${clave}">
        <input type="radio" id="formato-${clave}" name="formatoPagina" value="${clave}"${clave === actual ? " checked" : ""} />
        <span>
          <strong>${escapeHtml(f.etiqueta)}</strong>
          <small>${escapeHtml(f.descripcion)}</small>
        </span>
      </label>`).join("");
    caja.querySelectorAll("[name='formatoPagina']").forEach((opcion) => {
      opcion.addEventListener("change", () => {
        if (opcion.checked) cambiarFormato(opcion.value);
      });
    });
  }

  function openSettingsDialog() {
    pintarOpcionesFormato();
    const settings = issueSettings();
    Object.entries(settings).forEach(([name, value]) => {
      const control = els.settingsForm.elements.namedItem(name);
      if (!control) return;
      if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = value === true;
      else control.value = value || "";
    });
    if (!els.settings.open) els.settings.showModal();
    requestAnimationFrame(() => els.settingsForm.elements.namedItem("edition")?.focus());
  }

  function collectPreflightIssues(options = {}) {
    const issues = [];
    const settings = issueSettings();
    const pageNumbers = pages.map((page) => page.number);
    const uniqueIds = new Set(pages.map((page) => page.id));
    const sequential = pageNumbers.every((number, index) => number === index + 1);
    const missingRenderer = pages.find((page) => !renderers[page.layout]);
    if (pages.length !== EXPECTED_PAGE_COUNT || uniqueIds.size !== pages.length || !sequential || missingRenderer) {
      issues.push({
        severity: "critical",
        type: "structure",
        pageId: null,
        pageIndex: null,
        title: `La estructura de ${MAGAZINE_SIZE_LABEL} necesita revisión`,
        detail: "Comprueba el número, orden, identificador y plantilla de cada página antes de imprimir."
      });
    }
    const missingSettings = [
      ["edition", "nombre de la edición"],
      ["responsible", "responsable editorial"],
      ["email", "correo"],
      ["whatsapp", "teléfono o WhatsApp"],
      ["closingDate", "fecha límite"],
      ["location", "comuna o lugar"]
    ].filter(([key]) => !String(settings[key] || "").trim()).map(([, label]) => label);

    if (missingSettings.length) {
      issues.push({
        severity: "warning",
        type: "settings",
        pageId: null,
        pageIndex: null,
        title: "Faltan datos de la edición",
        detail: `Completa ${missingSettings.join(", ")} para evitar datos incompletos en varias páginas.`
      });
    }
    const mastheadChanges = [
      ["mastheadTitle", "el nombre de cabecera", MASTHEAD_DEFAULTS.title],
      ["mastheadTagline", "la línea de descriptores", MASTHEAD_DEFAULTS.tagline]
    ].filter(([key, , reference]) => normalizeComparableText(savedText("p01", key, reference)) !== normalizeComparableText(reference))
      .map(([, label]) => label);
    if (mastheadChanges.length) {
      issues.push({
        severity: "review",
        type: "identity",
        advisory: true,
        pageId: "p01",
        pageIndex: 0,
        title: "La cabecera de portada difiere de la identidad institucional",
        detail: `Se modificó ${mastheadChanges.join(" y ")}. Confirma que el cambio está acordado: la cabecera identifica a la revista de un número al siguiente.`
      });
    }
    // El descargo de la página de cartas es el único blindaje legal de la
    // revista, y era un rótulo editable que podía borrarse sin dejar rastro.
    const descargoCartas = savedText("p14", "disclaimer", DESCARGO_CARTAS).trim();
    if (!descargoCartas) {
      issues.push({
        severity: "critical",
        type: "disclaimer",
        pageId: "p14",
        pageIndex: pages.findIndex((page) => page.id === "p14"),
        title: "Falta el descargo de las cartas",
        detail: "La página de cartas debe declarar que las opiniones son de sus autores y bajo qué condiciones se publican. Sin ese texto la revista responde por lo que escriba cualquiera."
      });
    }

    // Un teléfono o un correo de muestra impreso en cinco mil ejemplares no se
    // corrige después. Los campos por los que la revista pide que la contacten
    // se revisan uno por uno antes de cerrar.
    const CONTACTOS = [
      { pageId: "p02", key: "contact", donde: "los créditos" },
      { pageId: "p17", key: "contact", donde: "la página de colaboradores" }
    ];
    const MUESTRA = /1234\s?5678|ejemplo\.|@cascohistorico\.cl|\[[^\]]+\]|correo@|tu@/i;
    CONTACTOS.forEach(({ pageId, key, donde }) => {
      const valor = savedText(pageId, key, textoDeModelo(pageId, key) || "").trim();
      if (!valor || MUESTRA.test(valor)) {
        issues.push({
          severity: "critical",
          type: "contacto",
          pageId,
          pageIndex: pages.findIndex((page) => page.id === pageId),
          title: `El contacto de ${donde} sigue siendo de muestra`,
          detail: "La revista pide que le escriban y que reserven avisos por esta vía. Un correo o un teléfono de ejemplo impreso no se puede corregir después de la tirada: reemplázalo por uno que alguien conteste."
        });
      }
    });

    if (settings.verified !== true) {
      issues.push({
        severity: "warning",
        type: "settings",
        pageId: null,
        pageIndex: null,
        title: "Los datos de la edición no están confirmados",
        detail: "Una persona responsable debe comprobar nombre, edición, contactos, fecha y lugar, y marcar la confirmación en “Datos de la edición”."
      });
    }

    const measure = document.createElement("div");
    measure.className = "preflight-measure";
    measure.setAttribute("aria-hidden", "true");
    const scopedIds = Array.isArray(options.pageIds) && options.pageIds.length ? new Set(options.pageIds) : null;
    const measuredPages = scopedIds ? pages.filter((page) => scopedIds.has(page.id)) : pages;
    // El recuadro "Agregar un aviso al pie" ocupa altura real y sólo existe
    // en modo edición: medir con él encendido inventaba desbordes críticos que
    // desaparecían al apagar Editar. Se mide siempre la página tal como se
    // imprime.
    const editandoAntes = state.editing;
    state.editing = false;
    measure.innerHTML = measuredPages.map(renderPage).join("");
    state.editing = editandoAntes;
    document.body.appendChild(measure);
    hydrateImageSlots(measure);

    try {
      pages.forEach((page, pageIndex) => {
        const pageElement = measure.querySelector(`[data-page-id="${page.id}"]`);
        if (!pageElement) return;

        if (projectStorage.getItem(storageKey("done", page.id)) !== "1") {
          issues.push({
            severity: "review",
            type: "completion",
            pageId: page.id,
            pageIndex,
            title: "Página aún no marcada como lista",
            detail: "Revísala y pulsa “Marcar como lista” cuando su contenido esté confirmado."
          });
        }

        const missingImages = [...pageElement.querySelectorAll(".image-slot:not(.has-image)")];
        if (missingImages.length) {
          issues.push({
            severity: "warning",
            type: "image",
            pageId: page.id,
            pageIndex,
            title: missingImages.length === 1 ? "Falta una imagen" : `Faltan ${missingImages.length} imágenes`,
            detail: "Reemplaza los recuadros de fotografía antes del cierre o confirma que se imprimirán como marcadores."
          });
        }

        const imageSlots = [...pageElement.querySelectorAll(".image-slot.has-image")];
        const incompleteMetadata = imageSlots.filter((slot) => {
          const metadata = imageMetadata(slot.dataset.imageKey);
          return !metadata
            || !String(metadata.alt || "").trim()
            || !String(metadata.credit || "").trim()
            || metadata.permission !== true;
        });
        if (incompleteMetadata.length) {
          issues.push({
            severity: "warning",
            type: "image-meta",
            pageId: page.id,
            pageIndex,
            title: incompleteMetadata.length === 1 ? "Falta validar una fotografía" : `Falta validar ${incompleteMetadata.length} fotografías`,
            detail: "Completa descripción accesible, crédito y autorización de uso antes del cierre editorial."
          });
        }

        const lowResolution = imageSlots.map((slot) => {
          try {
            const metadata = imageMetadata(slot.dataset.imageKey);
            if (!metadata?.width || !metadata?.height) return null;
            const rect = slot.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;
            const estimatedPpi = Math.floor(Math.min(metadata.width / (rect.width / 96), metadata.height / (rect.height / 96)));
            return estimatedPpi < 180 ? estimatedPpi : null;
          } catch {
            return null;
          }
        }).filter((value) => value !== null);
        if (lowResolution.length) {
          issues.push({
            severity: "warning",
            type: "image-quality",
            pageId: page.id,
            pageIndex,
            title: lowResolution.length === 1 ? "Una imagen puede verse poco nítida" : `${lowResolution.length} imágenes pueden verse poco nítidas`,
            detail: `Resolución estimada mínima: ${Math.min(...lowResolution)} ppp. Para esta maqueta se recomiendan al menos 180 ppp.`
          });
        }

        const recortadas = imageSlots.filter((slot) => {
          const metadata = imageMetadata(slot.dataset.imageKey);
          if (!metadata?.width || !metadata?.height || metadata.fit === "contain") return false;
          const caja = slot.getBoundingClientRect();
          if (!caja.width || !caja.height) return false;
          return cropLoss(metadata.width / metadata.height, caja.width / caja.height) > FIT_CROP_LIMIT;
        });
        if (recortadas.length) {
          issues.push({
            severity: "review",
            type: "image-fit",
            advisory: true,
            pageId: page.id,
            pageIndex,
            title: recortadas.length === 1 ? "Una imagen se está recortando mucho" : `${recortadas.length} imágenes se están recortando mucho`,
            detail: "Su proporción no coincide con la del espacio, así que se pierde una parte importante. Si es un logotipo o un aviso, ábrela y elige “Mostrar completa”."
          });
        }

        const citas = [...pageElement.querySelectorAll(".quote-card")].filter((tarjeta) => {
          const autor = tarjeta.querySelector(".quote-author");
          const frase = tarjeta.textContent.replace(autor?.textContent || "", "").trim();
          return frase && (!autor || !autor.textContent.trim() || /^\[.*\]$/.test(autor.textContent.trim()));
        });
        if (citas.length) {
          issues.push({
            severity: "warning",
            type: "quote-author",
            pageId: page.id,
            pageIndex,
            title: citas.length === 1 ? "Una frase destacada no dice quién la dijo" : `${citas.length} frases destacadas no dicen quién las dijo`,
            detail: "Una cita se atribuye siempre: nombre y quién es la persona. Sin eso no es una cita, es una frase suelta."
          });
        }

        if (PAGINAS_CON_FIRMA.has(page.id)) {
          const nodoFirma = pageElement.querySelector(".byline");
          const texto = String(nodoFirma?.textContent || "").trim();
          if (!texto || /\[/.test(texto)) {
            issues.push({
              severity: "warning",
              type: "byline",
              pageId: page.id,
              pageIndex,
              title: "La página sale sin firma",
              detail: "Quien escribe firma con nombre y apellido. Sin firma, cuando algo sale mal no responde nadie y responde la agrupación entera."
            });
          }
        }

        const menoresSinAutorizar = imageSlots.filter((slot) => {
          const metadata = imageMetadata(slot.dataset.imageKey);
          return metadata?.minors === true && !String(metadata.minorsAuth || "").trim();
        });
        if (menoresSinAutorizar.length) {
          issues.push({
            severity: "critical",
            type: "minors",
            pageId: page.id,
            pageIndex,
            title: menoresSinAutorizar.length === 1 ? "Una fotografía con menores no tiene autorización registrada" : `${menoresSinAutorizar.length} fotografías con menores no tienen autorización registrada`,
            detail: "Anota quién autorizó, con qué parentesco, en qué fecha y dónde está guardada la autorización escrita. Publicar el rostro de un niño del barrio no se puede deshacer."
          });
        }

        const printResolution = imageSlots.map((slot) => {
          try {
            const metadata = imageMetadata(slot.dataset.imageKey);
            if (!metadata?.originalWidth || !metadata?.originalHeight) return null;
            const rect = slot.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;
            const estimatedPpi = Math.floor(Math.min(
              metadata.originalWidth / (rect.width / 96),
              metadata.originalHeight / (rect.height / 96)
            ));
            return estimatedPpi < PRINT_TARGET_PPI ? estimatedPpi : null;
          } catch {
            return null;
          }
        }).filter((value) => value !== null);
        if (printResolution.length) {
          issues.push({
            severity: "review",
            type: "image-print",
            advisory: true,
            pageId: page.id,
            pageIndex,
            title: printResolution.length === 1 ? "Una fotografía no alcanza calidad de imprenta" : `${printResolution.length} fotografías no alcanzan calidad de imprenta`,
            detail: `El archivo original rinde ${Math.min(...printResolution)} puntos por pulgada, que es la medida de nitidez al imprimir, en el tamaño en que se publica. Una imprenta suele pedir ${PRINT_TARGET_PPI}: sirve para pantalla y oficina, no para un tiraje.`
          });
        }

        const placeholders = [...new Set((pageElement.textContent.match(/\[[^\]\n]{2,80}\]/g) || []).map((value) => value.trim()))];
        if (placeholders.length) {
          issues.push({
            severity: "warning",
            type: "placeholder",
            pageId: page.id,
            pageIndex,
            title: placeholders.length === 1 ? "Queda un dato por completar" : `Quedan ${placeholders.length} datos por completar`,
            detail: `Marcadores encontrados: ${placeholders.slice(0, 3).join(", ")}${placeholders.length > 3 ? "…" : ""}`
          });
        }

        const modelFields = [...pageElement.querySelectorAll("[data-edit-key]")]
          .filter((node) => isModelText(node.dataset.editKey, node.textContent));
        if (modelFields.length) {
          const names = [...new Set(modelFields.map((node) => humanFieldLabel(node.dataset.editKey)))];
          issues.push({
            severity: "warning",
            type: "model-copy",
            pageId: page.id,
            pageIndex,
            title: modelFields.length === 1 ? "Queda un texto de ejemplo del modelo" : `Quedan ${modelFields.length} textos de ejemplo del modelo`,
            detail: `Sin editar: ${names.slice(0, MODEL_TEXT_SAMPLE).join(", ")}${names.length > MODEL_TEXT_SAMPLE ? ` y ${names.length - MODEL_TEXT_SAMPLE} más` : ""}. Reemplázalos por contenido confirmado para esta edición.`
          });
        }

        const budget = wordBudgetState(page.id, pageElement);
        if (budget && budget.status !== "ok") {
          issues.push({
            severity: "review",
            type: "word-budget",
            advisory: true,
            pageId: page.id,
            pageIndex,
            title: budget.status === "short" ? "El texto queda bajo la extensión prevista" : "El texto supera la extensión prevista",
            detail: `${budget.words} palabras frente a un objetivo de ${budget.min} a ${budget.max}. ${budget.label}.`
          });
        }

        if (pageIsOverflowing(pageElement)) {
          issues.push({
            severity: "critical",
            type: "overflow",
            pageId: page.id,
            pageIndex,
            title: "El contenido excede el marco A5",
            detail: "Acorta el texto o redistribuye el contenido: una parte quedaría cortada en el PDF."
          });
        }
      });
      const originals = [...IMAGE_SLOTS]
        .map((slotKey) => imageMetadata(slotKey)?.originalName)
        .filter((name) => typeof name === "string" && name.trim());
      if (originals.length) {
        issues.push({
          severity: "review",
          type: "originals",
          advisory: true,
          pageId: null,
          pageIndex: null,
          title: `Guarda ${originals.length === 1 ? "el archivo original" : `los ${originals.length} archivos originales`} fuera del navegador`,
          detail: `El taller conserva una copia reducida a ${IMAGE_MAX_EDGE} píxeles, suficiente para maquetar pero no para imprenta. Deja los originales completos en la carpeta imagenes del segmento: ${originals.slice(0, 3).join(", ")}${originals.length > 3 ? ` y ${originals.length - 3} más` : ""}.`
        });
      }
    } finally {
      measure.remove();
    }

    return issues;
  }

  function renderPreflightReport(issues) {
    const counts = {
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      review: issues.filter((issue) => issue.severity === "review").length
    };
    // Las observaciones informativas -extensión, resolución de imprenta, encuadre,
    // identidad, recordatorio de originales- no se pueden "resolver": avisan de algo
    // que el equipo decide. Si contaran para el cierre, bastaría cargar una fotografía
    // para que el PDF final fuera inalcanzable y todo saliera marcado como borrador.
    // Bloquean sólo los problemas corregibles y las páginas sin aprobar.
    counts.advisory = issues.filter((issue) => issue.advisory === true).length;
    counts.review = issues.filter((issue) => issue.severity === "review" && issue.advisory !== true).length;
    const ready = counts.critical === 0 && counts.warning === 0 && counts.review === 0;
    const statusClass = counts.critical ? "is-blocked" : ready ? "is-ready" : "has-pending";
    // El aviso decía siempre "corrige los desbordes" porque el desborde era el
    // único problema crítico que existía cuando se escribió. Ahora también
    // bloquean la protección de menores, el descargo de las cartas y los
    // contactos de muestra: el mensaje nombra lo que de verdad está frenando.
    const MOTIVOS_CRITICOS = {
      overflow: "hay texto que se sale de la caja",
      minors: "falta la autorización de una persona menor de edad",
      disclaimer: "falta el descargo de las cartas",
      contacto: "hay un contacto de muestra sin reemplazar"
    };
    const motivos = [...new Set(issues
      .filter((issue) => issue.severity === "critical")
      .map((issue) => MOTIVOS_CRITICOS[issue.type])
      .filter(Boolean))];
    const statusTitle = counts.critical
      ? counts.critical === 1 ? "Queda algo que impide imprimir" : "Quedan cosas que impiden imprimir"
      : ready ? "Edición lista para PDF" : "La maqueta funciona, pero quedan pendientes";
    const statusDetail = counts.critical
      ? motivos.length
        ? `No se puede cerrar la edición porque ${listaEnEspanol(motivos)}.`
        : "No se puede cerrar la edición hasta resolver las observaciones críticas."
      : ready
        ? `Las ${MAGAZINE_SIZE_LABEL} pasaron la revisión editorial automática.`
        : "Puedes guardar un borrador o entrar a cada observación para completar la edición.";

    state.lastPreflight = { issues, checkedAt: new Date().toISOString() };
    state.printMode = ready ? "final" : "review";
    state.preflightByPage = new Map();
    issues.forEach((issue) => {
      if (!issue.pageId) return;
      const existing = state.preflightByPage.get(issue.pageId) || [];
      existing.push(issue);
      state.preflightByPage.set(issue.pageId, existing);
    });

    els.preflightSummary.innerHTML = `
      <section class="preflight-status ${statusClass}">
        <span class="preflight-status__mark" aria-hidden="true"></span>
        <div><h3>${escapeHtml(statusTitle)}</h3><p>${escapeHtml(statusDetail)}</p></div>
      </section>
      <div class="preflight-summary-grid" aria-label="Resumen de la revisión">
        <div><strong>${counts.critical}</strong><span>Críticos</span></div>
        <div><strong>${counts.warning}</strong><span>Por corregir</span></div>
        <div><strong>${counts.review}</strong><span>Por marcar</span></div>
        <div><strong>${counts.advisory}</strong><span>Informativas</span></div>
      </div>
      <p class="preflight-advisory-note">Las informativas no impiden cerrar la edición: avisan de algo que decide el equipo.</p>`;

    if (!issues.length) {
      els.preflightResults.innerHTML = `<div class="preflight-empty"><strong>Sin observaciones</strong><p>La edición está preparada para la salida PDF.</p></div>`;
    } else {
      // Antes era una lista plana en el orden en que se generaron las
      // observaciones: en una edición recién creada, sesenta o más entradas
      // seguidas, sin saber si son sesenta problemas o el mismo repetido
      // dieciocho veces. Ahora se agrupa por página, se ordena por gravedad y
      // se encabeza con los pasos concretos por los que conviene empezar.
      const labels = { critical: "Corregir", warning: "Completar", review: "Revisar" };
      const peso = { critical: 0, warning: 1, review: 2 };

      const tarjeta = (issue) => {
        const action = issue.type === "settings"
          ? `<button type="button" class="button button--small button--ghost" data-preflight-settings>Completar los datos</button>`
          : issue.pageIndex === null
            ? ""
            : `<button type="button" class="button button--small button--ghost" data-preflight-page="${issue.pageIndex}" data-issue-type="${issue.type}">Ir a la página</button>`;
        return `<article class="preflight-issue preflight-issue--${issue.severity}${issue.advisory ? " is-advisory" : ""}" role="listitem">
          <span class="severity-label">${issue.advisory ? "Informativa" : labels[issue.severity]}</span>
          <div><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div>
          ${action}
        </article>`;
      };

      const generales = issues.filter((issue) => issue.pageIndex === null);
      const porPagina = new Map();
      issues.filter((issue) => issue.pageIndex !== null).forEach((issue) => {
        const lista = porPagina.get(issue.pageIndex) || [];
        lista.push(issue);
        porPagina.set(issue.pageIndex, lista);
      });

      // Pasos sugeridos: lo que de verdad conviene hacer antes que nada.
      const pendientesDeAprobar = issues.filter((issue) => issue.type === "completion").length;
      const conMuestra = new Set(issues.filter((issue) => issue.type === "model-copy").map((issue) => issue.pageIndex)).size;
      const pasos = [];
      if (generales.some((issue) => issue.type === "settings")) pasos.push("Completa los datos de la edición.");
      if (conMuestra) pasos.push(`Reemplaza el texto de muestra en ${conMuestra} ${conMuestra === 1 ? "página" : "páginas"}.`);
      const faltanImagenes = issues.filter((issue) => issue.type === "image").length;
      if (faltanImagenes) pasos.push(`Coloca las fotografías que faltan en ${faltanImagenes} ${faltanImagenes === 1 ? "página" : "páginas"}.`);
      if (pendientesDeAprobar) pasos.push(`Marca como listas las ${pendientesDeAprobar} páginas pendientes.`);

      const bloquePasos = pasos.length
        ? `<section class="preflight-steps"><h3>Por dónde empezar</h3><ol>${pasos.map((paso) => `<li>${escapeHtml(paso)}</li>`).join("")}</ol></section>`
        : "";

      const bloqueGenerales = generales.length
        ? `<details class="preflight-group" open><summary><span class="preflight-group__name">Toda la edición</span><span class="preflight-group__count">${generales.length}</span></summary><div class="preflight-list" role="list">${generales.sort((a, b) => peso[a.severity] - peso[b.severity]).map(tarjeta).join("")}</div></details>`
        : "";

      const bloquesPaginas = [...porPagina.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([pageIndex, lista]) => {
          const page = pages[pageIndex];
          const ordenadas = lista.slice().sort((a, b) => peso[a.severity] - peso[b.severity]);
          const bloqueantes = ordenadas.filter((issue) => !issue.advisory).length;
          const grave = ordenadas.some((issue) => issue.severity === "critical")
            ? " preflight-group--critical"
            : bloqueantes ? " preflight-group--warning" : "";
          const resumen = bloqueantes
            ? `${bloqueantes} ${bloqueantes === 1 ? "cosa por resolver" : "cosas por resolver"}`
            : "sólo informativas";
          return `<details class="preflight-group${grave}"><summary><span class="preflight-group__name">P${String(page.number).padStart(2, "0")} · ${escapeHtml(page.title)}</span><span class="preflight-group__count">${escapeHtml(resumen)}</span></summary><div class="preflight-list" role="list">${ordenadas.map(tarjeta).join("")}</div></details>`;
        }).join("");

      els.preflightResults.innerHTML = bloquePasos + bloqueGenerales + bloquesPaginas;
    }

    const preflightPrintButton = document.getElementById("preflightPrintButton");
    preflightPrintButton.textContent = counts.critical ? "Corrige antes de imprimir" : ready ? "Guardar PDF final" : "Guardar PDF de revisión";
    preflightPrintButton.disabled = counts.critical > 0;
    preflightPrintButton.title = counts.critical ? "Resuelve los problemas críticos antes de generar el PDF." : "";
    renderTree();
  }

  async function runPreflight() {
    showToast(`Revisando las ${MAGAZINE_SIZE_LABEL}…`);
    await waitForFonts();
    await afterNextFrames();
    const issues = collectPreflightIssues();
    renderPreflightReport(issues);
    if (!els.preflight.open) els.preflight.showModal();
    requestAnimationFrame(() => els.preflight.querySelector("[data-close-preflight]")?.focus());
  }

  function openPreflightPage(pageIndex, issueType) {
    if (els.preflight.open) els.preflight.close();
    state.current = Number(pageIndex);
    state.view = "single";
    state.editing = true;
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    syncEditButton();
    renderMagazine();
    const targetPage = pages[state.current];
    requestAnimationFrame(() => {
      const pageElement = els.host.querySelector(`[data-page-id="${targetPage.id}"]`);
      let target = null;
      if (issueType === "image" || issueType === "image-quality" || issueType === "image-meta") target = pageElement?.querySelector(".image-slot:not(.has-image), .image-slot.has-image");
      if (issueType === "placeholder") target = [...(pageElement?.querySelectorAll("[data-edit-key]") || [])].find((node) => /\[[^\]]+\]/.test(node.innerText));
      if (issueType === "model-copy") target = [...(pageElement?.querySelectorAll("[data-edit-key]") || [])].find((node) => isModelText(node.dataset.editKey, node.textContent));
      if (!target) target = pageElement?.querySelector("[data-edit-key], [data-image-key], [data-page-complete]");
      pageElement?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
    showToast(issueType === "overflow" ? "Página abierta: acorta el contenido marcado." : `Página ${targetPage.number} abierta para corregir.`);
  }

  function safeDownloadName(value) {
    return String(value || "revista-casco-historico")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*]/g, "-")
      .split("")
      .map((character) => character.codePointAt(0) < 32 ? "-" : character)
      .join("")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80) || "revista-casco-historico";
  }

  async function exportDraft(options = {}) {
    const data = await projectStorage.exportProject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeDownloadName(data.project?.name)}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    if (!options.quiet) showToast("Respaldo de esta edición descargado.");
    return data;
  }

  function validateImageMetadataValue(value) {
    let metadata;
    try {
      metadata = JSON.parse(value);
    } catch {
      return false;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
    const dimensions = ["width", "height", "originalWidth", "originalHeight"];
    if (dimensions.some((key) => metadata[key] !== undefined && (!Number.isFinite(metadata[key]) || metadata[key] <= 0 || metadata[key] > 30_000))) return false;
    if (metadata.minors !== undefined && typeof metadata.minors !== "boolean") return false;
    const textFields = ["alt", "credit", "caption", "originalName", "minorsAuth"];
    if (textFields.some((key) => metadata[key] !== undefined && (typeof metadata[key] !== "string" || metadata[key].length > 2_000))) return false;
    if (metadata.fit !== undefined && metadata.fit !== "cover" && metadata.fit !== "contain") return false;
    return metadata.permission === undefined || typeof metadata.permission === "boolean";
  }

  function validateSettingsValue(value) {
    let settings;
    try {
      settings = JSON.parse(value);
    } catch {
      return false;
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
    if (Object.keys(settings).some((key) => !Object.hasOwn(ISSUE_DEFAULTS, key))) return false;
    return Object.entries(settings).every(([key, setting]) => {
      if (key === "verified") return typeof setting === "boolean";
      return typeof setting === "string" && setting.length <= 1_000;
    });
  }

  const OLD_16_PAGE_MAP = Object.freeze({
    p01: "p01", p02: "p02", p03: "p03", p04: "p06", p05: "p07", p06: "p04",
    p07: "p08", p08: "p09", p09: "p10", p10: "p12", p11: "p13", p12: "p14",
    p13: "p15", p14: "p16", p15: "p17", p16: "p18"
  });

  function detectLegacyPageProgram(entries) {
    const keys = new Set(entries.map(([key]) => key));
    const oldMarkers = [
      "text:p16.tagline", "text:p16.contact1", "text:p15.primaryTitle", "image:p04.main",
      "image:p05.support", "image:p07.portrait", "image:p08.context", "image:p09.historic",
      "image:p10.service", "image:p11.commerce", "image:p14.culture"
    ];
    const newMarkers = [
      "text:p18.tagline", "text:p18.contact1", "text:p17.primaryTitle", "image:p05.progress",
      "image:p06.main", "image:p07.support", "image:p08.portrait", "image:p09.context",
      "image:p10.historic", "image:p11.memory", "image:p12.service", "image:p13.commerce", "image:p16.culture"
    ];
    if (oldMarkers.some((key) => keys.has(key)) && !newMarkers.some((key) => keys.has(key))) return 16;
    if (newMarkers.some((key) => keys.has(key))) return 18;
    const answer = window.prompt("Este respaldo antiguo no indica si tenía 16 o 18 páginas. Escribe 16 o 18 para importarlo; pulsa Cancelar para detener la operación.", "18");
    if (answer === null) throw new Error("Importación cancelada.");
    if (String(answer).trim() !== "16" && String(answer).trim() !== "18") throw new Error("Debes indicar 16 o 18 páginas para importar esta copia antigua.");
    return Number(answer);
  }

  function remapOld16Key(relativeKey) {
    const separator = relativeKey.indexOf(":");
    const kind = relativeKey.slice(0, separator);
    const identifier = relativeKey.slice(separator + 1);
    if (kind === "settings") return relativeKey;
    const pageId = identifier.split(".")[0];
    const mapped = OLD_16_PAGE_MAP[pageId];
    if (!mapped) return relativeKey;
    return `${kind}:${mapped}${identifier.slice(pageId.length)}`;
  }

  function validatedBackupEntries(storage, options = {}) {
    if (!storage || typeof storage !== "object" || Array.isArray(storage)) throw new Error("El respaldo no contiene datos válidos.");
    const sourceEntries = Object.entries(storage);
    const relativeEntries = sourceEntries.map(([rawKey, value]) => {
      if (typeof rawKey !== "string") throw new Error("La copia contiene una clave dañada.");
      if (options.legacyPrefixed && !rawKey.startsWith(LEGACY_STORAGE_PREFIX)) throw new Error("La copia incluye datos que no pertenecen a este sistema.");
      return [options.legacyPrefixed ? rawKey.slice(LEGACY_STORAGE_PREFIX.length) : rawKey, value];
    });
    const pageProgram = options.legacyPrefixed ? detectLegacyPageProgram(relativeEntries) : 18;
    const entries = pageProgram === 16
      ? relativeEntries.map(([key, value]) => [remapOld16Key(key), value])
      : relativeEntries;
    if (entries.length > 1_000) throw new Error("El respaldo contiene demasiados elementos.");
    const pageIds = new Set(pages.map((page) => page.id));
    const seen = new Set();
    let totalCharacters = 0;

    entries.forEach(([key, value]) => {
      if (typeof value !== "string") throw new Error("La copia incluye datos que no pertenecen a este sistema.");
      if (seen.has(key)) throw new Error("La copia contiene campos editoriales duplicados.");
      seen.add(key);
      totalCharacters += key.length + value.length;
      if (totalCharacters > MAX_BACKUP_CHARACTERS) throw new Error("El respaldo excede el tamaño permitido.");

      const separator = key.indexOf(":");
      const kind = key.slice(0, separator);
      const identifier = key.slice(separator + 1);
      const pageId = identifier.split(".")[0];
      if (separator <= 0 || !identifier) throw new Error("La copia contiene una clave dañada.");

      if (kind === "text") {
        if (!pageIds.has(pageId) || !/^p\d{2}\.[A-Za-z0-9._-]{1,160}$/.test(identifier) || value.length > 100_000) {
          throw new Error("La copia contiene un campo de texto no válido.");
        }
      } else if (kind === "image") {
        if (!IMAGE_SLOTS.has(identifier) || !isValidImageData(value)) throw new Error("La copia contiene una fotografía no válida.");
      } else if (kind === "image-meta") {
        if (!IMAGE_SLOTS.has(identifier) || !validateImageMetadataValue(value)) throw new Error("La copia contiene datos fotográficos no válidos.");
      } else if (kind === "done") {
        if (!pageIds.has(identifier) || value !== "1") throw new Error("La copia contiene un estado de página no válido.");
      } else if (kind === "settings") {
        if (identifier !== "issue" || !validateSettingsValue(value)) throw new Error("El respaldo contiene datos de edición no válidos.");
      } else {
        throw new Error("La copia incluye un tipo de dato no reconocido.");
      }
    });
    return entries;
  }

  async function importDraft(file) {
    try {
      if (file.size > MAX_BACKUP_CHARACTERS) throw new Error("El respaldo excede el tamaño permitido.");
      const data = JSON.parse(await file.text());
      let name;
      let edition;
      let importedEntries;
      if (data.format === "revista-casco-historico-v2") {
        if (data.schemaVersion !== 2 || data.project?.templateId !== "casco-18" || data.project?.templateVersion !== 1) {
          throw new Error("Este respaldo usa una plantilla que esta versión no reconoce.");
        }
        name = String(data.project?.name || "Revista importada");
        edition = String(data.project?.edition || name);
        importedEntries = validatedBackupEntries(data.entries);
      } else if (data.format === "revista-casco-historico-v1") {
        importedEntries = validatedBackupEntries(data.storage, { legacyPrefixed: true });
        const settingsEntry = importedEntries.find(([key]) => key === "settings:issue");
        const legacySettings = settingsEntry ? JSON.parse(settingsEntry[1]) : {};
        edition = String(legacySettings.edition || "Edición recuperada");
        name = `Respaldo recuperado · ${edition}`;
      } else {
        throw new Error("Sólo puedes abrir respaldos creados por este sistema.");
      }
      await projectStorage.importProject({ name, edition, entries: importedEntries });
      resetEditorState();
      showEditor();
      showToast("Respaldo importado como una revista independiente.");
    } catch (error) {
      console.warn("Importación rechazada:", error);
      showToast("Este archivo no se puede abrir: no es un respaldo completo de una revista de este taller. Usa el archivo .json que descargaste con “Respaldar edición”. Si es el único que tienes, avisa a quien administra el taller.");
    }
  }

  function projectDateLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return `Actualizada ${new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
  }

  function completedPagesFor(project) {
    if (project.id === projectStorage.active()?.id) {
      return projectStorage.entries().filter(([key, value]) => key.startsWith("done:") && value === "1").length;
    }
    return Math.max(0, Math.min(EXPECTED_PAGE_COUNT, Number(project.completedPages) || 0));
  }

  function projectCard(project, trashed = false) {
    const completed = completedPagesFor(project);
    const percent = Math.round((completed / EXPECTED_PAGE_COUNT) * 100);
    const ready = completed === EXPECTED_PAGE_COUNT;
    const id = escapeHtml(project.id);
    const name = escapeHtml(project.name);
    const edition = escapeHtml(project.edition || "Edición sin nombre público");
    const openAction = trashed
      ? `<button type="button" class="button button--ghost" data-project-restore="${id}">Restaurar</button>`
      : `<button type="button" class="button button--primary" data-project-open="${id}">Abrir</button>`;
    const secondaryActions = trashed
      ? `<button type="button" class="project-menu-button" data-project-delete="${id}" aria-label="Eliminar definitivamente ${name}" title="Eliminar definitivamente">×</button>`
      : `<button type="button" class="project-menu-button" data-project-duplicate="${id}" aria-label="Crear una nueva edición desde ${name}" title="Duplicar como nueva edición">⧉</button>
         <button type="button" class="project-menu-button" data-project-rename="${id}" aria-label="Renombrar ${name}" title="Renombrar">✎</button>
         <button type="button" class="project-menu-button" data-project-archive="${id}" aria-label="Mover ${name} a la papelera" title="Mover a la papelera">⌫</button>`;
    return `<article class="project-card" data-project-card="${id}">
      <button type="button" class="project-card__preview" ${trashed ? `data-project-restore="${id}"` : `data-project-open="${id}"`} aria-label="${trashed ? "Restaurar" : "Abrir"} ${name}">
        <img data-brand-logo src="./assets/brand/logo-casco-historico.webp" alt="" />
      </button>
      <div class="project-card__body">
        <h3>${name}</h3>
        <p class="project-card__edition">${edition}</p>
        <div class="project-card__meta">
          <span class="project-card__status ${ready ? "is-ready" : ""}">${trashed ? "En papelera" : ready ? "18 páginas listas" : `${completed}/18 páginas listas`}</span>
        </div>
        <div class="project-card__progress" aria-hidden="true"><span style="width:${percent}%"></span></div>
        <p class="project-card__updated">${escapeHtml(projectDateLabel(project.updatedAt))}</p>
        <div class="project-card__actions">${openAction}${secondaryActions}</div>
      </div>
    </article>`;
  }

  function renderProjectHome() {
    const activeProjects = projectStorage.list();
    const trashedProjects = projectStorage.list({ trashed: true });
    els.projectHomeList.setAttribute("aria-busy", "false");
    els.projectHomeList.innerHTML = activeProjects.length
      ? activeProjects.map((project) => projectCard(project)).join("")
      : `<div class="project-empty-state"><div><h3>Aún no hay revistas</h3><p>Crea la primera edición para comenzar a escribir, agregar fotografías y preparar su PDF.</p><button type="button" class="button button--primary" data-empty-new>Nueva revista</button></div></div>`;
    els.projectTrashList.innerHTML = trashedProjects.length
      ? trashedProjects.map((project) => projectCard(project, true)).join("")
      : `<div class="project-empty-state"><div><h3>La papelera está vacía</h3><p>Las revistas archivadas aparecerán aquí hasta que las restaures o elimines.</p></div></div>`;
  }

  function resetEditorState() {
    state.current = state.view === "spread" && !compactQuery.matches ? 1 : 0;
    state.editing = false;
    state.activeImageKey = null;
    state.pendingImage = null;
    state.restoreViewAfterPrint = null;
    state.printMode = "review";
    state.preflightByPage.clear();
    state.lastPreflight = null;
    undoStack.length = 0;
    state.formatTarget = null;
    if (els.assistant) els.assistant.hidden = true;
    if (els.format) els.format.hidden = true;
    els.assistantButton?.setAttribute("aria-expanded", "false");
    els.formatButton?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("assistant-open", "format-open");
    document.body.classList.remove("edit-mode", "is-printing", "print-review", "print-final", "sidebar-open");
    document.title = state.originalTitle;
    [els.identity, els.settings, els.imageMeta, els.preflight, els.print, els.newProject, els.renameProject]
      .forEach((dialog) => { if (dialog?.open) dialog.close(); });
    els.imageMetaForm?.reset();
    syncEditButton();
  }

  // Migración puntual: el sumario pasó de lista con índice numérico a filas
  // derivadas de la estructura. Las claves antiguas no se leen, no se borran,
  // viajan en cada respaldo y cuentan contra los límites de la edición.
  function migrarSumarioAntiguo() {
    const antiguas = projectStorage.entries()
      .map(([clave]) => clave)
      .filter((clave) => /^text:p02\.contents\.\d+\./.test(clave));
    if (!antiguas.length) return 0;

    const filas = contentsRows();
    const cambios = new Map();
    antiguas.forEach((clave) => {
      const partes = clave.split(".");
      const indice = Number(partes[2]);
      if (partes[3] === "title" && filas[indice]) {
        const destino = storageKey("text", `p02.contents.${filas[indice].segmentId}.title`);
        if (!projectStorage.getItem(destino)) cambios.set(destino, projectStorage.getItem(clave));
      }
      cambios.set(clave, null);
    });

    projectStorage.putMany(cambios).catch(() => undefined);
    return antiguas.length;
  }

  // La página 16 dejó de ser una convocatoria a colaborar y pasó a ser el
  // observatorio de datos. Dos campos de la maqueta anterior ya no se leen.
  const CAMPOS_RETIRADOS = ["p16.callout", "p16.deadline", "p12.body"];

  function limpiarCamposRetirados() {
    const prefijos = CAMPOS_RETIRADOS.flatMap((campo) => [
      storageKey("text", campo),
      storageKey("text", `${campo}.${APLICADO_SUFIJO}`)
    ]);
    const cambios = new Map();
    projectStorage.entries().forEach(([clave]) => {
      if (prefijos.includes(clave)) cambios.set(clave, null);
    });
    if (!cambios.size) return 0;
    projectStorage.putMany(cambios).catch(() => undefined);
    return cambios.size;
  }

  function showEditor(options = {}) {
    const project = projectStorage.active();
    if (!project) {
      showProjectHome();
      return;
    }
    els.projectHome.hidden = true;
    els.projectHome.inert = true;
    els.studioShell.hidden = false;
    els.studioShell.inert = false;
    els.currentProjectName.textContent = project.name;
    setAutosaveStatus(savedNowLabel());
    refreshBrandLogo();
    aplicarFormato();
    const huerfanas = migrarSumarioAntiguo() + limpiarCamposRetirados();
    if (huerfanas) {
      showToast(huerfanas === 1
        ? "Se actualizó la estructura de esta revista y se retiró un dato que ya no se usaba."
        : `Se actualizó la estructura de esta revista y se retiraron ${huerfanas} datos que ya no se usaban.`);
    }
    // De la edición dependían las fotos, los botones de lista, el faldón, el
    // contador y la aprobación de páginas. Quien abría la revista veía un
    // recuadro que decía "Agregar fotografía", lo pulsaba y no ocurría nada.
    // Se entra directamente en modo edición; "Terminar edición" da la vista
    // limpia para revisar.
    if (!printPreview) state.editing = true;
    syncEditButton();
    renderTree();
    renderMagazine();
    if (compactQuery.matches) els.sidebar.inert = true;
    if (options.focus !== false) requestAnimationFrame(() => els.workspace.focus({ preventScroll: true }));
  }

  async function showProjectHome(options = {}) {
    try {
      await projectStorage.flush();
    } catch (error) {
      showToast(error?.message || "Hay cambios que todavía no pudieron guardarse.");
      return;
    }
    state.editing = false;
    syncEditButton();
    els.sidebar.classList.remove("is-open");
    els.sidebarScrim.hidden = true;
    els.studioShell.inert = true;
    els.studioShell.hidden = true;
    els.projectHome.hidden = false;
    els.projectHome.inert = false;
    renderProjectHome();
    if (options.focus !== false) requestAnimationFrame(() => els.projectHomeMain.focus({ preventScroll: true }));
  }

  async function openProject(id) {
    try {
      await projectStorage.switchTo(id);
      resetEditorState();
      showEditor();
    } catch (error) {
      showToast(error?.message || "No se pudo abrir la revista.");
    }
  }

  function openNewProjectDialog() {
    const number = projectStorage.list().length + 1;
    els.newProjectForm.reset();
    els.newProjectForm.elements.namedItem("projectName").value = `Revista Casco Histórico · Edición ${number}`;
    els.newProjectForm.elements.namedItem("projectEdition").value = `Edición N.° ${number} · Mes 2026`;
    els.newProject.showModal();
    requestAnimationFrame(() => els.newProjectForm.elements.namedItem("projectName").select());
  }

  async function duplicateProject(id) {
    const source = projectStorage.list().find((project) => project.id === id);
    if (!source) return;
    try {
      const duplicateName = `${source.name.slice(0, 100)} · nueva edición`;
      await projectStorage.duplicate(id, { name: duplicateName, mode: "new-edition" });
      resetEditorState();
      showEditor();
      showToast("Nueva edición creada con una copia de los contenidos; las aprobaciones se reiniciaron.");
    } catch (error) {
      showToast(error?.message || "No se pudo duplicar la revista.");
    }
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo. Copia la imagen a una carpeta local e inténtalo otra vez."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("El archivo no se pudo abrir como imagen. Puede estar dañado o tener una extensión que no corresponde a su contenido; ábrelo primero en el visor de fotos para comprobarlo."));
        image.onload = () => {
          const max = IMAGE_MAX_EDGE;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          // JPEG no tiene transparencia: los píxeles transparentes de un
          // logotipo recortado se componían en negro. Si el original es PNG se
          // conserva en PNG mientras quepa; si no, se pone blanco por detrás
          // antes de pasar a JPEG.
          let datos = "";
          if (/png$/i.test(file.type)) {
            const comoPng = canvas.toDataURL("image/png");
            if (comoPng.length <= MAX_IMAGE_CHARACTERS) datos = comoPng;
          }
          if (!datos) {
            context.globalCompositeOperation = "destination-over";
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.globalCompositeOperation = "source-over";
            datos = canvas.toDataURL("image/jpeg", 0.84);
          }

          resolve({
            data: datos,
            width: canvas.width,
            height: canvas.height,
            originalWidth: image.width,
            originalHeight: image.height
          });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openPrintDialog() {
    const finalMode = state.printMode === "final";
    if (els.printModeNotice) {
      els.printModeNotice.classList.toggle("is-final", finalMode);
      els.printModeNotice.classList.toggle("is-review", !finalMode);
      els.printModeNotice.innerHTML = finalMode
        ? `<strong>PDF final A5</strong><p>La revisión automática está limpia y las ${MAGAZINE_SIZE_LABEL} fueron aprobadas. Esta salida sirve para distribución digital o impresión de oficina; confirma con la imprenta si necesita sangrado, marcas o un perfil de color específico.</p>`
        : `<strong>PDF de revisión · BORRADOR</strong><p>El archivo llevará la marca “BORRADOR · NO DISTRIBUIR”. Úsalo para corregir y aprobar contenido; no lo distribuyas como edición final.</p>`;
    }
    if (typeof els.print.showModal === "function") els.print.showModal();
    else preparePrint();
  }

  function printDocumentTitle() {
    if (state.printMode === "review") return "BORRADOR_Revista_Casco_Historico";
    if (state.pressOutput === true) {
      return `IMPRENTA_Revista_Casco_Historico_${editionSlug()}`;
    }
    const edition = String(issueSettings().edition || "Edicion_final")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70);
    return `Revista_Casco_Historico_${edition || "Edicion_final"}`;
  }

  function editionSlug() {
    return String(issueSettings().edition || "Edicion_final")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "Edicion_final";
  }

  function mountPrintLayout() {
    if (!state.restoreViewAfterPrint) {
      state.restoreViewAfterPrint = {
        view: state.view,
        current: state.current,
        editing: state.editing,
        homeWasVisible: !els.projectHome.hidden
      };
    }
    els.projectHome.hidden = true;
    els.projectHome.inert = true;
    els.studioShell.hidden = false;
    els.studioShell.inert = false;
    state.view = "all";
    state.editing = false;
    document.body.classList.add("is-printing");
    document.body.classList.toggle("print-press", state.pressOutput === true);
    applyPageRule(state.pressOutput === true ? "press" : "office");
    document.body.classList.toggle("print-review", state.printMode === "review");
    document.body.classList.toggle("print-final", state.printMode === "final");
    document.title = printDocumentTitle();
    syncEditButton();
    renderMagazine();
  }

  async function preparePrint() {
    if (els.print.open) els.print.close();
    mountPrintLayout();
    await waitForFonts();
    await withTimeout(
      Promise.all([...document.images].map((image) => image.decode?.().catch(() => undefined))),
      FONT_WAIT_TIMEOUT
    );
    await afterNextFrames();
    window.print();
  }

  function restoreAfterPrint() {
    if (!state.restoreViewAfterPrint) return;
    const restored = state.restoreViewAfterPrint;
    state.view = restored.view;
    state.current = restored.current;
    state.editing = restored.editing;
    state.restoreViewAfterPrint = null;
    document.body.classList.remove("is-printing", "print-review", "print-final", "print-press");
    applyPageRule("office");
    document.title = state.originalTitle;
    syncEditButton();
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderMagazine();
    if (restored.homeWasVisible) {
      els.studioShell.inert = true;
      els.studioShell.hidden = true;
      els.projectHome.hidden = false;
      els.projectHome.inert = false;
      renderProjectHome();
    }
  }

  els.newProjectButton.addEventListener("click", openNewProjectDialog);
  els.importProjectButton.addEventListener("click", () => els.importFile.click());
  els.backToProjectsButton.addEventListener("click", () => showProjectHome());
  document.querySelectorAll("[data-close-new-project]").forEach((button) => button.addEventListener("click", () => els.newProject.close()));
  document.querySelectorAll("[data-close-rename-project]").forEach((button) => button.addEventListener("click", () => els.renameProject.close()));
  els.newProjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!els.newProjectForm.reportValidity()) return;
    const formData = new FormData(els.newProjectForm);
    const name = String(formData.get("projectName") || "").trim();
    const edition = String(formData.get("projectEdition") || "").trim();
    const submitButton = els.newProjectForm.querySelector("[type='submit']");
    submitButton.disabled = true;
    try {
      await projectStorage.create({
        name,
        edition,
        entries: [
          [storageKey("settings", "issue"), JSON.stringify({ ...ISSUE_DEFAULTS, edition })],
          [storageKey("text", "p01.edition"), edition]
        ]
      });
      els.newProject.close();
      resetEditorState();
      showEditor();
      showToast("Revista creada. Ya puedes comenzar a editarla.");
    } catch (error) {
      showToast(error?.message || "No se pudo crear la revista.");
      renderProjectHome();
    } finally {
      submitButton.disabled = false;
    }
  });
  els.renameProjectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!els.renameProjectForm.reportValidity() || !state.renamingProjectId) return;
    const input = els.renameProjectForm.elements.namedItem("renameProjectName");
    const submitButton = els.renameProjectForm.querySelector("[type='submit']");
    submitButton.disabled = true;
    try {
      await projectStorage.rename(state.renamingProjectId, input.value);
      els.renameProject.close();
      state.renamingProjectId = null;
      renderProjectHome();
      if (!els.studioShell.hidden) els.currentProjectName.textContent = projectStorage.active()?.name || "";
      showToast("Nombre de la revista actualizado.");
    } catch (error) {
      showToast(error?.message || "No se pudo renombrar la revista.");
    } finally {
      submitButton.disabled = false;
    }
  });
  els.openTrashButton.addEventListener("click", () => {
    const open = els.projectTrashPanel.hidden;
    els.projectTrashPanel.hidden = !open;
    els.openTrashButton.setAttribute("aria-expanded", String(open));
    els.openTrashButton.textContent = open ? "Ocultar papelera" : "Papelera";
    if (open) requestAnimationFrame(() => els.projectTrashPanel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }));
  });
  els.projectHome.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-empty-new]")) {
      openNewProjectDialog();
      return;
    }
    const actionNames = ["projectOpen", "projectDuplicate", "projectRename", "projectArchive", "projectRestore", "projectDelete"];
    const action = actionNames.find((name) => button.dataset[name]);
    if (!action) return;
    const id = button.dataset[action];
    const project = [...projectStorage.list(), ...projectStorage.list({ trashed: true })].find((entry) => entry.id === id);
    if (!project) return;
    if (action === "projectRename") {
      state.renamingProjectId = id;
      const input = els.renameProjectForm.elements.namedItem("renameProjectName");
      input.value = project.name;
      els.renameProject.showModal();
      requestAnimationFrame(() => input.select());
      return;
    }
    if (action === "projectArchive" && !window.confirm(`¿Mover “${project.name}” a la papelera? Podrás restaurarla después.`)) return;
    if (action === "projectDelete") {
      const answer = window.prompt(`Esta eliminación no se puede deshacer. Escribe exactamente el nombre para confirmar:\n\n${project.name}`, "");
      if (answer !== project.name) {
        if (answer !== null) showToast("El nombre no coincide; la revista no fue eliminada.");
        return;
      }
    }
    button.disabled = true;
    try {
      if (action === "projectOpen") await openProject(id);
      else if (action === "projectDuplicate") await duplicateProject(id);
      else if (action === "projectArchive") {
        const previousActiveId = projectStorage.active()?.id;
        await projectStorage.archive(id);
        if (projectStorage.active()?.id !== previousActiveId) resetEditorState();
        renderProjectHome();
        showToast("Revista movida a la papelera.");
      } else if (action === "projectRestore") {
        await projectStorage.restore(id);
        renderProjectHome();
        showToast("Revista restaurada.");
      } else if (action === "projectDelete") {
        await projectStorage.deletePermanently(id);
        renderProjectHome();
        showToast("Revista eliminada definitivamente.");
      }
    } catch (error) {
      showToast(error?.message || "No se pudo completar la operación.");
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  window.addEventListener("magazine-storage-state", (event) => {
    const detail = event.detail || {};
    if (detail.state === "saving") setAutosaveStatus("Guardando…");
    else if (detail.state === "saved") setAutosaveStatus(savedNowLabel());
    else if (detail.state === "error") {
      setAutosaveStatus("Error al guardar", true);
      showToast(detail.message || "No se pudieron guardar los cambios.");
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  els.zoom.value = String(state.zoom);
  els.zoomValue.textContent = `${state.zoom}%`;
  els.sidebarZoom.value = String(state.zoom);
  els.sidebarZoomValue.textContent = `${state.zoom}%`;
  function updateZoom(value) {
    state.zoom = Number(value);
    els.zoom.value = String(state.zoom);
    els.sidebarZoom.value = String(state.zoom);
    els.zoomValue.textContent = `${state.zoom}%`;
    els.sidebarZoomValue.textContent = `${state.zoom}%`;
    els.host.style.setProperty("--preview-zoom", String(state.zoom / 100));
  }
  els.zoom.addEventListener("input", () => updateZoom(els.zoom.value));
  els.sidebarZoom.addEventListener("input", () => updateZoom(els.sidebarZoom.value));
  const marcasToggle = document.getElementById("marksToggle");
  if (marcasToggle) {
    const aplicarMarcas = () => {
      document.body.classList.toggle("sin-marcas-edicion", !marcasToggle.checked);
      try {
        window.localStorage.setItem("taller:marcas-edicion", marcasToggle.checked ? "1" : "0");
      } catch {
        // Recordar la preferencia es una comodidad, no un dato de la revista.
      }
    };
    try {
      if (window.localStorage.getItem("taller:marcas-edicion") === "0") marcasToggle.checked = false;
    } catch {
      // Sin preferencia guardada se dejan visibles.
    }
    aplicarMarcas();
    marcasToggle.addEventListener("change", aplicarMarcas);
  }

  els.safe.addEventListener("change", () => {
    state.safe = els.safe.checked;
    renderMagazine();
  });
  els.edit.addEventListener("click", () => setEditing(!state.editing));
  els.prev.addEventListener("click", () => navigate(-1));
  els.next.addEventListener("click", () => navigate(1));
  els.navComplete.addEventListener("click", () => togglePageCompletion(pages[state.current].id));
  const logoFileInput = document.getElementById("logoFile");

  async function applyBrandLogo(file) {
    try {
      if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type) || file.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error("Selecciona una imagen JPG, PNG o WebP de hasta 20 MB.");
      }
      showToast("Preparando el logotipo…");
      const resultado = await resizeImage(file);
      if (!isValidImageData(resultado.data)) throw new Error("El archivo procesado no es válido.");
      projectStorage.setItem(storageKey("image", LOGO_KEY), resultado.data);
      projectStorage.setItem(storageKey("image-meta", LOGO_KEY), JSON.stringify({
        width: resultado.width,
        height: resultado.height,
        originalWidth: resultado.originalWidth,
        originalHeight: resultado.originalHeight,
        originalName: String(file.name).slice(0, 180),
        alt: "Logotipo de la revista",
        credit: "Identidad institucional",
        permission: true
      }));
      setAutosaveStatus("Guardando…");
      refreshBrandLogo();
      renderMagazine();
      showToast("Logotipo reemplazado en portada, contraportada y barra superior.");
    } catch (error) {
      setAutosaveStatus("Error al guardar", true);
      showToast(error?.message || "No se pudo reemplazar el logotipo.");
    }
  }

  document.getElementById("replaceLogoButton")?.addEventListener("click", () => logoFileInput?.click());
  logoFileInput?.addEventListener("change", () => {
    const archivo = logoFileInput.files?.[0];
    if (archivo) applyBrandLogo(archivo);
    logoFileInput.value = "";
  });
  document.getElementById("restoreLogoButton")?.addEventListener("click", () => {
    projectStorage.removeItem(storageKey("image", LOGO_KEY));
    projectStorage.removeItem(storageKey("image-meta", LOGO_KEY));
    setAutosaveStatus("Guardando…");
    refreshBrandLogo();
    renderMagazine();
    showToast("Se restauró el logotipo original de la agrupación.");
  });
  document.getElementById("identityButton").addEventListener("click", () => {
    refreshBrandLogo();
    els.identity.showModal();
  });
  document.getElementById("closeIdentityButton").addEventListener("click", () => els.identity.close());
  document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", openSettingsDialog));
  document.querySelectorAll("[data-close-settings]").forEach((button) => button.addEventListener("click", () => els.settings.close()));
  els.settingsForm.addEventListener("input", (event) => {
    if (event.target?.name === "verified") return;
    const verifiedControl = els.settingsForm.elements.namedItem("verified");
    if (verifiedControl instanceof HTMLInputElement) verifiedControl.checked = false;
  });
  els.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!els.settingsForm.reportValidity()) return;
    const formData = new FormData(els.settingsForm);
    const settings = {
      edition: String(formData.get("edition") || "").trim(),
      responsible: String(formData.get("responsible") || "").trim(),
      closingDate: String(formData.get("closingDate") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      whatsapp: String(formData.get("whatsapp") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      motto: String(formData.get("motto") || "").trim(),
      verified: formData.has("verified")
    };
    let resultado;
    try {
      setAutosaveStatus("Guardando…");
      resultado = await applyIssueSettings(settings);
      setAutosaveStatus(savedNowLabel());
    } catch (error) {
      setAutosaveStatus("Error al guardar", true);
      showToast(error?.message || "No se pudieron guardar los datos de la edición.");
      return;
    }
    invalidatePreflight();
    els.settings.close();
    renderTree();
    renderMagazine();
    const respetados = resultado?.respetados || [];
    const tocadas = resultado?.tocadas || [];
    if (respetados.length) {
      showToast(`Datos guardados. ${respetados.length === 1 ? "Un texto que escribiste a mano se conservó" : `${respetados.length} textos que escribiste a mano se conservaron`}: ${respetados.slice(0, 3).join(", ")}${respetados.length > 3 ? "…" : ""}.`);
    } else if (tocadas.length) {
      showToast(`Datos guardados y aplicados. ${tocadas.length === 1 ? "Una página vuelve" : `${tocadas.length} páginas vuelven`} a estado pendiente para revisarla${tocadas.length === 1 ? "" : "s"}.`);
    } else {
      showToast("Datos de la edición guardados.");
    }
  });
  document.querySelectorAll("[data-open-preflight]").forEach((button) => button.addEventListener("click", runPreflight));
  document.querySelectorAll("[data-close-preflight]").forEach((button) => button.addEventListener("click", () => els.preflight.close()));
  els.preflightResults.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-preflight-page]");
    if (pageButton) {
      openPreflightPage(pageButton.dataset.preflightPage, pageButton.dataset.issueType);
      return;
    }
    if (event.target.closest("[data-preflight-settings]")) {
      els.preflight.close();
      openSettingsDialog();
    }
  });
  document.getElementById("printButton").addEventListener("click", runPreflight);
  document.getElementById("preflightPrintButton").addEventListener("click", () => {
    if (els.preflight.open) els.preflight.close();
    openPrintDialog();
  });
  const PRINT_STEPS = {
    office: [
      "En la ventana de impresión elige <strong>Guardar como PDF</strong>.",
      "Selecciona papel <strong>A5</strong>, escala <strong>100%</strong> y márgenes <strong>ninguno</strong>.",
      "Activa <strong>gráficos de fondo</strong> para conservar marcos, colores y mosaicos."
    ],
    press: [
      "En la ventana de impresión elige <strong>Guardar como PDF</strong>.",
      "Selecciona papel <strong>A4</strong>, escala <strong>100%</strong> y márgenes <strong>ninguno</strong>.",
      "Activa <strong>gráficos de fondo</strong>: sin eso no se imprimen ni el sangrado ni las marcas.",
      "Entrega ese PDF a la imprenta indicando corte de <strong>148 × 210 mm</strong> y sangrado de <strong>3 mm</strong>."
    ]
  };

  function syncPrintOutput() {
    const elegido = document.querySelector("[name='printOutput']:checked")?.value === "press" ? "press" : "office";
    state.pressOutput = elegido === "press";
    const pasos = document.getElementById("printSteps");
    if (pasos) pasos.innerHTML = PRINT_STEPS[elegido].map((paso) => `<li>${paso}</li>`).join("");
  }

  document.querySelectorAll("[name='printOutput']").forEach((opcion) => {
    opcion.addEventListener("change", syncPrintOutput);
  });
  syncPrintOutput();

  document.getElementById("confirmPrintButton").addEventListener("click", preparePrint);
  document.querySelectorAll("[data-close-print]").forEach((button) => button.addEventListener("click", () => els.print.close()));
  document.getElementById("exportButton").addEventListener("click", async () => {
    try {
      await exportDraft();
    } catch (error) {
      showToast(error?.message || "No se pudo descargar el respaldo.");
    }
  });
  document.getElementById("importButton").addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    if (els.importFile.files?.[0]) importDraft(els.importFile.files[0]);
    els.importFile.value = "";
  });
  els.imageFile.addEventListener("change", async () => {
    const file = els.imageFile.files?.[0];
    if (!file || !state.activeImageKey) {
      els.imageFile.value = "";
      return;
    }
    const imageKey = state.activeImageKey;
    const selectedProjectId = projectStorage.active()?.id;
    try {
      if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type) || file.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error("Selecciona una imagen JPG, PNG o WebP de hasta 20 MB.");
      }
      showToast("Preparando fotografía…");
      const result = await resizeImage(file);
      if (!selectedProjectId || projectStorage.active()?.id !== selectedProjectId || els.studioShell.hidden) {
        throw new Error("La revista abierta cambió. Selecciona nuevamente la fotografía.");
      }
      if (!isValidImageData(result.data)) throw new Error("La fotografía procesada no es válida.");
      const previousMetadata = imageMetadata(imageKey);
      state.pendingImage = {
        imageKey,
        result,
        originalName: file.name.slice(0, 180),
        projectId: selectedProjectId
      };
      const photoAlt = els.imageMetaForm.elements.namedItem("photoAlt");
      const photoCredit = els.imageMetaForm.elements.namedItem("photoCredit");
      const photoCaption = els.imageMetaForm.elements.namedItem("photoCaption");
      const photoPermission = els.imageMetaForm.elements.namedItem("photoPermission");
      photoAlt.value = String(previousMetadata?.alt || "");
      photoCredit.value = String(previousMetadata?.credit || "");
      photoCaption.value = String(previousMetadata?.caption || "");
      photoPermission.checked = previousMetadata?.permission === true;
      const photoMinors = els.imageMetaForm.elements.namedItem("photoMinors");
      const photoMinorsAuth = els.imageMetaForm.elements.namedItem("photoMinorsAuth");
      const campoAutorizacion = document.getElementById("photoMinorsAuthField");
      if (photoMinors) photoMinors.checked = previousMetadata?.minors === true;
      if (photoMinorsAuth) photoMinorsAuth.value = String(previousMetadata?.minorsAuth || "");
      if (campoAutorizacion) campoAutorizacion.hidden = !(photoMinors && photoMinors.checked);
      if (photoMinorsAuth) photoMinorsAuth.required = Boolean(photoMinors && photoMinors.checked);

      const sugerencia = suggestedFit(result, imageKey);
      const encajeElegido = previousMetadata?.fit === "cover" || previousMetadata?.fit === "contain"
        ? previousMetadata.fit
        : sugerencia.fit;
      const opciones = els.imageMetaForm.elements.namedItem("photoFit");
      if (opciones) {
        [...opciones].forEach((opcion) => { opcion.checked = opcion.value === encajeElegido; });
      }
      const aviso = document.getElementById("photoFitHint");
      if (aviso) {
        const porcentaje = Math.round(sugerencia.perdida * 100);
        aviso.textContent = sugerencia.fit === "contain"
          ? `Esta imagen es bastante más ${sugerencia.proporcionImagen > sugerencia.proporcionHueco ? "ancha" : "alta"} que su espacio: al recortarla se perdería cerca del ${porcentaje} %. Se propone mostrarla completa.`
          : `La imagen calza bien en su espacio: al recortarla se pierde alrededor del ${porcentaje} %. Se propone llenar el espacio.`;
        aviso.dataset.fit = sugerencia.fit;
      }

      els.imageMeta.showModal();
      requestAnimationFrame(() => photoAlt.focus());
    } catch (error) {
      const quota = error?.name === "QuotaExceededError";
      setAutosaveStatus("Error al guardar", true);
      showToast(quota ? "No queda espacio local. Guarda una copia y reduce el peso de las fotos." : error.message || "No se pudo preparar la fotografía.");
    } finally {
      state.activeImageKey = null;
      els.imageFile.value = "";
    }
  });

  function closeImageMetadataDialog() {
    state.pendingImage = null;
    els.imageMetaForm.reset();
    if (els.imageMeta.open) els.imageMeta.close();
  }

  document.getElementById("photoMinors")?.addEventListener("change", (evento) => {
    const campo = document.getElementById("photoMinorsAuthField");
    const entrada = document.getElementById("photoMinorsAuth");
    if (campo) campo.hidden = !evento.target.checked;
    if (entrada) entrada.required = evento.target.checked;
  });
  document.querySelectorAll("[data-close-image-meta]").forEach((button) => button.addEventListener("click", closeImageMetadataDialog));
  els.imageMeta.addEventListener("cancel", () => {
    state.pendingImage = null;
    els.imageMetaForm.reset();
  });
  els.imageMetaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.pendingImage || !els.imageMetaForm.reportValidity()) return;
    const { imageKey, result, originalName, projectId } = state.pendingImage;
    if (!projectId || projectStorage.active()?.id !== projectId) {
      closeImageMetadataDialog();
      showToast("La revista abierta cambió. Selecciona nuevamente la fotografía.");
      return;
    }
    const formData = new FormData(els.imageMetaForm);
    const metadata = {
      width: result.width,
      height: result.height,
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      originalName,
      fit: formData.get("photoFit") === "contain" ? "contain" : "cover",
      minors: formData.has("photoMinors"),
      minorsAuth: String(formData.get("photoMinorsAuth") || "").trim(),
      alt: String(formData.get("photoAlt") || "").trim(),
      credit: String(formData.get("photoCredit") || "").trim(),
      caption: String(formData.get("photoCaption") || "").trim(),
      permission: formData.has("photoPermission")
    };
    try {
      setAutosaveStatus("Guardando fotografía…");
      await projectStorage.putMany([
        [storageKey("image-meta", imageKey), JSON.stringify(metadata)],
        [storageKey("image", imageKey), result.data],
        [storageKey("done", imageKey.split(".")[0]), null]
      ]);
    } catch (error) {
      setAutosaveStatus("Error al guardar", true);
      showToast(error?.name === "QuotaExceededError" ? "No queda espacio local. La fotografía anterior se conservó; guarda un respaldo." : "No se pudo guardar la fotografía. La imagen anterior se conservó.");
      return;
    }
    const pageId = imageKey.split(".")[0];
    state.pendingImage = null;
    els.imageMetaForm.reset();
    els.imageMeta.close();
    setAutosaveStatus(savedNowLabel());
    invalidatePreflight(pageId);
    renderTree();
    renderMagazine();
    showToast("Fotografía, crédito y permiso guardados.");
  });
  document.getElementById("resetButton").addEventListener("click", async () => {
    const proyecto = projectStorage.active();
    const nombre = String(proyecto?.name || "").trim();
    const escrito = window.prompt(
      `Esto borra todos los textos, fotografías y estados de “${nombre}” y la deja como recién creada. Las demás revistas no cambian.\n\n` +
      "Antes de borrar se descarga un respaldo, pero si esa descarga falla no hay vuelta atrás.\n\n" +
      `Para confirmar, escribe el nombre de la revista: ${nombre}`
    );
    if (escrito === null) return;
    if (escrito.trim() !== nombre) {
      showToast("El nombre no coincide. No se reinició nada.");
      return;
    }
    try {
      await exportDraft({ quiet: true });
      await projectStorage.clearActive();
      undoStack.length = 0;
      resetEditorState();
      setAutosaveStatus("Edición reiniciada");
      renderTree();
      renderMagazine();
      showToast("Esta edición fue reiniciada; el respaldo quedó descargado.");
    } catch (error) {
      setAutosaveStatus("Error al reiniciar", true);
      showToast(error?.message || "No se pudo reiniciar la edición.");
    }
  });
  document.getElementById("collapseAllButton").addEventListener("click", (event) => {
    const groups = [...els.tree.querySelectorAll("details")];
    const shouldOpen = groups.every((group) => !group.open);
    groups.forEach((group) => { group.open = shouldOpen; });
    event.currentTarget.textContent = shouldOpen ? "Cerrar" : "Abrir";
  });
  els.menuButton.addEventListener("click", () => setSidebarOpen(!els.sidebar.classList.contains("is-open")));
  els.sidebarScrim.addEventListener("click", () => setSidebarOpen(false));
  compactQuery.addEventListener("change", (event) => {
    if (event.matches) {
      els.sidebar.inert = true;
      els.sidebar.classList.remove("is-open");
      els.sidebarScrim.hidden = true;
      els.menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
      if (!printPreview) {
        state.zoom = 56;
        updateZoom(56);
        setView("single");
      }
    } else {
      els.sidebar.inert = false;
      els.workspace.inert = false;
      els.topbarActions.inert = false;
      els.sidebar.classList.remove("is-open");
      els.sidebarScrim.hidden = true;
      els.menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
    }
  });
  window.addEventListener("beforeprint", mountPrintLayout);
  window.addEventListener("afterprint", restoreAfterPrint);
  document.getElementById("saveAlertBackup")?.addEventListener("click", () => exportDraft());
  document.getElementById("saveAlertRetry")?.addEventListener("click", async () => {
    try {
      await projectStorage.flush();
      ocultarFalloDeGuardado();
      setAutosaveStatus(savedNowLabel());
      showToast("Los cambios se guardaron correctamente.");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      showToast("Sigue sin poder guardarse. Descarga un respaldo antes de continuar.");
    }
  });
  els.undo?.addEventListener("click", undoLastEdit);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (els.format && !els.format.hidden) { formatoAbrir(false); return; }
      if (els.assistant && !els.assistant.hidden) { asistenteAbrir(false); return; }
      if (els.sidebar.classList.contains("is-open")) setSidebarOpen(false);
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z") {
      const insideField = document.activeElement?.closest?.("[contenteditable='true']");
      if (!insideField && !document.querySelector("dialog[open]") && undoStack.length) {
        event.preventDefault();
        undoLastEdit();
        return;
      }
    }
    const activeElement = document.activeElement;
    const interactive = activeElement?.matches("button, input, select, textarea, a, summary, [contenteditable='true']");
    if (state.editing || interactive || document.querySelector("dialog[open]")) return;
    if (event.key === "ArrowLeft") navigate(-1);
    if (event.key === "ArrowRight") navigate(1);
  });


  // ---------------------------------------------------------------------------
  // Asistente editorial
  //
  // Conoce la pagina abierta, la pauta de su seccion y la extension que pide el
  // programa. Siempre propone: no escribe en la revista. Los datos que no puede
  // conocer los deja entre corchetes, y la revision final ya los detecta como
  // pendientes por completar.
  // ---------------------------------------------------------------------------

  const ASISTENTE_SISTEMA = [
    "Eres el asistente editorial de la revista comunal del Casco Histórico de Puente Alto, Chile,",
    "que publica la Agrupación Barrio Casco Histórico. Es una revista vecinal impresa en A5.",
    "",
    "Reglas que no puedes romper:",
    "- Escribe en castellano de Chile, claro y directo, comprensible para lectores de todas las edades.",
    "- No inventes hechos, cifras, fechas, nombres, cargos ni citas. Si falta un dato, escríbelo entre",
    "  corchetes, por ejemplo [fecha por confirmar] o [nombre del responsable].",
    "- No redactes testimonios, declaraciones ni cartas atribuidas a personas reales.",
    "- No uses lenguaje publicitario ni adjetivos grandilocuentes.",
    "- Distingue siempre lo comprobado de lo que es propuesta u opinión.",
    "- No escribas en primera persona de la agrupación ni en tono de rendición de cuentas.",
    "  Si el texto trata de una gestión de la agrupación, redáctalo en tercera persona y",
    "  señala qué falta comprobar.",
    "- No propongas titulares que el texto no sostenga.",
    "- Si el texto no menciona ninguna fuente identificable, empieza tu respuesta con la",
    "  línea: FALTAN FUENTES.",
    "- Entrega sólo el texto pedido, sin explicaciones previas ni comentarios finales."
  ].join(String.fromCharCode(10));

  const ASISTENTE_VOCES = new Set(["p08", "p09", "p14"]);
  // Hay palabras de personas reales también en las frases destacadas del
  // reportaje, de memoria y del comercio. Redactarlas es fabricar un testimonio.
  const ASISTENTE_CAMPOS_VEDADOS = new Set(["quote", "quoteAuthor", "intro", "a1", "a2", "a3", "body"]);

  const ASISTENTE_TAREAS = {
    borrador: {
      etiqueta: "Redactando un borrador",
      construir: (ctx) => [
        `Redacta un borrador para la página ${ctx.numero} de la revista, sección "${ctx.seccion}".`,
        `Propósito de la sección: ${ctx.proposito}`,
        ctx.pauta ? `Pauta editorial de esta sección: ${ctx.pauta}` : "",
        ctx.rango ? `Extensión objetivo: entre ${ctx.rango.min} y ${ctx.rango.max} palabras.` : "",
        "",
        "Texto actual de la página (puede ser sólo el modelo de muestra):",
        ctx.texto || "(vacío)"
      ].filter(Boolean).join(String.fromCharCode(10))
    },
    extension: {
      etiqueta: "Ajustando la extensión",
      construir: (ctx) => [
        ctx.rango
          ? `El texto de esta página tiene ${ctx.palabras} palabras y el programa pide entre ${ctx.rango.min} y ${ctx.rango.max}.`
          : `El texto de esta página tiene ${ctx.palabras} palabras.`,
        ctx.rango && ctx.palabras < ctx.rango.min
          ? "Si no alcanza el rango porque falta información, NO lo alargues. Entrega la lista de preguntas que hay que responder, los documentos que hay que pedir y a quién hay que consultar para completarlo."
          : "Recórtalo hasta el rango conservando todos los hechos y quitando lo redundante.",
        `Sección: ${ctx.seccion}. ${ctx.proposito}`,
        "",
        "Texto actual:",
        ctx.texto || "(vacío)"
      ].filter(Boolean).join(String.fromCharCode(10))
    },
    titulares: {
      etiqueta: "Proponiendo titulares",
      construir: (ctx) => [
        `Propón cinco opciones de titular con su bajada para la página ${ctx.numero}, sección "${ctx.seccion}".`,
        "El titular no debe pasar de ocho palabras; la bajada, de veinticinco.",
        "Numéralas del 1 al 5, titular en una línea y bajada en la siguiente.",
        "",
        "Contenido de la página:",
        ctx.texto || "(vacío)"
      ].join(String.fromCharCode(10))
    },
    foto: {
      etiqueta: "Escribiendo pie de foto",
      construir: (ctx) => [
        "A partir del contenido de esta página, propón para su fotografía principal:",
        "1. Una descripción accesible de una o dos frases, que cuente qué se ve y qué aporta.",
        "2. Un pie de foto publicable, con quién aparece, dónde y cuándo, dejando entre corchetes lo que no se pueda saber.",
        "",
        `Sección: ${ctx.seccion}. ${ctx.proposito}`,
        "",
        "Contenido de la página:",
        ctx.texto || "(vacío)"
      ].join(String.fromCharCode(10))
    },
    estilo: {
      etiqueta: "Revisando el estilo",
      construir: (ctx) => [
        "Revisa este texto y entrega una lista de observaciones concretas: ortografía, acentuación,",
        "puntuación, coherencia de nombres y fechas, repeticiones y frases confusas.",
        "No reescribas el texto completo: señala qué cambiar y por qué, citando el fragmento.",
        "Si no encuentras problemas, dilo en una línea.",
        "",
        `Sección: ${ctx.seccion}.`,
        "",
        "Texto:",
        ctx.texto || "(vacío)"
      ].join(String.fromCharCode(10))
    }
  };

  let asistenteOcupado = false;
  let asistenteControlador = null;
  const ASISTENTE_ESPERA_MAXIMA = 60_000;

  function asistenteContexto() {
    const page = pages[state.current];
    const elemento = els.host.querySelector(`[data-page-id="${page.id}"]`);
    const campos = elemento
      ? [...elemento.querySelectorAll("[data-edit-key]")]
          .filter((nodo) => !WORD_BUDGET_EXCLUDED.has(String(nodo.dataset.editKey).split(".").at(-1)))
      : [];
    const texto = campos.map((nodo) => nodo.textContent.trim()).filter(Boolean).join(String.fromCharCode(10) + String.fromCharCode(10));
    const budget = PAGE_WORD_BUDGETS[page.id];
    return {
      page,
      numero: page.number,
      seccion: page.segmentTitle,
      proposito: page.segmentPurpose || "",
      pauta: budget ? budget.label : "",
      rango: budget ? { min: budget.min, max: budget.max } : null,
      palabras: countWords(texto),
      texto
    };
  }

  function asistenteRefrescar() {
    if (!els.assistant || els.assistant.hidden) return;
    const ctx = asistenteContexto();
    els.assistantContext.textContent = `Página ${ctx.numero} · ${ctx.seccion}`;
    els.assistantState.textContent = ctx.rango
      ? `${ctx.palabras} palabras · objetivo ${ctx.rango.min}–${ctx.rango.max}`
      : `${ctx.palabras} palabras en esta página`;
    const delicada = ASISTENTE_VOCES.has(ctx.page.id);
    els.assistantCaution.hidden = !delicada;
    if (delicada) {
      els.assistantCaution.textContent = "Esta página recoge palabras de personas identificadas. El asistente puede corregir estilo y proponer preguntas, pero no debe redactar testimonios ni cartas: eso las volvería falsas.";
    }
  }

  async function asistenteEjecutar(tareaId) {
    const tarea = ASISTENTE_TAREAS[tareaId];
    if (!tarea || asistenteOcupado) return;
    asistenteOcupado = true;
    const ctx = asistenteContexto();
    els.assistantResult.hidden = false;
    els.assistantUsage.textContent = "";
    els.assistantOutput.textContent = `${tarea.etiqueta}…`;
    // Sin límite de espera, una red caída a mitad de conexión dejaba la bandera
    // puesta y todos los botones mudos el resto de la sesión.
    const controlador = new AbortController();
    asistenteControlador = controlador;
    const reloj = window.setTimeout(() => controlador.abort(), ASISTENTE_ESPERA_MAXIMA);
    try {
      const respuesta = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controlador.signal,
        body: JSON.stringify({ sistema: ASISTENTE_SISTEMA, mensaje: tarea.construir(ctx) })
      });
      if (asistenteControlador !== controlador) return;
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        els.assistantOutput.textContent = [datos.error, datos.detalle].filter(Boolean).join(String.fromCharCode(10) + String.fromCharCode(10));
        return;
      }
      els.assistantOutput.textContent = datos.texto || "La respuesta llegó vacía.";
      if (datos.uso && datos.uso.entrada != null) {
        els.assistantUsage.textContent = `${datos.uso.entrada} tokens de entrada · ${datos.uso.salida} de salida`;
      }
    } catch (error) {
      if (asistenteControlador !== controlador) return;
      els.assistantOutput.textContent = error?.name === "AbortError"
        ? "El asistente tardó demasiado y se canceló. Vuelve a intentarlo; si sigue igual, comprueba la conexión a internet."
        : "No se pudo contactar el asistente. Comprueba que el taller se abrió con ABRIR_REVISTA.cmd y que hay conexión a internet.";
    } finally {
      window.clearTimeout(reloj);
      if (asistenteControlador === controlador) asistenteControlador = null;
      asistenteOcupado = false;
    }
  }

  function asistenteAbrir(abrir) {
    if (!els.assistant) return;
    els.assistant.hidden = !abrir;
    if (els.assistantButton) els.assistantButton.setAttribute("aria-expanded", String(abrir));
    document.body.classList.toggle("assistant-open", abrir);
    if (!abrir) {
      asistenteControlador?.abort();
      asistenteControlador = null;
      asistenteOcupado = false;
      els.assistantButton?.focus();
      return;
    }
    asistenteRefrescar();
    requestAnimationFrame(() => els.assistant.querySelector(".assistant-action")?.focus());
    fetch("/api/asistente")
      .then((r) => r.json())
      .then((estado) => {
        if (estado.disponible) return;
        els.assistantResult.hidden = false;
        els.assistantOutput.textContent = "Falta la llave de la API. Crea el archivo clave-ia.txt junto a servidor-local.mjs, con la llave dentro, y vuelve a abrir el taller. Ese archivo está excluido de git y no viaja en los respaldos.";
      })
      .catch(() => undefined);
  }

  if (els.assistantButton) {
    els.assistantButton.addEventListener("click", () => asistenteAbrir(els.assistant.hidden));
  }
  const asistenteCerrar = document.getElementById("assistantClose");
  if (asistenteCerrar) asistenteCerrar.addEventListener("click", () => asistenteAbrir(false));
  const asistenteCopiar = document.getElementById("assistantCopy");
  if (asistenteCopiar) {
    asistenteCopiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(els.assistantOutput.textContent || "");
        showToast("Propuesta copiada. Pégala en el campo que corresponda.");
      } catch {
        showToast("No se pudo copiar. Selecciona el texto y usa Ctrl+C.");
      }
    });
  }
  document.querySelectorAll("[data-assistant]").forEach((boton) => {
    boton.addEventListener("click", () => asistenteEjecutar(boton.dataset.assistant));
  });


  // ---------------------------------------------------------------------------
  // Panel de formato
  // ---------------------------------------------------------------------------

  const ENCUADRES = [
    ["left top", "Arriba izquierda"], ["center top", "Arriba"], ["right top", "Arriba derecha"],
    ["left center", "Izquierda"], ["center center", "Centro"], ["right center", "Derecha"],
    ["left bottom", "Abajo izquierda"], ["center bottom", "Abajo"], ["right bottom", "Abajo derecha"]
  ];

  function formatoObjetivo() {
    return state.formatTarget || null;
  }

  function formatoElemento() {
    const objetivo = formatoObjetivo();
    if (!objetivo) return null;
    const atributo = objetivo.tipo === "texto" ? "data-edit-key" : "data-image-key";
    return els.host.querySelector(`[${atributo}="${CSS.escape(objetivo.clave)}"]`);
  }

  function formatoPartes(clave) {
    const punto = String(clave).indexOf(".");
    return { pageId: String(clave).slice(0, punto), key: String(clave).slice(punto + 1) };
  }

  function formatoSeleccionar(tipo, clave) {
    state.formatTarget = clave ? { tipo, clave } : null;
    els.host.querySelectorAll(".is-format-target").forEach((n) => n.classList.remove("is-format-target"));
    const elemento = formatoElemento();
    if (elemento) elemento.classList.add("is-format-target");
    formatoRefrescar();
  }

  function formatoBoton(etiqueta, accion, valor, activo, titulo) {
    return `<button type="button" class="fmt-chip${activo ? " is-active" : ""}" data-fmt="${accion}" data-valor="${escapeHtml(String(valor))}"${titulo ? ` title="${escapeHtml(titulo)}"` : ""}>${escapeHtml(etiqueta)}</button>`;
  }

  function formatoControlesTexto(pageId, key, elemento) {
    const estilo = estiloTexto(pageId, key) || {};
    const cuerpoActual = Math.round(parseFloat(getComputedStyle(elemento).fontSize) / (96 / 72) * 10) / 10;
    const familias = Object.entries(TIPOGRAFIAS)
      .map(([id, f]) => formatoBoton(f.etiqueta, "familia", id, estilo.familia === id)).join("");
    const colores = COLORES_IDENTIDAD
      .map((c) => `<button type="button" class="fmt-color${estilo.color === c.valor ? " is-active" : ""}" data-fmt="color" data-valor="${c.valor}" title="${escapeHtml(c.etiqueta)}" style="background:${c.valor}"><span class="sr-only">${escapeHtml(c.etiqueta)}</span></button>`).join("");
    const alineaciones = ALINEACIONES
      .map((a) => formatoBoton(a.etiqueta, "alineacion", a.valor, estilo.alineacion === a.valor)).join("");
    return `
      <div class="fmt-group"><h3>Tipografía</h3><div class="fmt-row">${familias}</div></div>
      <div class="fmt-group"><h3>Cuerpo</h3><div class="fmt-row fmt-row--stepper">
        <button type="button" class="fmt-step" data-fmt="cuerpo" data-valor="-0.5" aria-label="Reducir el cuerpo">−</button>
        <output>${cuerpoActual} pt</output>
        <button type="button" class="fmt-step" data-fmt="cuerpo" data-valor="0.5" aria-label="Aumentar el cuerpo">+</button>
      </div></div>
      <div class="fmt-group"><h3>Interlineado</h3><div class="fmt-row fmt-row--stepper">
        <button type="button" class="fmt-step" data-fmt="interlineado" data-valor="-0.05" aria-label="Juntar las líneas">−</button>
        <output>${(estilo.interlineado || Math.round(parseFloat(getComputedStyle(elemento).lineHeight) / parseFloat(getComputedStyle(elemento).fontSize) * 100) / 100).toFixed(2)}</output>
        <button type="button" class="fmt-step" data-fmt="interlineado" data-valor="0.05" aria-label="Separar las líneas">+</button>
      </div></div>
      <div class="fmt-group"><h3>Color</h3><div class="fmt-row fmt-row--colors">${colores}</div></div>
      <div class="fmt-group"><h3>Alineación</h3><div class="fmt-row">${alineaciones}</div></div>
      <div class="fmt-group"><h3>Énfasis</h3><div class="fmt-row">
        ${formatoBoton("Negrita", "negrita", "1", estilo.negrita === true)}
        ${formatoBoton("Cursiva", "cursiva", "1", estilo.cursiva === true)}
        ${formatoBoton("Subrayado", "subrayado", "1", estilo.subrayado === true)}
      </div></div>`;
  }

  function formatoControlesImagen(pageId, slot, elemento) {
    const marco = marcoImagen(pageId, slot) || {};
    const metadata = imageMetadata(`${pageId}.${slot}`);
    const alturaActual = marco.altura || Math.round(elemento.getBoundingClientRect().height / (els.host.querySelector(".mag-page").getBoundingClientRect().height / 210));
    const encuadres = ENCUADRES.map(([valor, etiqueta]) =>
      `<button type="button" class="fmt-frame${(marco.encuadre || "center center") === valor ? " is-active" : ""}" data-fmt="encuadre" data-valor="${valor}" title="${escapeHtml(etiqueta)}"><span class="sr-only">${escapeHtml(etiqueta)}</span></button>`).join("");
    const tratamientos = TRATAMIENTOS
      .map((t) => formatoBoton(t.etiqueta, "tratamiento", t.valor, (marco.tratamiento || "color") === t.valor)).join("");
    const encaje = [
      formatoBoton("Llenar", "encaje", "cover", (metadata?.fit || "cover") === "cover", "Recorta lo que sobra. Para fotografías."),
      formatoBoton("Completa", "encaje", "contain", metadata?.fit === "contain", "No recorta nada. Para logotipos y avisos.")
    ].join("");
    return `
      <div class="fmt-group"><h3>Encaje</h3><div class="fmt-row">${encaje}</div></div>
      <div class="fmt-group"><h3>Encuadre</h3><div class="fmt-frames">${encuadres}</div>
        <p class="fmt-hint">Qué parte de la fotografía se conserva al recortar.</p></div>
      <div class="fmt-group"><h3>Altura del espacio</h3><div class="fmt-row fmt-row--stepper">
        <button type="button" class="fmt-step" data-fmt="altura" data-valor="-2" aria-label="Reducir la altura">−</button>
        <output>${alturaActual} mm</output>
        <button type="button" class="fmt-step" data-fmt="altura" data-valor="2" aria-label="Aumentar la altura">+</button>
      </div></div>
      <div class="fmt-group"><h3>Tratamiento</h3><div class="fmt-row">${tratamientos}</div></div>
      <div class="fmt-group"><div class="fmt-row">
        <button type="button" class="button button--small button--ghost" data-fmt="cambiar-foto">Cambiar fotografía</button>
      </div></div>`;
  }

  function formatoRefrescar() {
    if (!els.format || els.format.hidden) return;
    const objetivo = formatoObjetivo();
    const elemento = formatoElemento();
    if (!objetivo || !elemento) {
      els.formatContext.textContent = "Nada seleccionado";
      els.formatBody.innerHTML = `<p class="fmt-empty">Pulsa un texto o una fotografía de la revista para darle formato. Necesitas estar en modo <strong>Editar</strong>.</p>`;
      return;
    }
    const { pageId, key } = formatoPartes(objetivo.clave);
    const page = pages.find((p) => p.id === pageId);
    els.formatContext.textContent = objetivo.tipo === "texto"
      ? `Página ${page ? page.number : "?"} · ${humanFieldLabel(key)}`
      : `Página ${page ? page.number : "?"} · fotografía`;
    els.formatBody.innerHTML = objetivo.tipo === "texto"
      ? formatoControlesTexto(pageId, key, elemento)
      : formatoControlesImagen(pageId, key, elemento);
  }

  function formatoGuardar(cambios, esImagen) {
    const objetivo = formatoObjetivo();
    if (!objetivo) return;
    const { pageId, key } = formatoPartes(objetivo.clave);
    const sufijo = esImagen ? MARCO_SUFIJO : ESTILO_SUFIJO;
    const actual = leerRegistro(pageId, key, sufijo) || {};
    const siguiente = { ...actual, ...cambios };
    Object.keys(siguiente).forEach((k) => {
      if (siguiente[k] === null || siguiente[k] === undefined) delete siguiente[k];
    });
    try {
      guardarRegistro(pageId, key, sufijo, siguiente);
      setAutosaveStatus("Guardando…");
    } catch {
      setAutosaveStatus("Error al guardar", true);
      showToast("No se pudo guardar el formato.");
      return;
    }
    markPageDirty(pageId);
    renderMagazine();
    requestAnimationFrame(() => formatoSeleccionar(objetivo.tipo, objetivo.clave));
  }

  function formatoAccion(accion, valor) {
    const objetivo = formatoObjetivo();
    if (!objetivo) return;
    const { pageId, key } = formatoPartes(objetivo.clave);
    const elemento = formatoElemento();

    if (accion === "cambiar-foto") {
      state.activeImageKey = objetivo.clave;
      els.imageFile.click();
      return;
    }
    if (accion === "encaje") {
      const metadata = imageMetadata(objetivo.clave) || {};
      try {
        projectStorage.setItem(storageKey("image-meta", objetivo.clave), JSON.stringify({ ...metadata, fit: valor }));
      } catch {
        showToast("No se pudo guardar el encaje.");
        return;
      }
      markPageDirty(pageId);
      renderMagazine();
      requestAnimationFrame(() => formatoSeleccionar(objetivo.tipo, objetivo.clave));
      return;
    }
    if (accion === "encuadre") { formatoGuardar({ encuadre: valor }, true); return; }
    if (accion === "tratamiento") { formatoGuardar({ tratamiento: valor === "color" ? null : valor }, true); return; }
    if (accion === "altura") {
      const marco = marcoImagen(pageId, key) || {};
      const base = marco.altura || Math.round(elemento.getBoundingClientRect().height / (els.host.querySelector(".mag-page").getBoundingClientRect().height / 210));
      const siguiente = Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, base + Number(valor)));
      formatoGuardar({ altura: siguiente }, true);
      return;
    }
    if (accion === "familia") {
      const estilo = estiloTexto(pageId, key) || {};
      formatoGuardar({ familia: estilo.familia === valor ? null : valor }, false);
      return;
    }
    if (accion === "color") {
      const estilo = estiloTexto(pageId, key) || {};
      formatoGuardar({ color: estilo.color === valor ? null : valor }, false);
      return;
    }
    if (accion === "alineacion") {
      const estilo = estiloTexto(pageId, key) || {};
      formatoGuardar({ alineacion: estilo.alineacion === valor ? null : valor }, false);
      return;
    }
    if (accion === "negrita" || accion === "cursiva" || accion === "subrayado") {
      const estilo = estiloTexto(pageId, key) || {};
      formatoGuardar({ [accion]: estilo[accion] === true ? null : true }, false);
      return;
    }
    if (accion === "cuerpo") {
      const estilo = estiloTexto(pageId, key) || {};
      const base = estilo.cuerpo || parseFloat(getComputedStyle(elemento).fontSize) / (96 / 72);
      const siguiente = Math.round(Math.min(CUERPO_MAX, Math.max(CUERPO_MIN, base + Number(valor))) * 10) / 10;
      formatoGuardar({ cuerpo: siguiente }, false);
      return;
    }
    if (accion === "interlineado") {
      const estilo = estiloTexto(pageId, key) || {};
      const cs = getComputedStyle(elemento);
      const base = estilo.interlineado || (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize));
      const siguiente = Math.round(Math.min(2.6, Math.max(0.85, base + Number(valor))) * 100) / 100;
      formatoGuardar({ interlineado: siguiente }, false);
    }
  }

  function formatoRestablecer() {
    const objetivo = formatoObjetivo();
    if (!objetivo) return;
    const { pageId, key } = formatoPartes(objetivo.clave);
    guardarRegistro(pageId, key, objetivo.tipo === "texto" ? ESTILO_SUFIJO : MARCO_SUFIJO, null);
    setAutosaveStatus("Guardando…");
    markPageDirty(pageId);
    renderMagazine();
    requestAnimationFrame(() => formatoSeleccionar(objetivo.tipo, objetivo.clave));
    showToast("Formato restablecido al de la maqueta.");
  }

  function formatoAbrir(abrir) {
    if (!els.format) return;
    els.format.hidden = !abrir;
    if (els.formatButton) els.formatButton.setAttribute("aria-expanded", String(abrir));
    document.body.classList.toggle("format-open", abrir);
    if (abrir) {
      if (!state.editing) setEditing(true, false);
      formatoRefrescar();
    } else {
      state.formatTarget = null;
      els.host.querySelectorAll(".is-format-target").forEach((n) => n.classList.remove("is-format-target"));
      els.formatButton?.focus();
    }
  }

  if (els.formatButton) els.formatButton.addEventListener("click", () => formatoAbrir(els.format.hidden));
  const formatoCerrar = document.getElementById("formatClose");
  if (formatoCerrar) formatoCerrar.addEventListener("click", () => formatoAbrir(false));
  const formatoReset = document.getElementById("formatReset");
  if (formatoReset) formatoReset.addEventListener("click", formatoRestablecer);
  if (els.formatBody) {
    els.formatBody.addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-fmt]");
      if (boton) formatoAccion(boton.dataset.fmt, boton.dataset.valor);
    });
  }


  // ---------------------------------------------------------------------------
  // Guía de primer uso
  //
  // No había ninguna orientación dentro del programa: el orden correcto sólo
  // estaba en LEEME_PRIMERO.md, y el lanzador abre una ventana sin barra de
  // direcciones desde la que no se puede llegar a la documentación. Los cinco
  // pasos se marcan solos según el avance real, y el panel se recuerda plegado
  // por edición para no estorbar a quien ya sabe.
  // ---------------------------------------------------------------------------

  const GUIA_PLEGADA = "taller:guia-plegada";

  function guiaEstado() {
    const settings = issueSettings();
    const datosListos = settings.verified === true
      && ["edition", "responsible", "email", "whatsapp", "closingDate", "location"]
        .every((clave) => String(settings[clave] || "").trim());

    let conMuestra = 0;
    let sinFoto = 0;
    pages.forEach((page) => {
      const elemento = els.host.querySelector(`[data-page-id="${page.id}"]`);
      if (!elemento) return;
      if ([...elemento.querySelectorAll("[data-edit-key]")].some((n) => isModelText(n.dataset.editKey, n.textContent))) conMuestra += 1;
    });
    [...IMAGE_SLOTS].forEach((slotKey) => {
      if (slotKey === LOGO_KEY) return;
      const [pageId, slot] = slotKey.split(".");
      if (slot === "ad") return;
      if (!imageData(pageId, slot)) sinFoto += 1;
    });

    const listas = pages.filter((page) => projectStorage.getItem(storageKey("done", page.id)) === "1").length;
    return {
      datos: datosListos,
      textos: conMuestra === 0,
      fotos: sinFoto === 0,
      listas: listas === pages.length,
      pdf: false,
      listasCuantas: listas
    };
  }

  function guiaRefrescar() {
    const panel = document.getElementById("guidePanel");
    if (!panel || panel.hidden) return;
    const estado = guiaEstado();
    let hechos = 0;
    panel.querySelectorAll("[data-guide]").forEach((paso) => {
      const hecho = estado[paso.dataset.guide] === true;
      paso.classList.toggle("is-done", hecho);
      if (hecho) hechos += 1;
    });
    const progreso = document.getElementById("guideProgress");
    if (progreso) {
      progreso.textContent = hechos === 0
        ? "Cinco pasos, en este orden."
        : `${hechos} de 5 pasos completos · ${estado.listasCuantas} de ${pages.length} páginas listas.`;
    }
  }

  function guiaPlegar(plegar) {
    const pasos = document.getElementById("guideSteps");
    const boton = document.getElementById("guideToggle");
    const pie = document.querySelector(".guia__foot");
    if (!pasos || !boton) return;
    pasos.hidden = plegar;
    if (pie) pie.hidden = plegar;
    boton.textContent = plegar ? "Mostrar" : "Ocultar";
    boton.setAttribute("aria-expanded", String(!plegar));
    try {
      window.localStorage.setItem(GUIA_PLEGADA, plegar ? "1" : "0");
    } catch {
      // Recordar el pliegue es una comodidad, no un dato de la revista.
    }
  }

  document.getElementById("guideToggle")?.addEventListener("click", () => {
    guiaPlegar(!document.getElementById("guideSteps")?.hidden === true);
  });

  (function restaurarPliegueGuia() {
    let preferencia = null;
    try {
      preferencia = window.localStorage.getItem(GUIA_PLEGADA);
    } catch {
      preferencia = null;
    }
    // Plegada por omisión: el área de trabajo es para trabajar.
    guiaPlegar(preferencia !== "0");
  })();

  if (compactQuery.matches) els.sidebar.inert = true;
  syncEditButton();
  if (printPreview) {
    resetEditorState();
    showEditor({ focus: false });
  } else {
    await showProjectHome({ focus: false });
  }
})().catch((error) => {
  console.error(error);
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = error?.message || "El taller editorial encontró un error inesperado.";
    toast.classList.add("is-visible");
  }
});
