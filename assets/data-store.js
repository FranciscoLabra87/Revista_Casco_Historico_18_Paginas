(function () {
  "use strict";

  const DB_NAME = "casco-revista-studio";
  const DB_VERSION = 1;
  const EDITIONS_STORE = "editions";
  const RECORDS_STORE = "records";
  const TEMPLATE_ID = "casco-18";
  const TEMPLATE_VERSION = 1;
  const MAX_EDITIONS = 40;
  const MAX_ENTRIES = 1_000;
  const MAX_TOTAL_CHARACTERS = 40_000_000;
  const MAX_TEXT_CHARACTERS = 100_000;
  const MAX_IMAGE_CHARACTERS = 6_300_000;
  const AUTOSAVE_DELAY = 400;
  const FORMAT = "revista-casco-historico-v2";
  const ACTIVE_ID_KEY = "casco-revista:data-store:active-id";
  const MIGRATION_KEY = "casco-revista:data-store:migration-v1";
  const LEGACY_EDITION_ID = "ed_legacy_v1";
  const LEGACY_KEY_PATTERN = /^casco-revista:(text|image|image-meta|done|settings):(.+)$/;
  const LEGACY_16_PAGE_MAP = Object.freeze({
    p01: "p01", p02: "p02", p03: "p03", p04: "p06", p05: "p07", p06: "p04",
    p07: "p08", p08: "p09", p09: "p10", p10: "p12", p11: "p13", p12: "p14",
    p13: "p15", p14: "p16", p15: "p17", p16: "p18"
  });
  const LEGACY_16_MARKERS = [
    "text:p16.tagline", "text:p16.contact1", "text:p15.primaryTitle", "text:p04.body1",
    "text:p07.intro", "text:p08.q3", "text:p10.block1Title", "text:p11.contact",
    "text:p14.callout", "image:p04.main", "image:p05.support", "image:p07.portrait",
    "image:p08.context", "image:p09.historic", "image:p10.service", "image:p11.commerce", "image:p14.culture"
  ];
  const CURRENT_18_MARKERS = [
    "text:p18.tagline", "text:p18.contact1", "text:p17.primaryTitle", "text:p05.nextTitle",
    "text:p06.body1", "text:p08.intro", "text:p09.q3", "text:p11.caption", "image:p05.progress",
    "image:p06.main", "image:p07.support", "image:p08.portrait", "image:p09.context",
    "image:p10.historic", "image:p11.memory", "image:p12.service", "image:p13.commerce", "image:p16.culture"
  ];
  const INTERNAL_ID_PATTERN = /^ed_[a-z0-9_-]{8,80}$/;
  const IMAGE_IDENTIFIER_PATTERN = /^(?:p[a-z0-9]{2,22}|brand)\.[A-Za-z0-9_-]{1,80}$/;
  const RELATIVE_KEY_PATTERN = /^(text|image|image-meta|done|settings):([A-Za-z0-9._-]{1,180})$/;
  const DATA_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i;
  const DELETE_VALUE = Symbol("delete-record");

  let database = null;
  let initialized = false;
  let initPromise = null;
  let activeEditionId = null;
  let activeRecords = new Map();
  let editions = new Map();
  let pendingWrites = new Map();
  let autosaveTimer = null;
  let flushPromise = null;
  let migrationNotice = null;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error || new Error("Falló una operación de almacenamiento.")), { once: true });
    });
  }

  function transactionResult(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error || new Error("La operación de almacenamiento fue cancelada.")), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error || new Error("Falló una transacción de almacenamiento.")), { once: true });
    });
  }

  function openDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("Este navegador no permite guardar ediciones en este equipo."));

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(EDITIONS_STORE)) {
          const store = db.createObjectStore(EDITIONS_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("trashedAt", "trashedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          const store = db.createObjectStore(RECORDS_STORE, { keyPath: ["editionId", "key"] });
          store.createIndex("editionId", "editionId", { unique: false });
        }
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error || new Error("No se pudo abrir el almacenamiento local.")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Cierra las otras ventanas del editor para actualizar el almacenamiento.")), { once: true });
    });
  }

  function safeLocalGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeLocalSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // IndexedDB sigue siendo la fuente de verdad aunque no se recuerde esta preferencia.
    }
  }

  function safeLocalRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // La ausencia de esta preferencia no afecta los datos de las ediciones.
    }
  }

  function storageEvent(state, error) {
    const detail = {
      state,
      editionId: activeEditionId,
      at: new Date().toISOString()
    };
    if (error) detail.message = error instanceof Error ? error.message : String(error);
    window.dispatchEvent(new CustomEvent("magazine-storage-state", { detail }));
  }

  function cleanLabel(value, label, maximum) {
    const raw = String(value ?? "");
    if (/[<>]/.test(raw)) throw new TypeError(`${label} no puede contener código HTML.`);
    const normalized = [...raw]
      .map((character) => {
        const code = character.codePointAt(0);
        return code < 32 || code === 127 ? " " : character;
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) throw new TypeError(`${label} es obligatorio.`);
    if (normalized.length > maximum) throw new RangeError(`${label} es demasiado largo.`);
    return normalized;
  }

  function cleanName(value) {
    return cleanLabel(value, "El nombre", 120);
  }

  function cleanEdition(value, fallback) {
    return cleanLabel(value ?? fallback, "La edición", 180);
  }

  function validateInternalId(id) {
    const normalized = String(id || "");
    if (!INTERNAL_ID_PATTERN.test(normalized)) throw new TypeError("El identificador interno no es válido.");
    return normalized;
  }

  function generateId() {
    const random = window.crypto?.randomUUID?.().replaceAll("-", "")
      || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
    return `ed_${random.toLowerCase()}`;
  }

  function validateRelativeKey(relativeKey) {
    const key = String(relativeKey || "");
    const match = key.match(RELATIVE_KEY_PATTERN);
    if (!match) throw new TypeError("La clave editorial no es válida.");
    return { key, kind: match[1], identifier: match[2] };
  }

  function validateRelativeEntry(relativeKey, value) {
    const { key, kind, identifier } = validateRelativeKey(relativeKey);
    if (typeof value !== "string") throw new TypeError("El contenido editorial debe ser texto.");
    if (kind === "text") {
      if (!/^p[a-z0-9]{2,22}\.[A-Za-z0-9._-]{1,160}$/.test(identifier) || value.length > MAX_TEXT_CHARACTERS) {
        throw new TypeError("El campo de texto no es válido.");
      }
    } else if (kind === "image") {
      if (!IMAGE_IDENTIFIER_PATTERN.test(identifier)
        || value.length > MAX_IMAGE_CHARACTERS
        || !DATA_IMAGE_PATTERN.test(value)) {
        throw new TypeError("La fotografía no es válida.");
      }
    } else if (kind === "image-meta") {
      if (!IMAGE_IDENTIFIER_PATTERN.test(identifier) || value.length > 20_000) {
        throw new TypeError("La ficha fotográfica no es válida.");
      }
      let metadata;
      try {
        metadata = JSON.parse(value);
      } catch {
        throw new TypeError("La ficha fotográfica no contiene JSON válido.");
      }
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        throw new TypeError("La ficha fotográfica no es válida.");
      }
    } else if (kind === "done") {
      if (!/^p[a-z0-9]{2,22}$/.test(identifier) || value !== "1") throw new TypeError("El estado de página no es válido.");
    } else if (kind === "settings") {
      // "issue" son los datos de la edición; "estructura", las secciones que
      // el equipo armó. La estructura puede ser larga, porque lleva una
      // entrada por página.
      const AJUSTES_VALIDOS = { issue: 20_000, estructura: 200_000 };
      const tope = AJUSTES_VALIDOS[identifier];
      if (!tope || value.length > tope) throw new TypeError("Los datos de edición no son válidos.");
      let settings;
      try {
        settings = JSON.parse(value);
      } catch {
        throw new TypeError("Los datos de edición no contienen JSON válido.");
      }
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new TypeError("Los datos de edición no son válidos.");
      }
    }
    return key;
  }

  function normalizeEntries(input) {
    let rawEntries;
    if (input instanceof Map) rawEntries = [...input.entries()];
    else if (Array.isArray(input)) rawEntries = input;
    else if (input && typeof input === "object") rawEntries = Object.entries(input);
    else throw new TypeError("La colección de contenidos no es válida.");

    if (rawEntries.length > MAX_ENTRIES) throw new RangeError("La edición contiene demasiados elementos.");
    const normalized = new Map();
    let totalCharacters = 0;
    rawEntries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError("Una actualización editorial no es válida.");
      const [rawKey, value] = entry;
      const key = String(rawKey || "");
      if (value === null || value === undefined) {
        validateRelativeKey(key);
        normalized.set(key, DELETE_VALUE);
        return;
      }
      validateRelativeEntry(key, value);
      totalCharacters += key.length + value.length;
      if (totalCharacters > MAX_TOTAL_CHARACTERS) throw new RangeError("La edición excede el tamaño máximo permitido.");
      normalized.set(key, value);
    });
    return normalized;
  }

  function assertRecordCollectionLimits(records) {
    if (records.size > MAX_ENTRIES) throw new RangeError("La edición contiene demasiados elementos.");
    let totalCharacters = 0;
    records.forEach((value, key) => {
      if (value === DELETE_VALUE) return;
      totalCharacters += key.length + value.length;
      if (totalCharacters > MAX_TOTAL_CHARACTERS) throw new RangeError("La edición excede el tamaño máximo permitido.");
    });
  }

  function cloneEdition(edition) {
    return edition ? { ...edition } : null;
  }

  function active() {
    return cloneEdition(editions.get(activeEditionId));
  }

  function list(options = {}) {
    const showTrashed = options.trashed === true;
    return [...editions.values()]
      .filter((edition) => Boolean(edition.trashedAt) === showTrashed)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(cloneEdition);
  }

  async function loadEditions() {
    const transaction = database.transaction(EDITIONS_STORE, "readonly");
    const done = transactionResult(transaction);
    const result = await requestResult(transaction.objectStore(EDITIONS_STORE).getAll());
    await done;
    editions = new Map(result.map((edition) => [edition.id, edition]));
  }

  async function readRecords(editionId) {
    const transaction = database.transaction(RECORDS_STORE, "readonly");
    const done = transactionResult(transaction);
    const records = await requestResult(transaction.objectStore(RECORDS_STORE).index("editionId").getAll(editionId));
    await done;
    return new Map(records.map((record) => [record.key, record.value]));
  }

  function deleteRecords(transaction, editionId) {
    return new Promise((resolve, reject) => {
      const request = transaction.objectStore(RECORDS_STORE).index("editionId").openCursor(editionId);
      request.addEventListener("error", () => reject(request.error || new Error("No se pudieron eliminar los contenidos.")), { once: true });
      request.addEventListener("success", () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      });
    });
  }

  function editionFromSettings(edition, updates) {
    if (!updates.has("settings:issue") || updates.get("settings:issue") === DELETE_VALUE) return edition;
    try {
      const settings = JSON.parse(updates.get("settings:issue"));
      if (!settings?.edition) return edition;
      return { ...edition, edition: cleanEdition(settings.edition, edition.edition) };
    } catch {
      return edition;
    }
  }

  function editionWithRecordSummary(edition, records) {
    const completedPages = [...records.entries()]
      .filter(([key, value]) => key.startsWith("done:") && value === "1")
      .length;
    return {
      ...edition,
      completedPages,
      recordCount: records.size
    };
  }

  async function writeEditionWithEntries(edition, records) {
    if (editions.size >= MAX_EDITIONS) throw new RangeError(`Sólo se pueden conservar ${MAX_EDITIONS} ediciones en este equipo.`);
    assertRecordCollectionLimits(records);
    const summarizedEdition = editionWithRecordSummary(edition, records);
    const transaction = database.transaction([EDITIONS_STORE, RECORDS_STORE], "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).add(summarizedEdition);
    const recordStore = transaction.objectStore(RECORDS_STORE);
    records.forEach((value, key) => {
      if (value !== DELETE_VALUE) recordStore.add({ editionId: summarizedEdition.id, key, value, updatedAt: summarizedEdition.updatedAt });
    });
    await done;
    editions.set(summarizedEdition.id, summarizedEdition);
    return summarizedEdition;
  }

  function legacyEntries(forcedPageCount = null) {
    const found = new Map();
    let totalCharacters = 0;
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const storageKey = window.localStorage.key(index);
        const match = storageKey?.match(LEGACY_KEY_PATTERN);
        if (!match) continue;
        const value = window.localStorage.getItem(storageKey);
        if (typeof value !== "string") continue;
        const relativeKey = `${match[1]}:${match[2]}`;
        validateRelativeEntry(relativeKey, value);
        totalCharacters += relativeKey.length + value.length;
        if (found.size >= MAX_ENTRIES || totalCharacters > MAX_TOTAL_CHARACTERS) {
          throw new RangeError("El borrador antiguo excede el tamaño permitido.");
        }
        found.set(relativeKey, value);
      }
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) throw error;
      return new Map();
    }
    const oldProgram = LEGACY_16_MARKERS.some((key) => found.has(key));
    const currentProgram = CURRENT_18_MARKERS.some((key) => found.has(key));
    const hasAffectedPages = [...found.keys()].some((relativeKey) => {
      const identifier = relativeKey.slice(relativeKey.indexOf(":") + 1);
      const match = identifier.match(/^p(\d{2})(?:\.|$)/);
      return match && Number(match[1]) >= 4;
    });
    if (forcedPageCount === 18 || currentProgram) return found;
    if (forcedPageCount !== 16 && !oldProgram) {
      if (hasAffectedPages) {
        const error = new Error("El borrador antiguo no indica si corresponde al programa de 16 o de 18 páginas.");
        error.code = "LEGACY_PROGRAM_AMBIGUOUS";
        throw error;
      }
      return found;
    }
    const remapped = new Map();
    found.forEach((value, relativeKey) => {
      const separator = relativeKey.indexOf(":");
      const kind = relativeKey.slice(0, separator);
      const identifier = relativeKey.slice(separator + 1);
      if (kind === "settings") {
        remapped.set(relativeKey, value);
        return;
      }
      const pageId = identifier.split(".")[0];
      const mappedPageId = LEGACY_16_PAGE_MAP[pageId];
      const mappedKey = mappedPageId
        ? `${kind}:${mappedPageId}${identifier.slice(pageId.length)}`
        : relativeKey;
      remapped.set(mappedKey, value);
    });
    return remapped;
  }

  function legacyEditionLabel(records) {
    try {
      const settings = JSON.parse(records.get("settings:issue") || "{}");
      if (settings?.edition) return cleanEdition(settings.edition, "Edición recuperada");
    } catch {
      // El validador ya comprobó el JSON; este fallback protege datos heredados incompletos.
    }
    return "Edición recuperada";
  }

  async function writeLegacyEdition(records) {
    const now = new Date().toISOString();
    const migrated = {
      id: LEGACY_EDITION_ID,
      name: "Edición recuperada",
      edition: legacyEditionLabel(records),
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      migratedFrom: "casco-revista-v1"
    };
    await writeEditionWithEntries(migrated, records);
    safeLocalSet(MIGRATION_KEY, "migrated");
    return migrated;
  }

  async function migrateLegacy(forcedPageCount = null) {
    if (safeLocalGet(MIGRATION_KEY)) return false;
    if (editions.has(LEGACY_EDITION_ID)) {
      safeLocalSet(MIGRATION_KEY, "migrated");
      return false;
    }

    const records = legacyEntries(forcedPageCount);
    if (!records.size) {
      safeLocalSet(MIGRATION_KEY, "empty");
      return false;
    }

    await writeLegacyEdition(records);
    return true;
  }

  async function setActiveInternal(id) {
    if (id === null) {
      activeEditionId = null;
      activeRecords = new Map();
      pendingWrites = new Map();
      safeLocalRemove(ACTIVE_ID_KEY);
      return null;
    }
    const validId = validateInternalId(id);
    const edition = editions.get(validId);
    if (!edition) throw new Error("La edición solicitada no existe.");
    if (edition.trashedAt) throw new Error("Restaura la edición antes de abrirla.");
    activeRecords = await readRecords(validId);
    activeEditionId = validId;
    pendingWrites = new Map();
    safeLocalSet(ACTIVE_ID_KEY, validId);
    storageEvent("saved");
    return cloneEdition(edition);
  }

  async function createInternal({ name, edition, entries: initialEntries }, activate) {
    const safeName = cleanName(name);
    const safeEdition = cleanEdition(edition, safeName);
    const initialRecords = initialEntries ? normalizeEntries(initialEntries) : new Map();
    const now = new Date().toISOString();
    let id = generateId();
    while (editions.has(id)) id = generateId();
    const record = {
      id,
      name: safeName,
      edition: safeEdition,
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      createdAt: now,
      updatedAt: now,
      trashedAt: null
    };
    await writeEditionWithEntries(record, initialRecords);
    if (activate) await setActiveInternal(id);
    return cloneEdition(record);
  }

  async function init() {
    if (initialized) return active();
    if (initPromise) return initPromise;

    initPromise = (async () => {
      database = await openDatabase();
      database.addEventListener("versionchange", () => database.close());
      await loadEditions();
      try {
        await migrateLegacy();
      } catch (error) {
        if (error?.code === "LEGACY_PROGRAM_AMBIGUOUS") {
          migrationNotice = { code: error.code, message: error.message };
        }
        storageEvent("error", error);
      }

      initialized = true;
      if (!editions.size) {
        await createInternal({
          name: "Edición piloto",
          edition: "Edición N.° 1 · Mes 2026"
        }, true);
        return active();
      }

      const remembered = safeLocalGet(ACTIVE_ID_KEY);
      const fallback = list()[0]?.id || null;
      const target = remembered && editions.get(remembered) && !editions.get(remembered).trashedAt
        ? remembered
        : fallback;
      await setActiveInternal(target);
      return active();
    })();

    try {
      return await initPromise;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  }

  async function ensureInitialized() {
    if (!initialized) await init();
  }

  function notice() {
    return migrationNotice ? { ...migrationNotice } : null;
  }

  async function recoverLegacy(pageCount) {
    await ensureInitialized();
    if (pageCount !== 16 && pageCount !== 18) throw new TypeError("Debes elegir 16 o 18 páginas.");
    if (editions.has(LEGACY_EDITION_ID)) {
      await setActiveInternal(LEGACY_EDITION_ID);
      migrationNotice = null;
      return active();
    }
    const records = legacyEntries(pageCount);
    if (!records.size) throw new Error("No se encontraron datos antiguos para recuperar.");
    await writeLegacyEdition(records);
    migrationNotice = null;
    await setActiveInternal(LEGACY_EDITION_ID);
    return active();
  }

  function requireActive() {
    const edition = editions.get(activeEditionId);
    if (!edition || edition.trashedAt) throw new Error("No hay una edición activa.");
    return edition;
  }

  function getItem(relativeKey) {
    const { key } = validateRelativeKey(relativeKey);
    return activeRecords.has(key) ? activeRecords.get(key) : null;
  }

  function scheduleFlush() {
    clearTimeout(autosaveTimer);
    storageEvent("saving");
    autosaveTimer = window.setTimeout(() => {
      flush().catch(() => {
        // El evento de error ya permite que la interfaz ofrezca reintento o respaldo.
      });
    }, AUTOSAVE_DELAY);
  }

  function setItem(relativeKey, value) {
    requireActive();
    const key = validateRelativeEntry(relativeKey, value);
    const nextRecords = new Map(activeRecords);
    nextRecords.set(key, value);
    assertRecordCollectionLimits(nextRecords);
    activeRecords.set(key, value);
    pendingWrites.set(key, value);
    scheduleFlush();
    return value;
  }

  function removeItem(relativeKey) {
    requireActive();
    const { key } = validateRelativeKey(relativeKey);
    activeRecords.delete(key);
    pendingWrites.set(key, DELETE_VALUE);
    scheduleFlush();
  }

  function entries() {
    return [...activeRecords.entries()];
  }

  async function writeActiveBatch(updates) {
    const current = requireActive();
    const now = new Date().toISOString();
    const nextRecords = new Map(activeRecords);
    updates.forEach((value, key) => {
      if (value === DELETE_VALUE) nextRecords.delete(key);
      else nextRecords.set(key, value);
    });
    const updatedEdition = editionWithRecordSummary(
      editionFromSettings({ ...current, updatedAt: now }, updates),
      nextRecords
    );
    const transaction = database.transaction([EDITIONS_STORE, RECORDS_STORE], "readwrite");
    const done = transactionResult(transaction);
    const recordStore = transaction.objectStore(RECORDS_STORE);
    updates.forEach((value, key) => {
      if (value === DELETE_VALUE) recordStore.delete([activeEditionId, key]);
      else recordStore.put({ editionId: activeEditionId, key, value, updatedAt: now });
    });
    transaction.objectStore(EDITIONS_STORE).put(updatedEdition);
    await done;
    editions.set(activeEditionId, updatedEdition);
  }

  async function flush() {
    await ensureInitialized();
    clearTimeout(autosaveTimer);
    autosaveTimer = null;

    if (flushPromise) {
      await flushPromise;
      if (pendingWrites.size) return flush();
      return;
    }
    if (!pendingWrites.size) {
      storageEvent("saved");
      return;
    }

    const batch = new Map(pendingWrites);
    pendingWrites.clear();
    flushPromise = writeActiveBatch(batch);
    try {
      await flushPromise;
    } catch (error) {
      batch.forEach((value, key) => {
        if (!pendingWrites.has(key)) pendingWrites.set(key, value);
      });
      storageEvent("error", error);
      throw error;
    } finally {
      flushPromise = null;
    }

    if (pendingWrites.size) return flush();
    storageEvent("saved");
  }

  async function putMany(updates) {
    await ensureInitialized();
    await flush();
    const normalized = normalizeEntries(updates);
    if (!normalized.size) return;
    const nextRecords = new Map(activeRecords);
    normalized.forEach((value, key) => {
      if (value === DELETE_VALUE) nextRecords.delete(key);
      else nextRecords.set(key, value);
    });
    assertRecordCollectionLimits(nextRecords);
    // Toda escritura pasa por flushPromise: sin esto, un cambio de texto
    // durante esta transacción arrancaba un segundo lote con una copia
    // incompleta del mapa y guardaba mal el recuento de la edición.
    flushPromise = writeActiveBatch(normalized);
    try {
      await flushPromise;
    } finally {
      flushPromise = null;
    }
    normalized.forEach((value, key) => {
      if (value === DELETE_VALUE) activeRecords.delete(key);
      else activeRecords.set(key, value);
    });
    storageEvent("saved");
  }

  async function clearActive() {
    await ensureInitialized();
    await flush();
    const current = requireActive();
    const updated = { ...current, updatedAt: new Date().toISOString(), completedPages: 0, recordCount: 0 };
    const transaction = database.transaction([EDITIONS_STORE, RECORDS_STORE], "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).put(updated);
    await deleteRecords(transaction, activeEditionId);
    // Mismo motivo que en putMany: una escritura durante este borrado volvía a
    // insertar un registro justo después de haber vaciado el mapa.
    flushPromise = done;
    try {
      await done;
    } finally {
      flushPromise = null;
    }
    activeRecords = new Map();
    editions.set(updated.id, updated);
    storageEvent("saved");
  }

  async function create(options) {
    await ensureInitialized();
    await flush();
    return createInternal(options || {}, true);
  }

  async function switchTo(id) {
    await ensureInitialized();
    const validId = validateInternalId(id);
    if (validId === activeEditionId) return active();
    await flush();
    return setActiveInternal(validId);
  }

  async function rename(id, name) {
    await ensureInitialized();
    await flush();
    const validId = validateInternalId(id);
    const current = editions.get(validId);
    if (!current) throw new Error("La edición solicitada no existe.");
    const updated = { ...current, name: cleanName(name), updatedAt: new Date().toISOString() };
    const transaction = database.transaction(EDITIONS_STORE, "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).put(updated);
    await done;
    editions.set(validId, updated);
    return cloneEdition(updated);
  }

  async function duplicate(id, options = {}) {
    await ensureInitialized();
    await flush();
    const validId = validateInternalId(id);
    const source = editions.get(validId);
    if (!source) throw new Error("La edición que deseas duplicar no existe.");
    const mode = options.mode || "new-edition";
    if (mode !== "new-edition" && mode !== "exact") throw new TypeError("El modo de duplicado no es válido.");
    const safeName = cleanName(options.name);
    const sourceRecords = await readRecords(validId);
    const copied = new Map();
    sourceRecords.forEach((value, key) => {
      if (mode === "new-edition" && key.startsWith("done:")) return;
      if (mode === "new-edition" && key === "text:p01.edition") {
        copied.set(key, safeName);
        return;
      }
      if (mode === "new-edition" && key === "settings:issue") {
        const settings = JSON.parse(value);
        settings.edition = safeName;
        settings.verified = false;
        settings.verifiedAt = "";
        copied.set(key, JSON.stringify(settings));
        return;
      }
      copied.set(key, value);
    });
    if (mode === "new-edition") copied.set("text:p01.edition", safeName);

    const now = new Date().toISOString();
    let newId = generateId();
    while (editions.has(newId)) newId = generateId();
    const duplicateEdition = {
      id: newId,
      name: safeName,
      edition: mode === "new-edition" ? safeName : source.edition,
      templateId: source.templateId || TEMPLATE_ID,
      templateVersion: source.templateVersion || TEMPLATE_VERSION,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      duplicatedFrom: source.id
    };
    await writeEditionWithEntries(duplicateEdition, copied);
    await setActiveInternal(newId);
    return active();
  }

  async function archive(id) {
    await ensureInitialized();
    await flush();
    const validId = validateInternalId(id);
    const current = editions.get(validId);
    if (!current) throw new Error("La edición solicitada no existe.");
    if (current.trashedAt) return cloneEdition(current);
    const now = new Date().toISOString();
    const updated = { ...current, trashedAt: now, updatedAt: now };
    const transaction = database.transaction(EDITIONS_STORE, "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).put(updated);
    await done;
    editions.set(validId, updated);
    if (validId === activeEditionId) await setActiveInternal(list()[0]?.id || null);
    return cloneEdition(updated);
  }

  async function restore(id) {
    await ensureInitialized();
    const validId = validateInternalId(id);
    const current = editions.get(validId);
    if (!current) throw new Error("La edición solicitada no existe.");
    if (!current.trashedAt) return cloneEdition(current);
    const updated = { ...current, trashedAt: null, updatedAt: new Date().toISOString() };
    const transaction = database.transaction(EDITIONS_STORE, "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).put(updated);
    await done;
    editions.set(validId, updated);
    return cloneEdition(updated);
  }

  async function deletePermanently(id) {
    await ensureInitialized();
    await flush();
    const validId = validateInternalId(id);
    const current = editions.get(validId);
    if (!current) return false;
    if (!current.trashedAt) throw new Error("Mueve la edición a la papelera antes de eliminarla definitivamente.");
    const transaction = database.transaction([EDITIONS_STORE, RECORDS_STORE], "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore(EDITIONS_STORE).delete(validId);
    await deleteRecords(transaction, validId);
    await done;
    editions.delete(validId);
    if (activeEditionId === validId) await setActiveInternal(list()[0]?.id || null);
    return true;
  }

  async function importProject(project = {}) {
    await ensureInitialized();
    await flush();
    const safeName = cleanName(project.name);
    const safeEdition = cleanEdition(project.edition, safeName);
    const importedEntries = normalizeEntries(project.entries || {});
    const now = new Date().toISOString();
    let id = generateId();
    while (editions.has(id)) id = generateId();
    const imported = {
      id,
      name: safeName,
      edition: safeEdition,
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      importedAt: now
    };
    await writeEditionWithEntries(imported, importedEntries);
    await setActiveInternal(id);
    return active();
  }

  async function exportProject() {
    await ensureInitialized();
    await flush();
    const current = requireActive();
    return {
      format: FORMAT,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      project: {
        id: current.id,
        name: current.name,
        edition: current.edition,
        templateId: current.templateId,
        templateVersion: current.templateVersion,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt
      },
      entries: Object.fromEntries(activeRecords)
    };
  }

  window.addEventListener("pagehide", () => {
    if (pendingWrites.size) flush().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pendingWrites.size) flush().catch(() => {});
  });

  window.MagazineData = Object.freeze({
    init,
    active,
    list,
    getItem,
    setItem,
    removeItem,
    entries,
    putMany,
    flush,
    clearActive,
    create,
    switchTo,
    rename,
    duplicate,
    archive,
    restore,
    deletePermanently,
    importProject,
    exportProject,
    notice,
    recoverLegacy
  });
})();
