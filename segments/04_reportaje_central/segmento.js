window.MAGAZINE_SEGMENTS.push({
  id: "04_reportaje_central",
  title: "Reportaje central",
  purpose: "Desarrollar con profundidad el tema principal de la edición.",
  pages: [
    {
      id: "p05",
      number: 5,
      title: "Reportaje · apertura",
      layout: "feature-open",
      status: "modelo",
      fields: {
        ribbon: "Reportaje principal",
        title: "Título del reportaje principal",
        deck: "La bajada resume el hecho, su importancia y a quiénes afecta dentro del territorio.",
        body1: "La apertura responde qué ocurrió, dónde, cuándo y quiénes participaron. Este texto debe atraer al lector sin exagerar ni adelantar conclusiones.",
        body2: "El desarrollo incorpora antecedentes, contexto y testimonios identificados. Conviene separar con claridad los hechos comprobados de las opiniones o propuestas.",
        stat: "Dato clave",
        statLabel: "Cifra, fecha o resultado que ayuda a comprender el reportaje."
      }
    },
    {
      id: "p06",
      number: 6,
      title: "Reportaje · continuación",
      layout: "feature-close",
      status: "modelo",
      fields: {
        title: "Qué viene ahora",
        quote: "Una frase breve y comprobada puede destacar la voz de un vecino, especialista o representante.",
        body1: "La segunda página explica consecuencias, opiniones relevantes y próximos pasos. Debe decir qué puede esperar la comunidad y dónde encontrar información actualizada.",
        body2: "El cierre resume la importancia del tema y, cuando corresponda, entrega fechas, contactos o una forma concreta de participar.",
        fact1: "Fecha|[día y hora]",
        fact2: "Lugar|[dirección o sector]",
        fact3: "Contacto|[teléfono o correo]",
        caption: "Pie de fotografía: quién aparece, dónde y cuándo. Crédito: [nombre]."
      }
    }
  ]
});
