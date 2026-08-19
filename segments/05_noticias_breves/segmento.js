window.MAGAZINE_SEGMENTS.push({
  id: "05_noticias_breves",
  title: "Noticias y avances",
  purpose: "Reunir hechos recientes y rendir cuenta de los avances de la agrupación.",
  pages: [
    {
      id: "p04",
      number: 4,
      title: "Noticias breves",
      layout: "briefs",
      status: "modelo",
      fields: {
        title: "El barrio en breve",
        deck: "Noticias cortas, verificadas y útiles para la comunidad."
      },
      lists: {
        briefs: [
          "Reunión y acuerdos|Resumen del tema tratado, principales acuerdos y próximo paso.|[fecha y lugar]",
          "Actividad comunitaria|Qué se realizó, quiénes participaron y cuál fue el resultado.|[fecha y lugar]",
          "Gestión ante autoridades|Solicitud presentada, institución responsable y estado actual.|[contacto]",
          "Convocatoria abierta|Qué actividad se realizará, quiénes pueden participar y cómo inscribirse.|[plazo]",
          "Reconocimiento vecinal|Breve presentación de una persona u organización destacada.|[sector]"
        ]
      }
    },
    {
      id: "p05",
      number: 5,
      title: "Avances de la agrupación",
      layout: "advances",
      status: "modelo",
      fields: {
        title: "Avances de la agrupación",
        deck: "Una rendición breve y verificable de las gestiones, acuerdos y proyectos del período.",
        body: "Esta página resume lo realizado desde la edición anterior. Cada avance debe señalar la acción, su responsable, el resultado alcanzado y el documento o contacto donde puede comprobarse.",
        nextTitle: "Próximos compromisos",
        nextBody: "Indicar las tareas pendientes, fechas estimadas y formas en que vecinas y vecinos pueden informarse o participar."
      },
      lists: {
        milestones: [
          "[fecha]|Gestión prioritaria|Acción realizada, institución relacionada y resultado comprobable.|Finalizada / en curso",
          "[fecha]|Acuerdo comunitario|Decisión adoptada, responsables y siguiente etapa.|Finalizada / en curso",
          "[fecha]|Mejora para el sector|Descripción concreta del avance y personas beneficiadas.|Finalizada / en curso",
          "[fecha]|Solicitud en seguimiento|Número de ingreso, organismo responsable y estado actualizado.|Pendiente"
        ]
      }
    }
  ]
});
