# Morfismo Editorial · especificación de diseño

> **Superada y congelada el 2 de septiembre de 2026.** Esta especificación
> cambiaba el aspecto del taller. El problema real estaba en la revista, no en
> la herramienta: las páginas se leían como un informe universitario. La
> dirección vigente es
> [`2026-09-02-revista-de-barrio.md`](2026-09-02-revista-de-barrio.md). Lo de
> aquí queda escrito por si algún día toca el chrome.

Fecha: 2 de septiembre de 2026
Rama: `mejoras-auditoria`
Archivo afectado: `assets/styles.css` (único)

## Qué se busca

La interfaz del taller pasa de **papel plano** —bordes de 1 px, esquinas
redondeadas, sombras difusas— a **capas de imprenta**: planos sólidos, filo duro
y una sombra dorada desplazada que imita un registro que no coincide. Es un
artefacto real de imprenta, y el taller es una herramienta de imprenta: el
vocabulario visual viene del oficio, no del sistema operativo.

La hoja de revista recibe un tratamiento distinto y deliberadamente opuesto:
relieve blando de papel, para que sea el único objeto de la pantalla que se lee
como una hoja apoyada sobre una mesa.

Se descartaron dos alternativas:

- **Neumorfismo cálido** (todo brota del mismo papel, sin bordes). Sin borde, un
  botón deja de parecer botón. El taller lo usan vecinos, no diseñadores.
- **Vidrio editorial** (paneles translúcidos sobre una mesa de color). Dos
  problemas duros: una mesa de color altera cómo se juzga el crema de la hoja, y
  juzgar color es el trabajo; y `backdrop-filter` sobre `.page-group--all` —que
  pinta las doce páginas a la vez dentro de un `zoom:`— es caro y tironea.

## Alcance

**Entra:** todo el chrome del taller. Portada de proyectos, barra superior, árbol
lateral, tarjetas de edición, botones, campos, diálogos, editor de fotografía,
panel de formato, asistente editorial, revisión final, guía de primer uso,
avisos, y los controles de edición que se dibujan sobre la página.

**Entra también:** la sombra de `.mag-page` en pantalla.

**No entra:**

- El interior de `.mag-page`: retícula, medidas en mm, tipografía, ornamento,
  capitulares, folios, cenefas, marcas de corte.
- La paleta y las tipografías. Los tokens de color de `:root` no se tocan.
- `@media print` y `body.print-press`, que siguen anulando toda sombra. La hoja
  impresa sale exactamente igual que hoy.
- Los radios expresados en mm.
- Las formas circulares (`border-radius: 50%`): logotipo de la revista,
  `.status-dot`, `.circle-button`, `.page-status`, `.guia__mark`, `.fmt-step`,
  `.fmt-color`, `.switch::after`, `.preflight-status__mark`. Un círculo no
  tiene filo que endurecer.
- Las barras de progreso `.progress-track` y `.project-card__progress`, que
  siguen redondeadas: representan una medida continua, no una caja.

## 1 · Tokens

Se agregan a `:root`, junto a los que ya existen. `--shadow` ya existía y cambia
de valor; hoy sólo lo consume `.mag-page` (línea 1170), así que el cambio está
contenido.

```css
/* Morfismo Editorial · relieve de la interfaz */
--m-filo: 1px;                                   /* grosor: divisiones, campos, filas */
--m-filo-fuerte: 2px;                            /* grosor: tarjetas, diálogos, botones, paneles */
--m-radio: 0;
--m-sombra: 4px 4px 0 var(--gold);               /* registro, nivel activo */
--m-sombra-corta: 3px 3px 0 var(--gold);         /* registro en elementos pequeños */
--m-sombra-larga: 6px 6px 0 var(--gold);         /* registro en hover */
--m-sombra-tinta: 5px 5px 0 rgba(57, 30, 20, 0.28);  /* registro, nivel flotante */

/* La hoja no lleva registro: lleva relieve de papel. */
--shadow: 10px 12px 26px rgba(87, 56, 29, 0.22), -8px -8px 20px rgba(255, 253, 247, 0.8);
```

## 2 · Los tres niveles de relieve

El riesgo de esta dirección es el ruido: con muchos elementos en pantalla, tanta
sombra dorada cansa. El control es una jerarquía de tres niveles.

| Nivel | Quién | Qué lleva |
| --- | --- | --- |
| **Reposo** | paneles, listas, campos, filas del árbol, avisos, secciones de diálogo | filo duro, radio 0, **sin** registro |
| **Activo** | botones, página actual del árbol, tarjeta de revista con foco, chip activo, pestaña activa del control segmentado | registro dorado de 3 a 4 px |
| **Flotante** | diálogos, panel de formato, asistente, guía, toast | filo fuerte más registro de tinta, en lugar de sombra difusa |

**Regla dura: un nivel por elemento.** Si el contenedor ya lleva registro, sus
hijos no lo llevan. Esto es lo que impide que la pantalla se llene de sombras.

**Hover.** Hoy `.project-card:hover` hace `translateY(-2px)` y agranda el
desenfoque. Pasa a: el registro pasa de `--m-sombra-corta` a
`--m-sombra-larga` y el elemento se desplaza `-1px, -1px`. Se lee como una hoja
despegándose de su propia sombra. El bloque `@media (prefers-reduced-motion:
reduce)` de la línea 3249 anula el desplazamiento y deja sólo el cambio de
sombra.

**Foco.** `:focus-visible` conserva su `outline: 3px solid var(--focus)` con
`outline-offset: 3px`. Es el piso de accesibilidad y va por fuera del registro,
así que no colisiona. No se toca.

## 3 · Reemplazos concretos

`assets/styles.css` tiene 103 declaraciones `border-radius` y 30 `box-shadow`.
Ninguna declaración en px vive dentro de `.mag-page`: la página usa mm. Se
verificó también que no hay `border-radius` ni `box-shadow` en línea en
`index.html` ni en los archivos `.js`.

### Radios

Todas las declaraciones en px pasan a `var(--m-radio)`, salvo las exclusiones
listadas en «No entra». Esto incluye las píldoras de `999px`
—`.project-card__status`, `.severity-label`, `.word-budget`,
`.page-nav-complete`, `.fmt-chip`, `.ad-strip-remove`, `.list-controls`,
`.back-mode-toggle`, `.print-mode-notice::before`—, que se cuadran: en capas de
imprenta no conviven dos vocabularios de forma.

### Bordes

`--m-filo` y `--m-filo-fuerte` son grosores, y se escriben en la forma
abreviada: `border: var(--m-filo-fuerte) solid var(--chocolate)`. Los bordes de
1 px del chrome suben al grosor fuerte en tarjetas, diálogos, botones y paneles,
y se quedan en el grosor fino en divisiones internas, campos de formulario y
filas de lista. El color pasa de
`var(--line)` —que es `rgba(87, 56, 29, 0.2)`, casi invisible— a
`var(--chocolate)` en el nivel fuerte, para que el filo sea un filo.

### Sombras

- `.project-card`, `.button--primary`, `.segmented-control button.is-active`,
  `.project-card__preview`: registro dorado.
- `.preflight-dialog` y hermanos, `.formato`, `.assistant`, `.guia`, `.toast`:
  registro de tinta. Los paneles laterales pierden su `-12px 0 34px` difuso.
- `.project-home__header` y `.topbar` pierden el `0 1px 0 rgba(255,255,255,…)`,
  que era un realce de bisel: sobra cuando hay un filo de 2 px.
- El `backdrop-filter: blur(3px)` del `::backdrop` de los diálogos se retira. Un
  fondo desenfocado es vocabulario de vidrio, no de imprenta; el velo sólido
  `rgba(29, 20, 13, 0.65)` se queda.
- `.mag-page` toma el nuevo `--shadow`.
- `.button--primary` pierde su anillo `inset 0 0 0 1px var(--gold)`: con
  registro dorado detrás, el anillo dorado encima es la misma tinta contada dos
  veces.
- Se conservan sin cambios los `inset 0 0 0 …` que marcan estado en
  `.page-status`, porque son señalización, no relieve.

### Controles sobre la página

`.page-quitar`, `.segment-tool`, `.list-controls`, `.ad-strip-remove`,
`.ad-strip-placeholder__plus`, `.page-complete-toggle`, `.page-overflow-badge`
son interfaz, no impresión, y siguen el lenguaje nuevo. Pero se quedan en el
nivel **reposo**: van dibujados encima de la hoja, y un registro dorado ahí
compite con la página. Sus sombras en mm se retiran.

## Verificación

`npm run check` (sintaxis más `tests/integridad.test.mjs`) no cubre CSS, pero
debe seguir pasando: ningún archivo `.js` se toca.

Revisión visual, con el taller abierto en `http://127.0.0.1:8787/`:

1. Portada de proyectos, con tarjetas y con la papelera desplegada.
2. Taller: barra, árbol, tarjeta de edición, página única.
3. Vista de todas las páginas (`.page-group--all`), que es donde el ruido se
   nota primero.
4. Diálogos: datos de edición, identidad, formato, imprimir, revisión final.
5. Editor de fotografía y panel de formato.
6. Asistente editorial y guía de primer uso.
7. Interruptor de marcas de edición.
8. Vista previa de impresión del navegador: la hoja debe salir sin sombra, igual
   que hoy.
9. Recorrido con Tab: el anillo de foco debe seguir visible sobre el registro.

## Fuera de alcance

No se cambia la paleta, la tipografía, la estructura del HTML, ni ningún
comportamiento. No se agrega modo oscuro. No se agrega un interruptor para
volver al aspecto anterior: el aspecto anterior queda en el historial de git.
