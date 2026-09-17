(function (root) {
  "use strict";

  // Las maquetas opcionales viven fuera del controlador. Reciben sólo las
  // primitivas de renderizado que necesitan, para no duplicar reglas ni estado.
  function create({ editable, editableList, firma, imageSlot, listControls, listItems, pageFrame, runningHead, splitItem }) {
    return Object.freeze({
      "antes-despues": function renderAntesDespues(page) {
        const content = `
          ${runningHead(page)}
          <span class="section-ribbon">${editable(page, "ribbon")}</span>
          <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
          <p class="page-deck">${editable(page, "deck")}</p>
          ${firma(page)}
          <div class="antes-despues page-fill">
            <figure class="antes-despues__pieza">
              ${imageSlot(page, "antes", "Agregar foto antigua", "antes-despues__imagen foto-archivo")}
              <figcaption class="caption">${editable(page, "caption1")}</figcaption>
            </figure>
            <figure class="antes-despues__pieza">
              ${imageSlot(page, "despues", "Agregar foto actual", "antes-despues__imagen")}
              <figcaption class="caption">${editable(page, "caption2")}</figcaption>
            </figure>
          </div>`;
        return pageFrame(page, content);
      },

      "directorio-oficios": function renderDirectorioOficios(page) {
        const items = listItems(page, "oficios", 2).map((item, index) => {
          const parts = splitItem(item, 2);
          return `<li class="oficio-item">
            <div class="oficio-item__nombre">${editableList(page, "oficios", index, 0, parts[0])}</div>
            <div class="oficio-item__detalle">${editableList(page, "oficios", index, 1, parts[1])}</div>
          </li>`;
        }).join("");
        const content = `
          ${runningHead(page)}
          <span class="section-ribbon">${editable(page, "ribbon")}</span>
          <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
          <p class="page-deck">${editable(page, "deck")}</p>
          <ul class="directorio-oficios page-fill">${items}</ul>
          ${listControls(page, "oficios", items.length)}`;
        return pageFrame(page, content);
      },

      "agenda-barrio": function renderAgendaBarrio(page) {
        const items = listItems(page, "eventos", 3).map((item, index) => {
          const parts = splitItem(item, 3);
          return `<li class="evento-item">
            <div class="evento-item__fecha">${editableList(page, "eventos", index, 0, parts[0])}</div>
            <div class="evento-item__cuerpo">
              <div class="evento-item__nombre">${editableList(page, "eventos", index, 1, parts[1])}</div>
              <div class="evento-item__detalle">${editableList(page, "eventos", index, 2, parts[2])}</div>
            </div>
          </li>`;
        }).join("");
        const content = `
          ${runningHead(page)}
          <span class="section-ribbon">${editable(page, "ribbon")}</span>
          <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
          <p class="page-deck">${editable(page, "deck")}</p>
          <ul class="agenda-barrio page-fill">${items}</ul>
          ${listControls(page, "eventos", items.length)}`;
        return pageFrame(page, content);
      },

      "vecino-destacado": function renderVecinoDestacado(page) {
        const content = `
          ${runningHead(page)}
          <span class="section-ribbon">${editable(page, "ribbon")}</span>
          ${imageSlot(page, "retrato", "Agregar el retrato del vecino", "vecino-destacado__imagen")}
          <p class="caption">${editable(page, "caption")}</p>
          <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
          <p class="page-deck">${editable(page, "deck")}</p>
          ${firma(page)}
          <div class="two-columns page-fill">
            <p class="body-copy lead-copy capitular">${editable(page, "body1")}</p>
            <p class="body-copy">${editable(page, "body2")}</p>
            <p class="body-copy">${editable(page, "body3")}</p>
            <p class="body-copy">${editable(page, "body4")}</p>
          </div>`;
        return pageFrame(page, content);
      },

      pasatiempos: function renderPasatiempos(page) {
        const content = `
          ${runningHead(page)}
          <span class="section-ribbon">${editable(page, "ribbon")}</span>
          <h2 class="page-title page-title--compact">${editable(page, "title")}</h2>
          <p class="page-deck">${editable(page, "deck")}</p>
          <div class="pasatiempos page-fill">
            <p class="body-copy">${editable(page, "body1")}</p>
            <div class="pasatiempos__juego">
              ${imageSlot(page, "juego", "Agregar imagen del pasatiempo", "pasatiempos__imagen")}
            </div>
            <p class="caption pasatiempos__solucion">${editable(page, "caption")}</p>
          </div>`;
        return pageFrame(page, content);
      }
    });
  }

  root.CascoRenderersExtra = Object.freeze({ create });
})(typeof window === "object" ? window : globalThis);
