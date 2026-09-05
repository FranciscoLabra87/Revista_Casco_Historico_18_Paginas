(function (root) {
  "use strict";

  function ordenarSegmentos(segmentos) {
    return (Array.isArray(segmentos) ? segmentos : [])
      .slice()
      .sort((a, b) => primerNumero(a) - primerNumero(b));
  }

  function primerNumero(segmento) {
    const numeros = Array.isArray(segmento?.pages)
      ? segmento.pages.map((pagina) => Number(pagina?.number)).filter(Number.isFinite)
      : [];
    return numeros.length ? Math.min(...numeros) : Number.MAX_SAFE_INTEGER;
  }

  function idsDePaginasBase(segmentos) {
    return new Set(ordenarSegmentos(segmentos)
      .flatMap((segmento) => Array.isArray(segmento.pages) ? segmento.pages : [])
      .map((pagina) => pagina.id));
  }

  function estructuraBase(segmentos, tonos = {}) {
    return ordenarSegmentos(segmentos).map((segmento) => ({
      id: segmento.id,
      titulo: segmento.title,
      proposito: segmento.purpose,
      tono: tonos[segmento.id] || "gold",
      base: true,
      paginas: (Array.isArray(segmento.pages) ? segmento.pages : [])
        .slice()
        .sort((a, b) => Number(a.number) - Number(b.number))
        .map((pagina) => ({ id: pagina.id, layout: pagina.layout, titulo: pagina.title }))
    }));
  }

  function leerEstructuraGuardada(crudo, base) {
    if (!crudo) return base;
    try {
      const datos = typeof crudo === "string" ? JSON.parse(crudo) : crudo;
      const secciones = Array.isArray(datos?.secciones) ? datos.secciones : null;
      return secciones?.length ? secciones : base;
    } catch {
      return base;
    }
  }

  function maquetaDelCatalogo(catalogo, id) {
    return (Array.isArray(catalogo) ? catalogo : []).find((maqueta) => maqueta.id === id) || null;
  }

  function modeloDePagina(pagina, seccion, segmentos, catalogo) {
    const delBase = ordenarSegmentos(segmentos)
      .flatMap((segmento) => Array.isArray(segmento.pages) ? segmento.pages : [])
      .find((modelo) => modelo.id === pagina.id);
    if (delBase) return delBase;

    const maqueta = maquetaDelCatalogo(catalogo, pagina.layout);
    if (!maqueta) return { id: pagina.id, fields: {}, lists: {} };
    const listas = {};
    Object.entries(maqueta.listas || {}).forEach(([nombre, spec]) => {
      listas[nombre] = Array.from({ length: spec.min }, () => spec.modelo);
    });
    return {
      id: pagina.id,
      title: pagina.titulo || maqueta.nombre,
      layout: pagina.layout,
      status: "modelo",
      fields: { ...maqueta.campos, ribbon: seccion?.titulo || maqueta.nombre },
      lists: listas
    };
  }

  function construirPaginas({ secciones, segmentos, catalogo, tonos = {} }) {
    const ordenados = ordenarSegmentos(segmentos);
    const idsBase = idsDePaginasBase(ordenados);
    let numero = 0;
    const salida = [];
    (Array.isArray(secciones) ? secciones : []).forEach((seccion) => {
      (Array.isArray(seccion.paginas) ? seccion.paginas : []).forEach((pagina, indice) => {
        numero += 1;
        const modelo = modeloDePagina(pagina, seccion, ordenados, catalogo);
        salida.push({
          ...modelo,
          id: pagina.id,
          layout: pagina.layout || modelo.layout,
          number: numero,
          title: pagina.titulo || modelo.title,
          segmentId: seccion.id,
          segmentTitle: seccion.titulo,
          segmentPurpose: seccion.proposito || "",
          isOpener: indice === 0,
          tone: seccion.tono || tonos[seccion.id] || "gold",
          delCatalogo: !idsBase.has(pagina.id)
        });
      });
    });
    return salida;
  }

  function especificacionDeLista(clave, paginas, especificacionesBase, catalogo) {
    if (especificacionesBase?.[clave]) return especificacionesBase[clave];
    const [pageId, nombre] = String(clave).split(".");
    const pagina = (Array.isArray(paginas) ? paginas : []).find((item) => item.id === pageId);
    const maqueta = pagina ? maquetaDelCatalogo(catalogo, pagina.layout) : null;
    return maqueta?.listas?.[nombre] || null;
  }

  root.CascoEstructura = Object.freeze({
    ordenarSegmentos,
    idsDePaginasBase,
    estructuraBase,
    leerEstructuraGuardada,
    maquetaDelCatalogo,
    modeloDePagina,
    construirPaginas,
    especificacionDeLista
  });
})(typeof window === "object" ? window : globalThis);
