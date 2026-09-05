# Revista de barrio contemporánea · especificación de diseño

Fecha: 2 de septiembre de 2026
Rama: `mejoras-auditoria`

## Qué se entrega

**El cambio va dentro del taller.** El resultado no son archivos HTML sueltos: es
que el editor produzca estas páginas, y que la edición de prueba se arme usando
el editor.

Las maquetas de `assets/demo/edicion-prueba.html` (12 páginas) y
`assets/demo/edicion-24.html` (24 páginas) son **andamio**: sirven de referencia
visual mientras se implementa, y se borran cuando el taller produzca lo mismo.
Ninguna de las dos es el entregable.

## El problema

Las páginas se leían como un informe universitario, no como una revista. Seis
causas, todas de diseño de página:

1. **Todas abren igual**: rúbrica, titular, bajada, «POR [NOMBRE]», filete. Doce
   veces. La uniformidad es lenguaje de documento.
2. **La retícula manda sobre la fotografía**: las imágenes van en cajas
   alineadas, con borde y proporción fija, siempre debajo del titular.
3. **Todo enmarcado**: «El barrio en breve» eran seis recuadros idénticos. Eso es
   una rúbrica de evaluación.
4. **Un solo tono tipográfico**: Cinzel en todos los titulares. Cinzel es letra
   de inscripción; sin contrapeso, suena a acta municipal.
5. **Sin color**: los cuatro tonos de sección eran casi indistinguibles.
6. **Rótulos duplicados**: el reportaje decía «Reportaje central» y debajo, en
   una banda, «Reportaje principal».

## Orden de trabajo

El tamaño de la revista es una decisión editorial de cada número, no una
estructura escrita en el código. Por eso va primero.

**Etapa A · Que la revista crezca y encoja sin romperse.** Arreglar lo que hoy
se rompe al cambiar el número de páginas. Sin esto, cualquier rediseño hereda los
mismos errores.

**Etapa B · El rediseño visual.** Los seis movimientos, dentro de los
renderizadores y del CSS del taller.

**Etapa C · Armar la edición de prueba con el editor.** Reproducir la maqueta
aprobada usando el taller: crear la edición, agregar secciones y páginas, cargar
las fotografías de `assets/demo/` y los textos. Si algo no se puede armar desde
el editor, es un defecto de la etapa A o B, no una excusa para volver al HTML
suelto. Al terminar, borrar los dos archivos de andamio.

## Estado actual, verificado en vivo

Se recorrió el taller llevando la edición piloto de 12 a 14 y a 16 páginas, y de
vuelta a 12.

### Ya funciona

- **`+ pág.`** agrega páginas a una sección. Los folios se renumeran, la página
  nueva recibe identificador y un selector con las 7 maquetas del catálogo, y el
  presupuesto de palabras se ajusta por maqueta vía `CATALOG_LAYOUT_WORD_BUDGETS`.
- **«Agregar una sección»** crea una sección con título, propósito, su propio
  tono, posición entre las existentes y **cuántas páginas tiene, cada una con su
  maqueta**. Éste es el mecanismo que soporta «dos páginas por sección».
- **El sumario se recalcula solo** con los números de página reales
  (`contentsRows`).
- **El aviso de pliego** (`avisoDePliego`, `assets/app.js:2204`) avisa cuando el
  total no es múltiplo de cuatro, y aparece en el árbol y en la revisión final.
- **Los ocho tonos ya están en el código**: `TONOS_SECCION` en
  `assets/core/modelo-editorial.js:81` le da su color a cada sección, y las ocho
  clases `.page--tone-*` están en `assets/styles.css:5779`. Esta parte de la
  especificación original ya no hay que hacerla.

### Se rompe al cambiar el tamaño

**A1 · La protección de publicidad sigue al número de página, no a la sección.**
`AD_STRIP_EXCLUDED_PAGES = new Set([5, 9])` en `assets/app.js:1263`. Medido: al
agregar dos páginas, el reportaje pasó a la página 7 y empezó a ofrecer faldón, y
el observatorio pasó a la 11 e hizo lo mismo. Las dos son justo las que la regla
protege. La página 5, que pasó a ser noticias breves y sí se podría vender, quedó
bloqueada. **Es el arreglo más urgente**: cada cambio de tamaño vende publicidad
donde no corresponde. Debe decidirse por `page.layout`, no por `page.number`.

**A2 · Borrar una sección usa `window.prompt`.** `assets/app.js:2249`. Funciona en
una ventana normal del navegador, pero lanza excepción y falla en silencio en
contextos embebidos. Hay ocho llamadas nativas a `prompt`/`confirm`/`alert`,
incluida la de borrar una revista completa (`assets/app.js:4045`). Es el único
lugar del taller que no usa sus propios diálogos. Pasar todas al sistema de
`<dialog>` que ya existe.

**A3 · El sumario se lista a sí mismo.** `contentsRows` descarta las páginas con
`number <= 2`. Si la sección del sumario crece más allá de la página 2, sus
páginas siguientes aparecen como una entrada del índice. Debe descartarse por
sección, no por número.

**A4 · El presupuesto de palabras ignora el faldón.** `wordBudgetState` en
`assets/app.js:155` ajusta el objetivo por formato de página pero no por si la
página lleva aviso al pie. Un faldón ocupa 32 mm, cerca de un sexto de una A5.
Con el aviso activado, el taller pide las mismas palabras que sin él y la página
desborda o queda con un hueco.

**A5 · Bloque de tonos duplicado.** El bloque viejo de cuatro tonos sigue en
`assets/styles.css:3290`, tapado por el nuevo de `5779`. Funciona por orden de
cascada, pero es código muerto que confunde. Eliminarlo.

## Etapa B · Los seis movimientos

**1 · Archivo Narrow manda en titulares.** Cinzel queda sólo para el nombre de la
revista en portada y contraportada. Ambas fuentes ya están en `assets/fonts/`.

**2 · La fotografía se lleva la mitad.** En la apertura de reportaje ocupa los
118 mm superiores a sangre, y el titular se apoya sobre ella.

**3 · Nada enmarcado.** Los seis recuadros iguales de «breves» pasan a un brief
principal con fotografía y varios cortos separados por filete.

**4 · Color de sección con voltaje.** Ya implementado (ver estado actual).

**5 · El sumario deja de ser índice.** Fuera el filete de puntos y el número a la
derecha. Un artículo destacado con fotografía y una lista de números grandes en
el color de su sección. Los créditos se disuelven en una línea al pie.

**6 · Un rótulo por página.** La rúbrica y la banda de sección se funden.

### Reglas que salieron de las maquetas

**Interlineado y tildes.** En español las mayúsculas llevan tilde. Con
`line-height` bajo `0.95`, el acento de la segunda línea queda tapado por la caja
de la línea anterior y «QUEDÓ» se imprime «QUEDO». Ningún titular en mayúsculas
baja de `0.95`, y toda prueba lleva una palabra acentuada en el titular.

**El reportaje: una foto grande y una chica.** La apertura lleva la fotografía
grande a sangre. La continuación lleva **una fotografía chica con su pie y las
cifras del tema**, no otra grande. La misma proporción aplica al resto de las
secciones de dos páginas: apertura con imagen grande, continuación con imagen
chica y datos si los hay.

**La segunda página se gana.** Una sección recibe su segunda página cuando tiene
una segunda fotografía real o datos reales. Si no, se queda en una. Repartir
páginas por decreto llena la revista de relleno, que es exactamente lo que la
hacía parecer un informe.

**Apertura sin fotografía.** Cuando el hueco de imagen está vacío, el titular
crece y ocupa la banda superior con el color de la sección de fondo. No es un
hueco esperando una foto: es una apertura que funciona sin ella.

### Dónde vive cada cosa

Los renderizadores de `assets/app.js:2000` emiten HTML semántico con clases y el
aspecto vive en `assets/styles.css`. La mayor parte del trabajo es CSS. Sólo
cuatro páginas necesitan además cambio de estructura:

| Renderizador | Qué cambia |
| --- | --- |
| `renderCover` | El logotipo sale de `.cover-masthead` y se va a los créditos del sumario. El nombre ocupa el ancho de la caja sobre la fotografía. Los `cover-teaser` pasan a tres, con rótulo de sección y frase, sin número de página. |
| `renderIndex` | `.contents-row` pierde el rango de la derecha. Se agrega un bloque destacado con hueco de fotografía. `.credits-box` pasa de recuadro lateral a línea de pie. |
| `renderBriefs` | El primer brief se separa: gana hueco de fotografía y clase propia. Los demás quedan en una malla sin recuadro. |
| `renderFeatureOpen` | El hueco de fotografía sube antes del titular y pasa a sangre. La banda de sección duplicada se elimina. Se agrega una cita destacada. |

Los ocho restantes del programa base —`advances`, `feature-close`, `voices`,
`heritage`, `observatorio`, `community`, `letters`, `back`— heredan tipografía,
color y ornamento sin cambio de estructura. `feature-close` gana además el hueco
de fotografía chica y el bloque de cifras.

Los quince renderizadores del catálogo no se rediseñan uno a uno, pero deben
quedar revisados para que no choquen.

## Publicidad

El modelo comercial existe y no cambia; sólo cambia cómo se ve.

**Faldón al pie.** `pageAllowsAdStrip` (`assets/app.js:1265`) lo permite en
páginas impares, nunca en la primera ni la última, y nunca en la apertura del
reportaje ni en la página que declara sus fuentes. En el registro nuevo lleva
filete superior de 0.8 mm en el color de la sección, el rótulo encima, y una
retícula de texto más imagen de 34 mm. Ocupa 32 mm y la caja de la página se
acorta para dejarle sitio.

**El rótulo es obligatorio y va siempre.** `ROTULOS_COMERCIALES`
(`assets/app.js:578`): «Publicidad», «Contenido patrocinado», «Espacio cedido».
Regla salida de la maqueta: **el rótulo nunca va en blanco sobre una
fotografía**. En el aviso a página completa baja al pie crema.

**Contraportada.** Dos versiones que el taller ya alterna
(`contraportadaComercial`, `assets/app.js:1919`): vendida como aviso a página
completa, o institucional. Ninguna carga los créditos de la revista.

**Espacio sin vender.** El hueco libre se dibuja como recuadro punteado con la
dirección de contacto: se ofrece, no se disimula.

## Verificación

`npm run check` —sintaxis más `tests/integridad.test.mjs`— debe seguir pasando.

**Etapa A:**

1. Llevar una edición de 12 a 16 y a 24 páginas y de vuelta, agregando y quitando
   páginas y secciones.
2. Comprobar que el faldón se ofrece y se bloquea según la sección, no según el
   número, en cada uno de esos tamaños.
3. Borrar una sección y una revista sin diálogos nativos.
4. Hacer crecer la sección del sumario y comprobar que no se lista a sí misma.
5. Activar un faldón y comprobar que el objetivo de palabras baja.

**Etapa B:**

6. Las páginas del programa base, una por una y en vista «Todas», donde el ritmo
   se juzga mejor.
7. Cada apertura con fotografía y sin fotografía.
8. Un titular con tilde en cada apertura.
9. Los tres formatos: A5, A4 y tabloide de 280 × 400 mm.
10. Vista previa de impresión, salida de oficina y salida de imprenta.
11. Una edición guardada de antes del cambio, que debe abrir sin perder su tono.
12. Contraste de cada `--tone-ink` sobre el papel crema: mínimo 4.5:1.

**Etapa C:**

13. La edición de prueba armada íntegramente desde el editor, comparada contra
    `assets/demo/edicion-24.html`.
14. Respaldo JSON exportado e importado sin pérdida.
15. Borrar los dos archivos de andamio de `assets/demo/`.

## Fuera de alcance

No se cambia el chrome del taller —eso quedó en
`2026-09-02-morfismo-editorial.md`, congelado—. No se agregan tipografías. No se
toca la retícula de seis columnas ni las medidas en mm de caja, margen y línea
base. No se fija un número de páginas en el código: 12, 16, 20 y 24 tienen que
funcionar igual.
