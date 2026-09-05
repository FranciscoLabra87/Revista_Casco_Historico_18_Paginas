(function (root) {
  "use strict";

  const VERSION_PROGRAMA = "12";
  const SANGRADO_IMPRENTA_MM = 3;
  const EXTRA_HOJA_IMPRENTA = Object.freeze({ ancho: 62, alto: 87 });

  const AJUSTES_EDICION_POR_OMISION = Object.freeze({
    edition: "Edición N.° 1 · Mes 2026",
    responsible: "",
    closingDate: "",
    email: "",
    whatsapp: "",
    location: "Puente Alto · Chile",
    motto: "Un barrio con historia es un barrio con futuro",
    verified: false,
    verifiedAt: "",
    formato: "a5",
    programVersion: VERSION_PROGRAMA
  });

  const FORMATOS = deepFreeze({
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
  });

  const PRESUPUESTOS_PALABRAS = deepFreeze({
    p02: { min: 300, max: 460, nombre: "Sumario, créditos y editorial" },
    p03: { min: 380, max: 500, nombre: "Noticias breves" },
    p04: { min: 280, max: 480, nombre: "Avances de la agrupación" },
    p05: { min: 195, max: 250, nombre: "Reportaje · apertura" },
    p06: { min: 315, max: 400, nombre: "Reportaje · continuación" },
    p07: { min: 270, max: 345, nombre: "Voces del comercio" },
    p08: { min: 225, max: 290, nombre: "Memoria y patrimonio" },
    p09: { min: 250, max: 320, nombre: "Observatorio de datos" },
    p10: { min: 300, max: 385, nombre: "Comunidad, servicios y agenda" },
    p11: { min: 360, max: 600, nombre: "Cartas al director" }
  });

  const PRESUPUESTOS_MAQUETAS = deepFreeze({
    "texto-2col": { min: 350, max: 520, nombre: "Texto a dos columnas" },
    "texto-foto": { min: 190, max: 300, nombre: "Fotografía grande y texto" }
  });

  const RANGOS_POR_ELEMENTO = deepFreeze({
    p03: { lista: "briefs", min: 95, max: 125 },
    p11: { lista: "letters", min: 90, max: 150 }
  });

  const ESPECIFICACIONES_LISTAS = deepFreeze({
    "p03.briefs":     { parts: 3, min: 2, max: 6, uno: "noticia",    varias: "noticias" },
    "p04.milestones": { parts: 4, min: 2, max: 6, uno: "avance",     varias: "avances" },
    "p10.agenda":     { parts: 4, min: 1, max: 3, uno: "actividad",  varias: "actividades" },
    "p11.letters":    { parts: 3, min: 1, max: 5, uno: "carta",      varias: "cartas" },
    "p09.registros":  { parts: 5, min: 3, max: 9, uno: "registro",   varias: "registros" },
    "p09.lineas":     { parts: 2, min: 2, max: 3, uno: "línea",      varias: "líneas de trabajo" }
  });

  const TONOS_SECCION = deepFreeze({
    "01_portada": "gold",
    "02_sumario_editorial": "gold",
    "03_noticias_breves": "ceramic",
    "04_reportaje_central": "teja",
    "05_voces_comercio": "palm",
    "06_memoria_patrimonio": "wood",
    "07_observatorio_datos": "indigo",
    "08_comunidad_servicios": "turquesa",
    "09_cartas_director": "ciruela",
    "10_contraportada": "gold"
  });

  const LAYOUTS_PERMITIDOS = Object.freeze([
    "cover", "index", "editorial", "feature-open", "feature-close", "briefs", "advances",
    "interview-open", "interview-close", "voices", "heritage", "heritage-close", "community",
    "commerce", "letters", "agenda", "culture", "ads", "observatorio", "back", "texto-2col",
    "texto-foto", "foto-plena", "listado", "publicidad-plena", "publicidad-modulos", "galeria"
  ]);

  const CATALOGO_MAQUETAS = deepFreeze([
    {
      id: "texto-2col",
      nombre: "Texto a dos columnas",
      descripcion: "Título, bajada, firma y cuatro párrafos. Para un reportaje propio o de fuera, una columna de opinión o un informe.",
      campos: {
        title: "Título de la sección",
        deck: "Una bajada que explique de qué trata y por qué importa aquí.",
        body1: "Primer párrafo: lo más importante primero, con nombres y fechas.",
        body2: "Segundo párrafo: el desarrollo, con los datos y su fuente.",
        body3: "Tercer párrafo: los antecedentes y lo que falta por resolver.",
        body4: "Cuarto párrafo: el cierre y dónde seguir la información."
      }
    },
    {
      id: "texto-foto",
      nombre: "Fotografía grande y texto",
      descripcion: "Una fotografía a lo ancho arriba, con su pie, y el texto debajo a dos columnas.",
      campos: {
        title: "Título de la sección",
        deck: "Una bajada breve.",
        caption: "Pie de la fotografía: qué se ve, dónde y cuándo. Crédito: [nombre].",
        body1: "Primer párrafo.",
        body2: "Segundo párrafo.",
        body3: "Tercer párrafo."
      }
    },
    {
      id: "foto-plena",
      nombre: "Fotografía a página completa",
      descripcion: "Una sola imagen ocupando la página, con su pie al pie. Para una apertura de sección o una imagen que se sostiene sola.",
      campos: {
        caption: "Pie de la fotografía: qué se ve, dónde y cuándo. Crédito: [nombre]."
      }
    },
    {
      id: "listado",
      nombre: "Listado de fichas",
      descripcion: "Filas con nombre y detalle, de largo variable. Para condolencias, saludos, resultados, socios o cualquier nómina.",
      listas: {
        fichas: {
          parts: 3,
          min: 1,
          max: 24,
          uno: "ficha",
          varias: "fichas",
          modelo: "[Nombre]|[Fechas o referencia]|[Texto breve]"
        }
      },
      campos: {
        title: "Título de la sección",
        deck: "Una bajada que explique qué reúne esta página.",
        nota: "Nota al pie: quién envía estos textos y cómo se comprueban."
      }
    },
    {
      id: "publicidad-plena",
      nombre: "Publicidad a página completa",
      descripcion: "Un solo aviso ocupando la página. Va rotulado como publicidad, siempre.",
      campos: {
        adTitle: "Nombre del anunciante",
        adBody: "Texto aprobado por el anunciante, con dirección, horario y teléfono verificados."
      }
    },
    {
      id: "publicidad-modulos",
      nombre: "Página de avisos",
      descripcion: "Varios avisos en módulos, de dos a seis. Cada uno con su nombre, su texto y su imagen.",
      listas: {
        avisos: {
          parts: 2,
          min: 2,
          max: 6,
          uno: "aviso",
          varias: "avisos",
          modelo: "[Nombre del anunciante]|[Dirección · horario · teléfono]"
        }
      },
      campos: {
        title: "Avisos del barrio",
        deck: "Espacios comerciales claramente identificados."
      }
    },
    {
      id: "galeria",
      nombre: "Galería de fotografías",
      descripcion: "Cuatro imágenes con sus pies. Para cubrir una actividad, una feria o un recorrido.",
      campos: {
        title: "Título de la galería",
        deck: "Una bajada que sitúe la actividad: qué fue, dónde y cuándo.",
        caption1: "Pie 1. Crédito: [nombre].",
        caption2: "Pie 2. Crédito: [nombre].",
        caption3: "Pie 3. Crédito: [nombre].",
        caption4: "Pie 4. Crédito: [nombre]."
      }
    }
  ]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function esObjetoPlano(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function formato(clave) {
    return FORMATOS[clave] || FORMATOS.a5;
  }

  function claveFormato(clave) {
    return Object.prototype.hasOwnProperty.call(FORMATOS, clave) ? clave : "a5";
  }

  function factorFormato(clave) {
    const base = FORMATOS.a4;
    const elegido = formato(clave);
    const superficie = (elegido.superficie || 1) / (base.superficie || 1);
    const cuerpo = Math.pow((base.cuerpo || 10) / (elegido.cuerpo || 10), 2);
    return superficie * cuerpo;
  }

  function normalizarAjustesParaGuardar(source = {}) {
    const origen = esObjetoPlano(source) ? source : {};
    const normalizados = {};
    ["edition", "responsible", "closingDate", "email", "whatsapp", "location", "motto"].forEach((key) => {
      normalizados[key] = String(origen[key] ?? AJUSTES_EDICION_POR_OMISION[key] ?? "").slice(0, 1_000);
    });
    normalizados.verified = origen.verified === true;
    normalizados.verifiedAt = normalizados.verified ? String(origen.verifiedAt || "").slice(0, 1_000) : "";
    normalizados.formato = claveFormato(origen.formato);
    normalizados.programVersion = VERSION_PROGRAMA;
    return normalizados;
  }

  function resolverAjustesGuardados(saved, activeEdition) {
    const guardados = esObjetoPlano(saved) ? saved : {};
    const resolved = {
      ...AJUSTES_EDICION_POR_OMISION,
      edition: activeEdition || AJUSTES_EDICION_POR_OMISION.edition,
      ...guardados
    };
    resolved.verified = guardados.verified === true;
    resolved.verifiedAt = typeof guardados.verifiedAt === "string" ? guardados.verifiedAt : "";
    resolved.formato = claveFormato(resolved.formato);
    return resolved;
  }

  function dimensionesSalida(clave, salida = "office") {
    const elegido = formato(clave);
    if (salida === "press") {
      return {
        ancho: elegido.ancho + EXTRA_HOJA_IMPRENTA.ancho,
        alto: elegido.alto + EXTRA_HOJA_IMPRENTA.alto
      };
    }
    return { ancho: elegido.ancho, alto: elegido.alto };
  }

  function reglaPagina(clave, salida = "office") {
    const hoja = dimensionesSalida(clave, salida);
    return `@page { size: ${hoja.ancho}mm ${hoja.alto}mm; margin: 0; }`;
  }

  function pasosImpresion(clave, salida = "office") {
    const elegido = formato(clave);
    const hoja = dimensionesSalida(clave, salida);
    if (salida === "press") {
      return [
        "En la ventana de impresión elige <strong>Guardar como PDF</strong>.",
        `Comprueba que el papel mida <strong>${hoja.ancho} × ${hoja.alto} mm</strong>, con escala <strong>100%</strong> y márgenes <strong>ninguno</strong>.`,
        "Activa <strong>gráficos de fondo</strong>: sin eso no se imprimen ni el sangrado ni las marcas.",
        `Entrega ese PDF indicando corte de <strong>${elegido.ancho} × ${elegido.alto} mm</strong> y sangrado de <strong>${SANGRADO_IMPRENTA_MM} mm</strong>.`
      ];
    }
    return [
      "En la ventana de impresión elige <strong>Guardar como PDF</strong>.",
      `Comprueba un tamaño de <strong>${hoja.ancho} × ${hoja.alto} mm</strong>, escala <strong>100%</strong> y márgenes <strong>ninguno</strong>.`,
      "Activa <strong>gráficos de fondo</strong> para conservar marcos, colores y mosaicos."
    ];
  }

  root.CascoModeloEditorial = Object.freeze({
    VERSION_PROGRAMA,
    SANGRADO_IMPRENTA_MM,
    EXTRA_HOJA_IMPRENTA,
    AJUSTES_EDICION_POR_OMISION,
    FORMATOS,
    PRESUPUESTOS_PALABRAS,
    PRESUPUESTOS_MAQUETAS,
    RANGOS_POR_ELEMENTO,
    ESPECIFICACIONES_LISTAS,
    TONOS_SECCION,
    LAYOUTS_PERMITIDOS,
    CATALOGO_MAQUETAS,
    formato,
    claveFormato,
    factorFormato,
    normalizarAjustesParaGuardar,
    resolverAjustesGuardados,
    dimensionesSalida,
    reglaPagina,
    pasosImpresion
  });
})(typeof window === "object" ? window : globalThis);
