(function (root) {
  "use strict";

  const MAPA_DOCE = Object.freeze({
    p01: "p01", p02: "p02", p03: "p02", p04: "p03", p05: "p04", p06: "p05",
    p07: "p06", p08: "p07", p10: "p08", p12: "p10", p14: "p11", p16: "p09", p18: "p12"
  });

  const CAMPOS_EDITORIAL = Object.freeze({
    title: "edTitle", body1: "edBody1", body2: "edBody2", body3: "edBody3",
    signature: "signature", deck: null, runningHead: null
  });

  // Páginas retiradas cuyo contenido sí tiene un destino visible en una página
  // fusionada. Cualquier raíz no enumerada se archiva bajo plegacy.
  const FUSIONES_DOCE = Object.freeze({
    p09: {
      pagina: "p07",
      texto: { q3: "q3", a3: "a3", quote: "quote", credit: "credit" },
      imagen: {}
    },
    p11: {
      pagina: "p08",
      texto: { body1: "body3", quote: "quote" },
      imagen: {}
    },
    p13: {
      pagina: "p07",
      texto: { title: "negocio", contact: "visita", label: "aviso", commerce: "commerce" },
      imagen: { commerce: "commerce" }
    },
    p15: {
      pagina: "p10",
      texto: { title: "agendaLabel", deck: "agendaNota", agenda: "agenda" },
      imagen: {}
    }
  });

  const MAPA_DIECISEIS_A_DIECIOCHO = Object.freeze({
    p01: "p01", p02: "p02", p03: "p03", p04: "p06", p05: "p07", p06: "p04",
    p07: "p08", p08: "p09", p09: "p10", p10: "p12", p11: "p13", p12: "p14",
    p13: "p15", p14: "p16", p15: "p17", p16: "p18"
  });

  // Un único conjunto de señales sirve tanto al recuperador de localStorage
  // como al importador de respaldos v1. Antes ambos mantenían listas distintas.
  const MARCADORES_DIECISEIS = Object.freeze([
    "text:p16.tagline", "text:p16.contact1", "text:p15.primaryTitle", "text:p04.body1",
    "text:p07.intro", "text:p08.q3", "text:p10.block1Title", "text:p11.contact",
    "text:p14.callout", "image:p04.main", "image:p05.support", "image:p07.portrait",
    "image:p08.context", "image:p09.historic", "image:p10.service", "image:p11.commerce",
    "image:p14.culture"
  ]);

  const MARCADORES_DIECIOCHO = Object.freeze([
    "text:p18.tagline", "text:p18.contact1", "text:p17.primaryTitle", "text:p05.nextTitle",
    "text:p06.body1", "text:p08.intro", "text:p09.q3", "text:p11.caption",
    "image:p05.progress", "image:p06.main", "image:p07.support", "image:p08.portrait",
    "image:p09.context", "image:p10.historic", "image:p11.memory", "image:p12.service",
    "image:p13.commerce", "image:p16.culture"
  ]);

  function mapaDeEntradas(entries) {
    const pares = Array.isArray(entries)
      ? entries
      : Object.prototype.toString.call(entries) === "[object Map]"
        ? [...entries.entries()]
        : [];
    return new Map(pares.map(([key, value]) => [String(key), value]));
  }

  function detectarProgramaHeredado(entries) {
    const claves = new Set((Array.isArray(entries) ? entries : [...(entries || new Map()).entries()])
      .map(([key]) => String(key)));
    if (MARCADORES_DIECIOCHO.some((key) => claves.has(key))) return 18;
    if (MARCADORES_DIECISEIS.some((key) => claves.has(key))) return 16;
    return null;
  }

  function remapearClaveDieciseis(relativeKey) {
    const separator = String(relativeKey).indexOf(":");
    if (separator < 1) return relativeKey;
    const kind = relativeKey.slice(0, separator);
    const identifier = relativeKey.slice(separator + 1);
    if (kind === "settings") return relativeKey;
    const pageId = identifier.split(".")[0];
    const mapped = MAPA_DIECISEIS_A_DIECIOCHO[pageId];
    return mapped ? `${kind}:${mapped}${identifier.slice(pageId.length)}` : relativeKey;
  }

  function remapearEntradasDieciseis(entries) {
    return (Array.isArray(entries) ? entries : [...(entries || new Map()).entries()])
      .map(([key, value]) => [remapearClaveDieciseis(String(key)), value]);
  }

  function planificarMigracionADoce({ entries, ajustesGuardados = {}, ajustesNormalizados = {} }) {
    if (ajustesGuardados?.programVersion === "12") {
      return { cambios: new Map(), movidas: 0, archivadas: 0, omitida: true };
    }

    if (ajustesGuardados?.estructura === "12") {
      return {
        cambios: new Map([["settings:issue", JSON.stringify(ajustesNormalizados)]]),
        movidas: 0,
        archivadas: 0,
        omitida: false
      };
    }

    const existentes = mapaDeEntradas(entries);
    const cambios = new Map();
    const destinos = new Map();
    let movidas = 0;
    let archivadas = 0;

    function archivarEstructuraHeredada() {
      if (!existentes.has("settings:estructura")) return;
      const valor = existentes.get("settings:estructura");
      for (let copia = 1; copia <= 100; copia += 1) {
        const archivo = `settings:estructura-legacy${copia === 1 ? "" : `-${copia}`}`;
        const ocupado = cambios.has(archivo) ? cambios.get(archivo) : existentes.get(archivo);
        if (ocupado === valor) break;
        if (!cambios.has(archivo) && !existentes.has(archivo)) {
          cambios.set(archivo, valor);
          archivadas += 1;
          break;
        }
        if (copia === 100) throw new RangeError("No se pudo reservar el archivo de la estructura histórica.");
      }
      cambios.set("settings:estructura", null);
    }

    function archivar(clave, valor) {
      const match = /^(text|image|image-meta|done):(p\d{2})(?:\.(.+))?$/.exec(clave);
      if (!match) return;
      const [, tipo, pagina, resto] = match;
      for (let copia = 1; copia <= 100; copia += 1) {
        const paginaArchivo = `plegacy${pagina.slice(1)}${copia === 1 ? "" : `x${copia}`}`;
        const archivo = `${tipo}:${paginaArchivo}${resto ? `.${resto}` : ""}`;
        const ocupado = cambios.has(archivo) ? cambios.get(archivo) : existentes.get(archivo);
        if (ocupado === valor) return;
        if (!cambios.has(archivo) && !existentes.has(archivo)) {
          cambios.set(archivo, valor);
          archivadas += 1;
          return;
        }
      }
      throw new RangeError(`No se pudo reservar un archivo histórico para ${clave}.`);
    }

    existentes.forEach((unused, clave) => {
      if (/^(text|image|image-meta|done):p\d{2}(?:\.|$)/.test(clave)) cambios.set(clave, null);
    });
    archivarEstructuraHeredada();

    existentes.forEach((valor, clave) => {
      const match = /^(text|image|image-meta|done):(p\d{2})(?:\.(.+))?$/.exec(clave);
      if (!match) return;
      const [, tipo, paginaVieja, resto] = match;
      if (tipo === "done") {
        archivar(clave, valor);
        return;
      }

      const fusion = FUSIONES_DOCE[paginaVieja];
      let paginaNueva = MAPA_DOCE[paginaVieja];
      let cola = resto;
      let valorDestino = valor;
      if (fusion) {
        const raiz = String(resto || "").split(".")[0];
        const reglas = tipo === "image" || tipo === "image-meta" ? fusion.imagen : fusion.texto;
        const destino = Object.prototype.hasOwnProperty.call(reglas, raiz) ? reglas[raiz] : null;
        if (!destino) {
          archivar(clave, valor);
          return;
        }
        // La agenda histórica admitía cuatro fichas y la página fusionada sólo
        // puede mostrar tres. La cuarta queda explícitamente archivada, y el
        // contador visible se limita sin perder el valor original del respaldo.
        if (paginaVieja === "p15" && tipo === "text" && raiz === "agenda") {
          const itemAgenda = /^agenda\.(\d+)(?:\.|$)/.exec(String(resto || ""));
          if (itemAgenda && Number(itemAgenda[1]) >= 3) {
            archivar(clave, valor);
            return;
          }
          if (resto === "agenda.count" && Number.parseInt(String(valor), 10) > 3) {
            archivar(clave, valor);
            valorDestino = "3";
          }
        }
        paginaNueva = fusion.pagina;
        cola = String(resto).replace(raiz, destino);
      }
      if (!paginaNueva) {
        archivar(clave, valor);
        return;
      }

      if (!fusion && paginaVieja === "p03") {
        const raiz = String(resto || "").split(".")[0];
        const destino = Object.prototype.hasOwnProperty.call(CAMPOS_EDITORIAL, raiz)
          ? CAMPOS_EDITORIAL[raiz]
          : raiz;
        if (!destino) {
          archivar(clave, valor);
          return;
        }
        cola = String(resto).replace(raiz, destino);
      }

      const claveNueva = cola ? `${tipo}:${paginaNueva}.${cola}` : `${tipo}:${paginaNueva}`;
      if (claveNueva !== clave) movidas += 1;
      const anterior = destinos.get(claveNueva);
      if (anterior && anterior.clave !== clave && anterior.valor !== valorDestino) {
        archivar(anterior.clave, anterior.valor);
      }
      destinos.set(claveNueva, { clave, valor: valorDestino });
      cambios.set(claveNueva, valorDestino);
    });

    cambios.set("settings:issue", JSON.stringify(ajustesNormalizados));
    return { cambios, movidas, archivadas, omitida: false };
  }

  root.CascoMigraciones = Object.freeze({
    MAPA_DOCE,
    CAMPOS_EDITORIAL,
    FUSIONES_DOCE,
    MAPA_DIECISEIS_A_DIECIOCHO,
    MARCADORES_DIECISEIS,
    MARCADORES_DIECIOCHO,
    detectarProgramaHeredado,
    remapearClaveDieciseis,
    remapearEntradasDieciseis,
    planificarMigracionADoce
  });
})(typeof window === "object" ? window : globalThis);
