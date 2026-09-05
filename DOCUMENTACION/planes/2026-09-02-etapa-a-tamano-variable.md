# Etapa A · Tamaño variable sin roturas · Plan de implementación

> **Para quien ejecute esto:** los pasos van con casilla (`- [ ]`) para ir marcándolos. Cada paso es una acción de dos a cinco minutos. No agrupes pasos.

**Objetivo:** que la revista pueda crecer y encoger —12, 16, 20, 24 páginas— sin que se rompan la publicidad, el sumario, el presupuesto de palabras ni el borrado de secciones.

**Arquitectura:** las reglas editoriales que hoy viven dentro del IIFE de `assets/app.js` —y por eso no se pueden probar— se mueven a `assets/core/modelo-editorial.js`, que es un módulo puro y ya está cubierto por `tests/integridad.test.mjs` mediante `loadCoreModule`. `app.js` queda como capa de DOM y delega la decisión en el modelo. Los diálogos nativos del navegador se reemplazan por el sistema de `<dialog>` que el taller ya usa en todas partes.

**Herramientas:** JavaScript de navegador sin empaquetador, `node --test`, `npm run check`.

**Especificación:** `DOCUMENTACION/especificaciones/2026-09-02-revista-de-barrio.md`, sección «Se rompe al cambiar el tamaño».

---

## Estructura de archivos

| Archivo | Responsabilidad | Qué pasa aquí |
| --- | --- | --- |
| `assets/core/modelo-editorial.js` | Reglas editoriales puras, sin DOM | Reciben `paginaAdmiteFaldon`, `filasDeSumario`, `factorPagina` |
| `assets/app.js` | Interfaz y DOM | Deja de decidir y llama al modelo; gana el diálogo de confirmación |
| `index.html` | Marcado del taller | Gana el `<dialog>` de confirmación |
| `assets/styles.css` | Aspecto | Pierde el bloque de tonos duplicado; gana el estilo del diálogo |
| `tests/integridad.test.mjs` | Pruebas | Recibe las pruebas de las tres reglas nuevas |

---

## Tarea 1 · El faldón se decide por la maqueta, no por el número de página

Hoy `AD_STRIP_EXCLUDED_PAGES = new Set([5, 9])` bloquea por número. Al agregar dos páginas, el reportaje se corre a la 7 y empieza a ofrecer aviso; el observatorio se corre a la 11 y hace lo mismo. Las dos son justo las que la regla protege.

**Archivos:**
- Modificar: `assets/core/modelo-editorial.js`
- Modificar: `assets/app.js:1253-1271`
- Probar: `tests/integridad.test.mjs`

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar al final de `tests/integridad.test.mjs`:

```js
test("el faldón se decide por la maqueta, no por el número de página", async () => {
  const model = loadCoreModule(
    await text("assets/core/modelo-editorial.js"),
    "CascoModeloEditorial",
    "assets/core/modelo-editorial.js"
  );

  // Una impar corriente se vende.
  assert.equal(model.paginaAdmiteFaldon({ number: 5, layout: "briefs" }, 12), true);

  // La apertura del reportaje no se vende, esté en la página que esté.
  assert.equal(model.paginaAdmiteFaldon({ number: 5, layout: "feature-open" }, 12), false);
  assert.equal(model.paginaAdmiteFaldon({ number: 7, layout: "feature-open" }, 16), false);

  // El observatorio declara sus fuentes al pie: tampoco se vende.
  assert.equal(model.paginaAdmiteFaldon({ number: 9, layout: "observatorio" }, 12), false);
  assert.equal(model.paginaAdmiteFaldon({ number: 11, layout: "observatorio" }, 16), false);

  // Al crecer la revista, la que antes estaba bloqueada por número se libera.
  assert.equal(model.paginaAdmiteFaldon({ number: 5, layout: "briefs" }, 16), true);

  // Cubiertas y páginas que ya son publicidad.
  assert.equal(model.paginaAdmiteFaldon({ number: 1, layout: "cover" }, 12), false);
  assert.equal(model.paginaAdmiteFaldon({ number: 11, layout: "back" }, 11), false);
  assert.equal(model.paginaAdmiteFaldon({ number: 9, layout: "publicidad-plena" }, 16), false);
  assert.equal(model.paginaAdmiteFaldon({ number: 9, layout: "publicidad-modulos" }, 16), false);

  // Las pares van a la izquierda del cuadernillo y nunca llevan faldón.
  assert.equal(model.paginaAdmiteFaldon({ number: 6, layout: "briefs" }, 16), false);

  // Entradas inválidas no revientan.
  assert.equal(model.paginaAdmiteFaldon(null, 12), false);
  assert.equal(model.paginaAdmiteFaldon({ layout: "briefs" }, 12), false);
});
```

- [ ] **Paso 2: Correr la prueba y confirmar que falla**

```bash
node --test tests/integridad.test.mjs
```

Se espera: falla con `model.paginaAdmiteFaldon is not a function`.

- [ ] **Paso 3: Escribir la regla en el modelo**

En `assets/core/modelo-editorial.js`, justo antes del bloque `root.CascoModeloEditorial = Object.freeze({` de la línea 285:

```js
  // El faldón se vende en las páginas impares: en un cuadernillo son las de la
  // derecha, las que el lector ve al abrir. Quedan fuera las cubiertas, las
  // páginas que ya son publicidad, y dos que no se venden por criterio
  // editorial: la apertura del reportaje, donde la revista pone su mejor
  // trabajo, y el observatorio, que declara al pie de dónde salen sus datos —un
  // aviso pagado bajo esa declaración pone en duda lo que la página acaba de
  // afirmar—.
  //
  // Antes esto era una lista de números de página. Bastaba agregar una página
  // al principio de la revista para que la protección cayera sobre la hoja
  // equivocada.
  const MAQUETAS_SIN_FALDON = Object.freeze([
    "cover",
    "back",
    "feature-open",
    "observatorio",
    "ads",
    "publicidad-plena",
    "publicidad-modulos"
  ]);

  const SET_MAQUETAS_SIN_FALDON = new Set(MAQUETAS_SIN_FALDON);

  function paginaAdmiteFaldon(pagina, totalPaginas) {
    if (!pagina) return false;
    const numero = Number(pagina.number);
    const total = Number(totalPaginas);
    if (!Number.isInteger(numero) || numero % 2 !== 1) return false;
    if (numero === 1 || numero === total) return false;
    return !SET_MAQUETAS_SIN_FALDON.has(pagina.layout);
  }
```

Y agregar al objeto exportado de la línea 285, junto a `TONOS_SECCION`:

```js
    MAQUETAS_SIN_FALDON,
    paginaAdmiteFaldon,
```

- [ ] **Paso 4: Correr la prueba y confirmar que pasa**

```bash
node --test tests/integridad.test.mjs
```

Se espera: pasa.

- [ ] **Paso 5: Conectar `app.js` al modelo**

En `assets/app.js`, reemplazar el bloque de las líneas 1253-1271 —desde el comentario `// El faldón se ofrece en las páginas impares` hasta el cierre de `pageAllowsAdStrip`— por:

```js
  // La regla vive en el modelo editorial, que es donde se puede probar.
  function pageAllowsAdStrip(page) {
    return modeloEditorial.paginaAdmiteFaldon(page, pages.length);
  }
```

Esto elimina `AD_STRIP_EXCLUDED_SEGMENTS` (línea 1257), que era un `Set` vacío y por lo tanto una condición que siempre pasaba, y `AD_STRIP_EXCLUDED_PAGES` (línea 1263).

- [ ] **Paso 6: Confirmar que no quedaron referencias sueltas**

```bash
grep -n "AD_STRIP_EXCLUDED" assets/app.js
```

Se espera: sin resultados.

- [ ] **Paso 7: Correr la comprobación completa**

```bash
npm run check
```

Se espera: pasa.

- [ ] **Paso 8: Comprobar en el taller**

Abrir `http://127.0.0.1:8787/`, abrir una edición, agregar dos páginas a «Sumario y carta editorial» con `+ pág.`, pasar a la vista «Todas» y confirmar que la apertura del reportaje —ahora en la página 7— no ofrece «Agregar un aviso al pie», y que la página 5, ahora de noticias breves, sí lo ofrece. Quitar después las dos páginas agregadas.

- [ ] **Paso 9: Commit**

```bash
git add assets/core/modelo-editorial.js assets/app.js tests/integridad.test.mjs
git commit -m "$(cat <<'EOF'
El aviso al pie caía en la página equivocada

La lista de páginas protegidas eran números fijos, 5 y 9. Bastaba agregar
una página al principio para que el reportaje y el observatorio quedaran
en venta y una página vendible quedara bloqueada.

La regla pasa al modelo editorial y decide por maqueta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 2 · El sumario deja de listarse a sí mismo

`contentsRows` descarta por número: `page.number <= 2 || page.number >= lastNumber`. Si la sección del sumario crece a tres páginas, la tercera aparece como una entrada del índice.

**Archivos:**
- Modificar: `assets/core/modelo-editorial.js`
- Modificar: `assets/app.js:1384-1406`
- Probar: `tests/integridad.test.mjs`

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar al final de `tests/integridad.test.mjs`:

```js
test("el sumario no se lista a sí mismo ni lista las cubiertas", async () => {
  const model = loadCoreModule(
    await text("assets/core/modelo-editorial.js"),
    "CascoModeloEditorial",
    "assets/core/modelo-editorial.js"
  );

  const paginas = [
    { number: 1, layout: "cover",     segmentId: "01_portada",     segmentTitle: "Portada",   tone: "gold" },
    { number: 2, layout: "index",     segmentId: "02_sumario",     segmentTitle: "Sumario",   tone: "gold" },
    { number: 3, layout: "editorial", segmentId: "02_sumario",     segmentTitle: "Sumario",   tone: "gold" },
    { number: 4, layout: "texto-2col",segmentId: "02_sumario",     segmentTitle: "Sumario",   tone: "gold" },
    { number: 5, layout: "briefs",    segmentId: "03_noticias",    segmentTitle: "Noticias",  tone: "ceramic" },
    { number: 6, layout: "advances",  segmentId: "03_noticias",    segmentTitle: "Noticias",  tone: "ceramic" },
    { number: 7, layout: "feature-open", segmentId: "04_reportaje",segmentTitle: "Reportaje", tone: "teja" },
    { number: 8, layout: "back",      segmentId: "10_contra",      segmentTitle: "Contraportada", tone: "gold" }
  ];

  const filas = model.filasDeSumario(paginas);
  const secciones = filas.map((f) => f.segmentId);

  assert.deepEqual(secciones, ["03_noticias", "04_reportaje"]);
  assert.equal(filas[0].marker, "05");
  assert.equal(filas[0].title, "Noticias");
  assert.equal(filas[0].tone, "ceramic");
  assert.equal(filas[1].marker, "07");
  assert.equal(filas[1].tone, "teja");

  assert.deepEqual(model.filasDeSumario([]), []);
});
```

- [ ] **Paso 2: Correr la prueba y confirmar que falla**

```bash
node --test tests/integridad.test.mjs
```

Se espera: falla con `model.filasDeSumario is not a function`.

- [ ] **Paso 3: Escribir la regla en el modelo**

En `assets/core/modelo-editorial.js`, debajo de `paginaAdmiteFaldon`:

```js
  // El sumario se arma sobre la estructura viva, no sobre los archivos de
  // plantilla. Antes descartaba por número —"todo lo que no sea 1, 2 ni la
  // última"—, así que en cuanto la sección del sumario crecía a tres páginas,
  // la tercera aparecía como una entrada del índice. Ahora descarta por
  // sección: la de la primera página, la de la última, y la que contiene el
  // sumario o la carta editorial.
  function filasDeSumario(paginas) {
    const lista = Array.isArray(paginas) ? paginas.filter(Boolean) : [];
    if (!lista.length) return [];

    const excluidas = new Set();
    excluidas.add(lista[0].segmentId);
    excluidas.add(lista[lista.length - 1].segmentId);
    lista.forEach((pagina) => {
      if (pagina.layout === "index" || pagina.layout === "editorial") {
        excluidas.add(pagina.segmentId);
      }
    });

    const porSeccion = new Map();
    lista.forEach((pagina) => {
      if (excluidas.has(pagina.segmentId)) return;
      const actual = porSeccion.get(pagina.segmentId);
      if (actual) {
        actual.numeros.push(Number(pagina.number));
      } else {
        porSeccion.set(pagina.segmentId, {
          titulo: pagina.segmentTitle,
          tono: pagina.tone || TONOS_SECCION[pagina.segmentId] || "gold",
          numeros: [Number(pagina.number)]
        });
      }
    });

    return [...porSeccion.entries()].map(([segmentId, datos]) => {
      const numeros = datos.numeros.slice().sort((a, b) => a - b);
      return {
        segmentId,
        title: datos.titulo,
        marker: String(numeros[0]).padStart(2, "0"),
        tone: datos.tono
      };
    });
  }
```

Y agregar al objeto exportado:

```js
    filasDeSumario,
```

- [ ] **Paso 4: Correr la prueba y confirmar que pasa**

```bash
node --test tests/integridad.test.mjs
```

Se espera: pasa.

- [ ] **Paso 5: Conectar `app.js`**

En `assets/app.js`, reemplazar el cuerpo completo de `contentsRows` (líneas 1384-1406) por:

```js
  // El sumario se arma sobre la estructura viva, no sobre los archivos de
  // plantilla: una sección agregada por el equipo aparece igual que las demás.
  function contentsRows() {
    return modeloEditorial.filasDeSumario(pages);
  }
```

El contrato que devuelve —`{ segmentId, title, marker, tone }`— es el mismo que consumen `renderIndex` (línea 1415) y la migración de claves antiguas (línea 3654), así que no hay que tocar ninguno de los dos.

- [ ] **Paso 6: Correr la comprobación completa**

```bash
npm run check
```

Se espera: pasa.

- [ ] **Paso 7: Comprobar en el taller**

Agregar dos páginas a «Sumario y carta editorial» y confirmar que el sumario de la página 2 no muestra una entrada «Sumario y carta editorial». Quitarlas después.

- [ ] **Paso 8: Commit**

```bash
git add assets/core/modelo-editorial.js assets/app.js tests/integridad.test.mjs
git commit -m "$(cat <<'EOF'
El sumario se listaba a sí mismo

Descartaba las páginas 1, 2 y la última por número. Al crecer la sección
del sumario a tres páginas, la tercera entraba al índice como si fuera
una sección más.

Ahora descarta por sección.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 3 · El objetivo de palabras descuenta el faldón

`wordBudgetState` ajusta el objetivo por formato de página pero no por si la página lleva aviso al pie. Un faldón ocupa 32 mm, cerca de un sexto de una A5: el redactor cumple el objetivo y la página desborda.

**Archivos:**
- Modificar: `assets/core/modelo-editorial.js`
- Modificar: `assets/app.js:155-189`
- Probar: `tests/integridad.test.mjs`

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar al final de `tests/integridad.test.mjs`:

```js
test("el objetivo de palabras baja cuando la página lleva aviso al pie", async () => {
  const model = loadCoreModule(
    await text("assets/core/modelo-editorial.js"),
    "CascoModeloEditorial",
    "assets/core/modelo-editorial.js"
  );

  const sinAviso = model.factorPagina({ conFaldon: false });
  const conAviso = model.factorPagina({ conFaldon: true });

  assert.ok(conAviso < sinAviso, "con aviso al pie el objetivo tiene que bajar");
  assert.equal(Number((conAviso / sinAviso).toFixed(2)), 0.82);

  // Sin argumentos se comporta como el factor de formato de siempre.
  assert.equal(model.factorPagina(), sinAviso);
});
```

- [ ] **Paso 2: Correr la prueba y confirmar que falla**

```bash
node --test tests/integridad.test.mjs
```

Se espera: falla con `model.factorPagina is not a function`.

- [ ] **Paso 3: Escribir la regla en el modelo**

En `assets/core/modelo-editorial.js`, debajo de `filasDeSumario`:

```js
  // Un faldón ocupa 32 mm del alto de la caja. En A5 la caja de texto mide unos
  // 180 mm, así que el aviso se lleva cerca de un 18 % del sitio. Sin este
  // descuento el taller pide las mismas palabras con aviso y sin él, y la
  // página termina desbordada o con un hueco.
  const FACTOR_FALDON = 0.82;

  function factorPagina(opciones) {
    const { formato: formatoPedido, conFaldon } = opciones || {};
    const base = factorFormato(formatoPedido);
    return conFaldon ? base * FACTOR_FALDON : base;
  }
```

Y agregar al objeto exportado:

```js
    FACTOR_FALDON,
    factorPagina,
```

- [ ] **Paso 4: Correr la prueba y confirmar que pasa**

```bash
node --test tests/integridad.test.mjs
```

Se espera: pasa.

- [ ] **Paso 5: Conectar `app.js`**

En `assets/app.js`, dentro de `wordBudgetState`, reemplazar la línea 159:

```js
    const factor = factorFormato();
```

por:

```js
    const factor = modeloEditorial.factorPagina({
      formato: formatoActual(),
      conFaldon: adStripEnabled(page)
    });
```

`adStripEnabled` ya está definida en `assets/app.js:1272` y `wordBudgetState` ya tiene `page` en alcance desde su línea 156.

- [ ] **Paso 6: Correr la comprobación completa**

```bash
npm run check
```

Se espera: pasa.

- [ ] **Paso 7: Comprobar en el taller**

Ir a una página impar que admita aviso, anotar el objetivo que muestra la barra inferior, activar «Agregar un aviso al pie» y confirmar que el objetivo baja alrededor de un 18 %.

- [ ] **Paso 8: Commit**

```bash
git add assets/core/modelo-editorial.js assets/app.js tests/integridad.test.mjs
git commit -m "$(cat <<'EOF'
El contador de palabras ignoraba el aviso al pie

Un faldón ocupa 32 mm, cerca de un sexto de una A5, y el objetivo seguía
siendo el mismo con aviso y sin él. Quien cumplía el objetivo desbordaba
la página.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 4 · Un diálogo de confirmación propio

`eliminarSeccion` usa `window.prompt`. En una ventana normal funciona; en un contexto embebido lanza excepción y la sección no se borra, sin ningún aviso. Es el único lugar del taller que no usa sus propios diálogos.

**Archivos:**
- Modificar: `index.html`
- Modificar: `assets/styles.css`
- Modificar: `assets/app.js:2244-2262`

- [ ] **Paso 1: Agregar el marcado del diálogo**

En `index.html`, inmediatamente antes de `</body>`:

```html
    <dialog class="confirm-dialog" id="confirmDialog" aria-labelledby="confirmTitle">
      <div class="dialog-header">
        <h2 id="confirmTitle">Confirmar</h2>
        <button type="button" class="icon-button" data-confirm-cancel aria-label="Cerrar">×</button>
      </div>
      <div class="dialog-body">
        <p id="confirmBody"></p>
        <div class="form-field" id="confirmField" hidden>
          <label for="confirmInput" id="confirmLabel">Escribe el nombre para confirmar</label>
          <input id="confirmInput" type="text" autocomplete="off" />
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button button--ghost" data-confirm-cancel>Cancelar</button>
        <button type="button" class="button button--primary" data-confirm-ok>Confirmar</button>
      </div>
    </dialog>
```

- [ ] **Paso 2: Darle el mismo aspecto que los demás diálogos**

En `assets/styles.css`, buscar el selector agrupado que empieza con `.identity-dialog,` y agregar `.confirm-dialog,` a esa lista y a la lista de `::backdrop` que le sigue. Después agregar debajo:

```css
.confirm-dialog {
  width: min(520px, calc(100vw - 32px));
}
```

- [ ] **Paso 3: Escribir el ayudante en `app.js`**

En `assets/app.js`, justo antes de `async function eliminarSeccion(indice) {` (línea 2244):

```js
  // Los diálogos nativos del navegador no existen en contextos embebidos: el
  // taller se quedaba sin confirmar y sin avisar. Todo lo destructivo pasa por
  // aquí, que es el mismo sistema de <dialog> que usa el resto del programa.
  function confirmarConDialogo({ titulo, cuerpo, etiqueta = "Confirmar", exigir = null }) {
    const dialogo = document.getElementById("confirmDialog");
    if (!dialogo) return Promise.resolve(false);
    const campo = dialogo.querySelector("#confirmField");
    const entrada = dialogo.querySelector("#confirmInput");
    const aceptar = dialogo.querySelector("[data-confirm-ok]");

    dialogo.querySelector("#confirmTitle").textContent = titulo;
    dialogo.querySelector("#confirmBody").textContent = cuerpo;
    aceptar.textContent = etiqueta;
    campo.hidden = !exigir;
    entrada.value = "";
    if (exigir) {
      dialogo.querySelector("#confirmLabel").textContent = `Escribe “${exigir}” para confirmar`;
    }

    return new Promise((resolver) => {
      function cerrar(valor) {
        dialogo.removeEventListener("close", alCerrar);
        aceptar.removeEventListener("click", alAceptar);
        cancelar.forEach((boton) => boton.removeEventListener("click", alCancelar));
        if (dialogo.open) dialogo.close();
        resolver(valor);
      }
      function alAceptar() {
        if (exigir && entrada.value.trim() !== exigir) {
          showToast("El nombre no coincide. No se quitó nada.");
          entrada.focus();
          return;
        }
        cerrar(true);
      }
      function alCancelar() { cerrar(false); }
      function alCerrar() { cerrar(false); }

      const cancelar = [...dialogo.querySelectorAll("[data-confirm-cancel]")];
      aceptar.addEventListener("click", alAceptar);
      cancelar.forEach((boton) => boton.addEventListener("click", alCancelar));
      dialogo.addEventListener("close", alCerrar);
      dialogo.showModal();
      requestAnimationFrame(() => (exigir ? entrada : aceptar).focus());
    });
  }
```

- [ ] **Paso 4: Usarlo en `eliminarSeccion`**

En `assets/app.js`, reemplazar las líneas 2249-2258 —desde `const escrito = window.prompt(` hasta el `return;` del `if (escrito.trim() !== seccion.titulo)`— por:

```js
    const confirmado = await confirmarConDialogo({
      titulo: `Quitar “${seccion.titulo}”`,
      cuerpo: `Esto quita ${cuantas} ${cuantas === 1 ? "página" : "páginas"} de la revista. `
        + "Los textos y las fotografías quedan dentro del respaldo, pero el taller no puede "
        + "devolverlos: una sección nueva se crea con páginas nuevas. Si crees que los vas a "
        + "necesitar, descarga un respaldo antes de seguir.",
      etiqueta: "Quitar la sección",
      exigir: seccion.titulo
    });
    if (!confirmado) return;
```

- [ ] **Paso 5: Correr la comprobación completa**

```bash
npm run check
```

Se espera: pasa.

- [ ] **Paso 6: Comprobar en el taller**

Crear una sección de prueba, borrarla desde el árbol y confirmar que aparece el diálogo del taller, que escribir mal el nombre no borra nada, y que escribirlo bien sí. Confirmar además que la consola del navegador no muestra `prompt() is not supported`.

- [ ] **Paso 7: Commit**

```bash
git add index.html assets/styles.css assets/app.js
git commit -m "$(cat <<'EOF'
Borrar una sección fallaba en silencio

eliminarSeccion pedía confirmación con window.prompt. Fuera de una
ventana normal del navegador eso lanza excepción, así que el botón no
hacía nada y no avisaba de nada.

Pasa al sistema de diálogos que ya usa el resto del taller.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 5 · Las demás confirmaciones nativas

Quedan siete llamadas a `window.prompt`, `window.confirm` y `window.alert`, incluida la de borrar una revista completa.

**Archivos:**
- Modificar: `assets/app.js` líneas 58, 65, 68, 3492, 4045, 4047, 4426

- [ ] **Paso 1: Listar las que quedan**

```bash
grep -n "window\.prompt\|window\.confirm\|window\.alert" assets/app.js
```

Se espera: siete resultados.

- [ ] **Paso 2: Reemplazar la de archivar una revista (línea 4045)**

```js
    if (action === "projectArchive") {
      const confirmado = await confirmarConDialogo({
        titulo: `Mover “${project.name}” a la papelera`,
        cuerpo: "Podrás restaurarla después desde la papelera.",
        etiqueta: "Mover a la papelera"
      });
      if (!confirmado) return;
    }
```

- [ ] **Paso 3: Reemplazar la de borrar una revista (línea 4047)**

```js
      const confirmado = await confirmarConDialogo({
        titulo: `Eliminar “${project.name}”`,
        cuerpo: "Esta eliminación no se puede deshacer. Descarga un respaldo antes si crees que vas a necesitar sus textos o fotografías.",
        etiqueta: "Eliminar para siempre",
        exigir: project.name
      });
      if (!confirmado) return;
```

- [ ] **Paso 4: Reemplazar la de reiniciar una revista (línea 4426)**

En `assets/app.js`, dentro del manejador de `resetButton`, reemplazar desde `const escrito = window.prompt(` hasta el `return;` del `if (escrito.trim() !== nombre)` por:

```js
    const confirmado = await confirmarConDialogo({
      titulo: `Reiniciar “${nombre}”`,
      cuerpo: "Esto borra todos los textos, fotografías y estados de esta revista y la deja como recién creada. "
        + "Las demás revistas no cambian. Antes de borrar se descarga un respaldo, pero si esa descarga falla no hay vuelta atrás.",
      etiqueta: "Reiniciar la revista",
      exigir: nombre
    });
    if (!confirmado) return;
```

El manejador ya es `async`, así que el `await` no obliga a cambiar nada más.

- [ ] **Paso 5: Agregar el diálogo de 16 o 18 páginas**

Los respaldos de la versión anterior no dicen cuántas páginas tenían. Esto no es un sí/no, así que necesita su propio diálogo. En `index.html`, junto al de confirmación:

```html
    <dialog class="legacy-dialog" id="legacyDialog" aria-labelledby="legacyTitle">
      <div class="dialog-header">
        <h2 id="legacyTitle">¿De cuántas páginas era?</h2>
        <button type="button" class="icon-button" data-legacy-cancel aria-label="Cerrar">×</button>
      </div>
      <div class="dialog-body">
        <p id="legacyBody"></p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button button--ghost" data-legacy-cancel>Cancelar</button>
        <button type="button" class="button button--ghost" data-legacy-pages="16">16 páginas</button>
        <button type="button" class="button button--primary" data-legacy-pages="18">18 páginas</button>
      </div>
    </dialog>
```

Y en `assets/app.js`, junto a `confirmarConDialogo`:

```js
  // Los respaldos de la versión anterior no registran su número de páginas.
  // Devuelve 16, 18, o null si la persona cancela.
  function preguntarProgramaHeredado(cuerpo) {
    const dialogo = document.getElementById("legacyDialog");
    if (!dialogo) return Promise.resolve(null);
    dialogo.querySelector("#legacyBody").textContent = cuerpo;
    return new Promise((resolver) => {
      const opciones = [...dialogo.querySelectorAll("[data-legacy-pages]")];
      const cancelar = [...dialogo.querySelectorAll("[data-legacy-cancel]")];
      function cerrar(valor) {
        opciones.forEach((b) => b.removeEventListener("click", alElegir));
        cancelar.forEach((b) => b.removeEventListener("click", alCancelar));
        dialogo.removeEventListener("close", alCancelar);
        if (dialogo.open) dialogo.close();
        resolver(valor);
      }
      function alElegir(evento) { cerrar(Number(evento.currentTarget.dataset.legacyPages)); }
      function alCancelar() { cerrar(null); }
      opciones.forEach((b) => b.addEventListener("click", alElegir));
      cancelar.forEach((b) => b.addEventListener("click", alCancelar));
      dialogo.addEventListener("close", alCancelar);
      dialogo.showModal();
    });
  }
```

- [ ] **Paso 6: Usarlo al arrancar (líneas 58-68)**

Reemplazar el bloque `if (migrationNotice?.code === "LEGACY_PROGRAM_AMBIGUOUS") { … }` por:

```js
    if (migrationNotice?.code === "LEGACY_PROGRAM_AMBIGUOUS") {
      const paginas = await preguntarProgramaHeredado(
        "Encontramos un borrador de la versión anterior, pero no indica si tenía 16 o 18 páginas. "
        + "Elige cuál era para recuperarlo ahora. Si cancelas, se conserva intacto para decidirlo más tarde."
      );
      if (paginas) {
        try {
          await projectStorage.recoverLegacy(paginas);
        } catch (migrationError) {
          showToast(migrationError?.message || "No se pudo recuperar el borrador antiguo; sus datos se conservaron sin cambios.", true);
        }
      }
    }
```

- [ ] **Paso 7: Sacar el `prompt` de la importación (línea 3492)**

`detectLegacyPageProgram` es síncrona y la llama `validatedBackupEntries`, que también lo es. Convertirla en asíncrona obligaría a propagar `await` por toda la cadena de importación. En vez de eso, el número de páginas se pregunta **antes** de validar y entra por las opciones que la función ya recibe.

Reemplazar `detectLegacyPageProgram` por:

```js
  function detectLegacyPageProgram(entries, options = {}) {
    const detectado = migraciones.detectarProgramaHeredado(entries);
    if (detectado) return detectado;
    const indicado = Number(options.programaHeredado);
    if (indicado === 16 || indicado === 18) return indicado;
    const error = new Error("Este respaldo antiguo no indica si tenía 16 o 18 páginas.");
    error.code = "LEGACY_PROGRAM_AMBIGUOUS";
    throw error;
  }
```

Pasar `options` en la llamada que `validatedBackupEntries` le hace, y en el manejador asíncrono que importa el respaldo, envolver la llamada:

```js
    try {
      resultado = validatedBackupEntries(storage);
    } catch (error) {
      if (error?.code !== "LEGACY_PROGRAM_AMBIGUOUS") throw error;
      const paginas = await preguntarProgramaHeredado(
        "Este respaldo antiguo no indica si tenía 16 o 18 páginas. Elige cuál era para importarlo."
      );
      if (!paginas) throw new Error("Importación cancelada.");
      resultado = validatedBackupEntries(storage, { programaHeredado: paginas });
    }
```

- [ ] **Paso 8: Darle aspecto al diálogo nuevo**

En `assets/styles.css`, agregar `.legacy-dialog,` a las mismas listas agrupadas donde se agregó `.confirm-dialog,` en la tarea 4, y debajo:

```css
.legacy-dialog {
  width: min(520px, calc(100vw - 32px));
}
```

- [ ] **Paso 9: Confirmar que no queda ninguna**

```bash
grep -n "window\.prompt\|window\.confirm\|window\.alert" assets/app.js
```

Se espera: sin resultados.

- [ ] **Paso 10: Correr la comprobación completa**

```bash
npm run check
```

Se espera: pasa.

- [ ] **Paso 11: Comprobar en el taller**

Importar un respaldo actual y confirmar que entra sin preguntar nada. Reiniciar una revista de prueba y confirmar que pide escribir su nombre en el diálogo del taller.

- [ ] **Paso 12: Commit**

```bash
git add index.html assets/app.js assets/styles.css
git commit -m "$(cat <<'EOF'
Fuera los últimos diálogos nativos

Quedaban siete, incluida la de borrar una revista entera. Todas fallan en
silencio en contextos embebidos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 6 · Borrar el bloque de tonos duplicado

El bloque viejo de cuatro tonos sigue en `assets/styles.css:3290`, tapado por el de `5779` por orden de cascada. Es código muerto que dice lo contrario del vigente.

**Archivos:**
- Modificar: `assets/styles.css:3290-3293`

- [ ] **Paso 1: Confirmar que el bloque vigente los cubre a los ocho**

```bash
grep -n "page--tone-" assets/styles.css
```

Se espera: los cuatro viejos en 3290-3293 y los ocho vigentes a partir de 5779.

- [ ] **Paso 2: Borrar las cuatro líneas viejas**

Eliminar de `assets/styles.css` exactamente estas cuatro:

```css
.page--tone-ceramic { --tone: var(--ceramic); --tone-ink: #275c79; }
.page--tone-palm    { --tone: var(--palm);    --tone-ink: var(--palm); }
.page--tone-wood    { --tone: var(--wood);    --tone-ink: var(--wood); }
.page--tone-gold    { --tone: var(--gold);    --tone-ink: var(--gold-text); }
```

El bloque `.mag-page { --tone: …; --tone-ink: …; }` que está justo encima **se conserva**: es el valor por defecto de cualquier página sin clase de tono.

- [ ] **Paso 3: Comprobar en el taller**

Recorrer las páginas en vista «Todas» y confirmar que cada sección conserva su color.

- [ ] **Paso 4: Commit**

```bash
git add assets/styles.css
git commit -m "$(cat <<'EOF'
Bloque de tonos duplicado

Los cuatro tonos viejos seguían escritos, tapados por los ocho nuevos.
Funcionaba por orden de cascada y decía lo contrario del vigente.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 7 · Comprobación de extremo a extremo

Es una comprobación manual: no hay pruebas automáticas de interfaz en el proyecto.

**Archivos:** ninguno.

- [ ] **Paso 1: Levantar el taller**

```bash
npm start
```

- [ ] **Paso 2: Recorrer los cuatro tamaños**

Crear una edición nueva y llevarla a 16, 20 y 24 páginas agregando páginas y secciones. En cada tamaño comprobar, en la vista «Todas»:

1. Los folios corresponden a la posición real.
2. El sumario muestra los números reales y no se lista a sí mismo.
3. La apertura del reportaje y el observatorio no ofrecen aviso al pie, sea cual sea su número de página.
4. Todas las demás impares —salvo la primera y la última— sí lo ofrecen.
5. El aviso de pliego dice «se encuaderna sin sobras» en 16, 20 y 24.

- [ ] **Paso 3: Volver a bajar**

Quitar páginas y secciones hasta volver a 12 y repetir las cinco comprobaciones.

- [ ] **Paso 4: Respaldo de ida y vuelta**

Exportar un respaldo JSON con 24 páginas, crear una revista nueva importándolo y confirmar que llega con las mismas 24 páginas, los mismos tonos y los mismos avisos.

- [ ] **Paso 5: Revisión final**

Abrir «Revisión final de imprenta» en cada tamaño y confirmar que el aviso de pliego aparece sólo cuando el total no es múltiplo de cuatro.

- [ ] **Paso 6: Commit del registro**

Si algo falló, anotarlo en `DOCUMENTACION/especificaciones/2026-09-02-revista-de-barrio.md` bajo «Se rompe al cambiar el tamaño» antes de seguir con la etapa B.

---

## Qué sigue

La etapa B —el rediseño visual— **no está planificada todavía a propósito**. Mientras se escribía esta especificación, `assets/styles.css` creció 828 líneas y `assets/app.js` cambió cerca de mil, sin commits. Parte del rediseño ya está implementada: `renderCover` ya tiene tres llamados y variante sin fotografía, `renderIndex` ya perdió el rango de la derecha y ganó un artículo destacado, y existe un bloque «Archivo Narrow carga la voz editorial» y una `.feature-open-page` con fotografía a sangre.

Planificar la etapa B sobre la lectura vieja produciría instrucciones para rehacer trabajo ya hecho. Antes de escribirla hay que levantar qué quedó dentro y qué falta, comparando el taller contra `assets/demo/edicion-24.html`.
