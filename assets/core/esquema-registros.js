(function (root) {
  "use strict";

  const LIMITES = Object.freeze({
    entradas: 1_000,
    caracteresTotales: 40_000_000,
    texto: 100_000,
    imagen: 6_300_000,
    metadatosImagen: 20_000,
    ajustesEdicion: 20_000,
    estructura: 200_000,
    dimensionImagen: 30_000,
    textoMetadatosImagen: 2_000,
    seccionesMinimas: 2,
    seccionesMaximas: 100,
    paginasPorSeccion: 12,
    paginasTotales: 200
  });

  const PATRONES = Object.freeze({
    pagina: /^p[a-z0-9]{2,22}$/,
    texto: /^p[a-z0-9]{2,22}\.[A-Za-z0-9._-]{1,160}$/,
    imagen: /^(?:p[a-z0-9]{2,22}|brand)\.[A-Za-z0-9_-]{1,80}$/,
    clave: /^(text|image|image-meta|done|settings):([A-Za-z0-9._-]{1,180})$/,
    imagenDataUri: /^data:image\/(?:jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i,
    seccion: /^[A-Za-z0-9_-]{1,80}$/,
    maqueta: /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
  });

  // El registro de formatos, tonos y maquetas pertenece al modelo editorial.
  // Aquí sólo se captura para validarlo; no se mantiene una segunda lista.
  const FORMATOS_BASE = Object.freeze(Object.keys(root.CascoModeloEditorial?.FORMATOS || {}));
  const TONOS_BASE = Object.freeze([...new Set(Object.values(root.CascoModeloEditorial?.TONOS_SECCION || {}))]);
  const MAQUETAS_BASE = Object.freeze([...(root.CascoModeloEditorial?.LAYOUTS_PERMITIDOS || [])]);

  const CAMPOS_AJUSTES_EDICION = Object.freeze([
    "edition", "responsible", "closingDate", "email", "whatsapp", "location", "motto",
    "verified", "verifiedAt", "formato", "programVersion", "estructura"
  ]);

  const CAMPOS_METADATOS_IMAGEN = Object.freeze([
    "width", "height", "originalWidth", "originalHeight", "originalName", "fit", "minors",
    "minorsAuth", "alt", "credit", "caption", "permission"
  ]);

  const CAMPOS_DIMENSION = new Set(["width", "height", "originalWidth", "originalHeight"]);
  const CAMPOS_BOOLEANOS = new Set(["minors", "permission"]);
  const CAMPOS_TEXTO_METADATOS = new Set(["alt", "credit", "caption", "originalName", "minorsAuth"]);
  const CAMPOS_AJUSTES = new Set(CAMPOS_AJUSTES_EDICION);
  const CAMPOS_META = new Set(CAMPOS_METADATOS_IMAGEN);

  function esObjetoPlano(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function parsearObjetoJson(value, mensajeJson, mensajeObjeto) {
    if (typeof value !== "string") throw new TypeError(mensajeObjeto);
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new TypeError(mensajeJson);
    }
    if (!esObjetoPlano(parsed)) throw new TypeError(mensajeObjeto);
    return parsed;
  }

  function agregarValores(set, source, selector = (item) => item) {
    if (!source) return;
    const values = typeof source === "string" ? [source] : source;
    if (!values || typeof values[Symbol.iterator] !== "function") return;
    for (const item of values) {
      const value = selector(item);
      if (typeof value === "string" && value) set.add(value);
    }
  }

  function formatosPermitidos(options = {}) {
    const formatos = new Set(FORMATOS_BASE);
    const registrados = root.CascoModeloEditorial?.FORMATOS;
    if (esObjetoPlano(registrados)) agregarValores(formatos, Object.keys(registrados));
    agregarValores(formatos, options.formatos);
    return formatos;
  }

  function tonosPermitidos(options = {}) {
    const tonos = new Set(TONOS_BASE);
    agregarValores(tonos, options.tonos);
    return tonos;
  }

  function maquetasPermitidas(options = {}) {
    const maquetas = new Set(MAQUETAS_BASE);
    agregarValores(maquetas, root.CascoModeloEditorial?.CATALOGO_MAQUETAS, (item) => item?.id);
    agregarValores(maquetas, options.maquetas, (item) => typeof item === "string" ? item : item?.id);
    return maquetas;
  }

  function versionesPermitidas(options = {}) {
    const actual = String(root.CascoModeloEditorial?.VERSION_PROGRAMA || "12");
    const versiones = new Set([actual]);
    agregarValores(versiones, options.versionesPrograma);
    return versiones;
  }

  function analizarClave(relativeKey) {
    if (typeof relativeKey !== "string") throw new TypeError("La clave editorial debe ser texto.");
    const match = relativeKey.match(PATRONES.clave);
    if (!match) throw new TypeError(`La clave editorial “${relativeKey.slice(0, 80)}” no es válida.`);
    return { clave: relativeKey, tipo: match[1], identificador: match[2] };
  }

  function validarTexto(identifier, value) {
    if (!PATRONES.texto.test(identifier)) {
      throw new TypeError(`El identificador de texto “${String(identifier).slice(0, 80)}” no es válido.`);
    }
    if (typeof value !== "string") throw new TypeError("El contenido editorial debe ser texto.");
    if (value.length > LIMITES.texto) {
      throw new RangeError(`El campo “${identifier}” supera ${LIMITES.texto.toLocaleString("es-CL")} caracteres.`);
    }
    return value;
  }

  function validarImagenDataUri(value, identifier = "imagen") {
    if (typeof value !== "string") throw new TypeError(`La fotografía “${identifier}” debe estar codificada como texto.`);
    if (value.length > LIMITES.imagen) {
      throw new RangeError(`La fotografía “${identifier}” excede el tamaño permitido.`);
    }
    if (!PATRONES.imagenDataUri.test(value)) {
      throw new TypeError(`La fotografía “${identifier}” no es una imagen JPG, PNG o WebP válida.`);
    }
    return value;
  }

  function validarMetadatosImagen(value) {
    if (typeof value !== "string") throw new TypeError("La ficha fotográfica debe estar codificada como texto JSON.");
    if (value.length > LIMITES.metadatosImagen) {
      throw new RangeError("La ficha fotográfica excede el tamaño permitido.");
    }
    const metadata = parsearObjetoJson(
      value,
      "La ficha fotográfica no contiene JSON válido.",
      "La ficha fotográfica no contiene un objeto válido."
    );

    Object.keys(metadata).forEach((key) => {
      if (!CAMPOS_META.has(key)) {
        throw new TypeError(`La ficha fotográfica contiene el campo desconocido “${key}”.`);
      }
      const field = metadata[key];
      if (CAMPOS_DIMENSION.has(key)) {
        if (!Number.isFinite(field) || field <= 0 || field > LIMITES.dimensionImagen) {
          throw new TypeError(`La dimensión fotográfica “${key}” no es válida.`);
        }
      } else if (CAMPOS_BOOLEANOS.has(key)) {
        if (typeof field !== "boolean") throw new TypeError(`El dato fotográfico “${key}” debe ser verdadero o falso.`);
      } else if (CAMPOS_TEXTO_METADATOS.has(key)) {
        if (typeof field !== "string" || field.length > LIMITES.textoMetadatosImagen) {
          throw new TypeError(`El texto fotográfico “${key}” no es válido.`);
        }
      } else if (key === "fit" && field !== "cover" && field !== "contain") {
        throw new TypeError("El encaje fotográfico debe ser “cover” o “contain”.");
      }
    });

    return metadata;
  }

  function validarAjustesEdicion(value, options = {}) {
    if (typeof value !== "string") throw new TypeError("Los datos de la edición deben estar codificados como texto JSON.");
    if (value.length > LIMITES.ajustesEdicion) {
      throw new RangeError("Los datos de la edición exceden el tamaño permitido.");
    }
    const settings = parsearObjetoJson(
      value,
      "Los datos de la edición no contienen JSON válido.",
      "Los datos de la edición no contienen un objeto válido."
    );

    Object.entries(settings).forEach(([key, setting]) => {
      if (!CAMPOS_AJUSTES.has(key)) {
        throw new TypeError(`Los datos de la edición contienen el campo desconocido “${key}”.`);
      }
      if (key === "verified") {
        if (typeof setting !== "boolean") throw new TypeError("La confirmación de la edición no es válida.");
      } else if (typeof setting !== "string" || setting.length > 1_000) {
        throw new TypeError(`El dato de edición “${key}” no es válido.`);
      }
    });

    if (settings.formato !== undefined && !formatosPermitidos(options).has(settings.formato)) {
      throw new TypeError(`El formato de página “${settings.formato}” no está registrado.`);
    }
    if (settings.programVersion !== undefined && !versionesPermitidas(options).has(settings.programVersion)) {
      throw new TypeError(`La versión editorial “${settings.programVersion}” no es compatible.`);
    }
    if (settings.estructura !== undefined && !versionesPermitidas(options).has(settings.estructura)) {
      throw new TypeError(`El marcador heredado de estructura “${settings.estructura}” no es compatible.`);
    }
    return settings;
  }

  function validarEstructura(value, options = {}) {
    if (typeof value !== "string") throw new TypeError("La estructura editorial debe estar codificada como texto JSON.");
    if (value.length > LIMITES.estructura) {
      throw new RangeError("La estructura editorial excede el tamaño permitido.");
    }
    const structure = parsearObjetoJson(
      value,
      "La estructura editorial no contiene JSON válido.",
      "La estructura editorial no contiene un objeto válido."
    );
    if (structure.version !== 1 || !Array.isArray(structure.secciones)) {
      throw new TypeError("La estructura editorial usa una versión no reconocida.");
    }
    if (structure.secciones.length < LIMITES.seccionesMinimas
      || structure.secciones.length > LIMITES.seccionesMaximas) {
      throw new RangeError(`La estructura debe contener entre ${LIMITES.seccionesMinimas} y ${LIMITES.seccionesMaximas} secciones.`);
    }

    const sectionIds = new Set();
    const pageIds = new Set();
    const layouts = maquetasPermitidas(options);
    const tones = tonosPermitidos(options);
    let totalPages = 0;

    structure.secciones.forEach((section, sectionIndex) => {
      if (!esObjetoPlano(section)) throw new TypeError(`La sección ${sectionIndex + 1} no contiene un objeto válido.`);
      const sectionId = String(section.id || "");
      if (!PATRONES.seccion.test(sectionId) || sectionIds.has(sectionId)) {
        throw new TypeError(`La sección ${sectionIndex + 1} tiene un identificador no válido o repetido.`);
      }
      sectionIds.add(sectionId);
      if (typeof section.titulo !== "string" || !section.titulo.trim() || section.titulo.length > 120) {
        throw new TypeError(`La sección “${sectionId}” no tiene un título válido.`);
      }
      if (section.proposito !== undefined
        && (typeof section.proposito !== "string" || section.proposito.length > 1_000)) {
        throw new TypeError(`El propósito de la sección “${sectionId}” no es válido.`);
      }
      if (section.tono !== undefined && !tones.has(section.tono)) {
        throw new TypeError(`El tono visual “${section.tono}” de la sección “${sectionId}” no está registrado.`);
      }
      if (section.base !== undefined && typeof section.base !== "boolean") {
        throw new TypeError(`El indicador base de la sección “${sectionId}” no es válido.`);
      }
      if (!Array.isArray(section.paginas) || !section.paginas.length
        || section.paginas.length > LIMITES.paginasPorSeccion) {
        throw new RangeError(`La sección “${sectionId}” debe contener entre 1 y ${LIMITES.paginasPorSeccion} páginas.`);
      }

      section.paginas.forEach((page, pageIndex) => {
        if (!esObjetoPlano(page)) {
          throw new TypeError(`La página ${pageIndex + 1} de la sección “${sectionId}” no contiene un objeto válido.`);
        }
        const pageId = String(page.id || "");
        if (!PATRONES.pagina.test(pageId) || pageIds.has(pageId)) {
          throw new TypeError(`La estructura contiene la página no válida o repetida “${pageId || "sin identificador"}”.`);
        }
        if (typeof page.layout !== "string" || !PATRONES.maqueta.test(page.layout) || !layouts.has(page.layout)) {
          throw new TypeError(`La página “${pageId}” usa la maqueta no registrada “${String(page.layout || "")}”.`);
        }
        if (page.titulo !== undefined && (typeof page.titulo !== "string" || page.titulo.length > 120)) {
          throw new TypeError(`El título de la página “${pageId}” no es válido.`);
        }
        pageIds.add(pageId);
        totalPages += 1;
      });
    });

    if (totalPages > LIMITES.paginasTotales) {
      throw new RangeError(`La estructura supera el máximo de ${LIMITES.paginasTotales} páginas.`);
    }

    if (options.exigirExtremos !== false) {
      const firstPage = structure.secciones[0].paginas[0];
      const lastSection = structure.secciones[structure.secciones.length - 1];
      const lastPage = lastSection.paginas[lastSection.paginas.length - 1];
      const coverId = options.portadaId || "p01";
      const backId = options.contraportadaId || "p12";
      const coverLayout = options.maquetaPortada || "cover";
      const backLayout = options.maquetaContraportada || "back";
      if (firstPage.id !== coverId || firstPage.layout !== coverLayout
        || lastPage.id !== backId || lastPage.layout !== backLayout) {
        throw new TypeError(
          `La portada ${coverId} y la contraportada ${backId} deben conservar los extremos y sus maquetas.`
        );
      }
    }
    return structure;
  }

  function validarEntrada(relativeKey, value, options = {}) {
    const { clave, tipo, identificador } = analizarClave(relativeKey);
    if (typeof value !== "string") throw new TypeError(`El registro “${clave}” debe contener texto.`);

    if (tipo === "text") {
      validarTexto(identificador, value);
    } else if (tipo === "image") {
      if (!PATRONES.imagen.test(identificador)) {
        throw new TypeError(`El identificador de fotografía “${identificador}” no es válido.`);
      }
      validarImagenDataUri(value, identificador);
    } else if (tipo === "image-meta") {
      if (!PATRONES.imagen.test(identificador)) {
        throw new TypeError(`El identificador de ficha fotográfica “${identificador}” no es válido.`);
      }
      validarMetadatosImagen(value);
    } else if (tipo === "done") {
      if (!PATRONES.pagina.test(identificador) || value !== "1") {
        throw new TypeError(`El estado de página “${identificador}” no es válido.`);
      }
    } else if (identificador === "issue") {
      validarAjustesEdicion(value, options);
    } else if (identificador === "estructura") {
      validarEstructura(value, options);
    } else if (/^estructura-legacy(?:-\d+)?$/.test(identificador)) {
      validarEstructura(value, { ...options, exigirExtremos: false });
    } else {
      throw new TypeError(`El bloque de configuración “${identificador}” no está registrado.`);
    }
    return clave;
  }

  function extraerEntradas(input) {
    if (Array.isArray(input)) return input.slice();
    if (Object.prototype.toString.call(input) === "[object Map]") return Array.from(input.entries());
    if (esObjetoPlano(input)) return Object.entries(input);
    throw new TypeError("La colección editorial debe ser un objeto, un Map o una lista de pares.");
  }

  function validarLimitesColeccion(input, options = {}) {
    const entries = extraerEntradas(input);
    if (entries.length > LIMITES.entradas) {
      throw new RangeError(`La colección supera el máximo de ${LIMITES.entradas} registros.`);
    }
    let totalCharacters = 0;
    entries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new TypeError("Cada registro editorial debe ser un par [clave, valor].");
      }
      const [key, value] = entry;
      if (options.permitirBorrado === true && (value === null || value === undefined)) return;
      if (typeof key !== "string" || typeof value !== "string") {
        throw new TypeError("Las claves y valores de la colección editorial deben ser texto.");
      }
      totalCharacters += key.length + value.length;
      if (totalCharacters > LIMITES.caracteresTotales) {
        throw new RangeError("La colección editorial excede el tamaño total permitido.");
      }
    });
    return { entradas: entries, caracteresTotales: totalCharacters };
  }

  function validarColeccion(input, options = {}) {
    const { entradas } = validarLimitesColeccion(input, options);
    const seen = new Set();
    return entradas.map((entry) => {
      const [key, value] = entry;
      if (typeof key !== "string") throw new TypeError("La clave de un registro editorial debe ser texto.");
      if (seen.has(key)) throw new TypeError(`La colección contiene la clave duplicada “${key}”.`);
      seen.add(key);
      if (options.permitirBorrado === true && (value === null || value === undefined)) {
        analizarClave(key);
        return [key, null];
      }
      validarEntrada(key, value, options);
      return [key, value];
    });
  }

  function normalizarColeccion(input, options = {}) {
    return new Map(validarColeccion(input, options));
  }

  root.CascoEsquemaRegistros = Object.freeze({
    LIMITES,
    PATRONES,
    FORMATOS_BASE,
    TONOS_BASE,
    MAQUETAS_BASE,
    CAMPOS_AJUSTES_EDICION,
    CAMPOS_METADATOS_IMAGEN,
    analizarClave,
    validarTexto,
    validarImagenDataUri,
    validarMetadatosImagen,
    validarAjustesEdicion,
    validarEstructura,
    validarEntrada,
    extraerEntradas,
    validarLimitesColeccion,
    validarColeccion,
    normalizarColeccion
  });
})(typeof window === "object" ? window : globalThis);
