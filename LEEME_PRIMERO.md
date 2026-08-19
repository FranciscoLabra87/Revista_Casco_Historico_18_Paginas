# Taller Editorial de la Revista Casco Histórico

Este es un software local para crear, conservar y revisar varias ediciones independientes de una revista A5 de 18 páginas, incluida la portada y la contraportada. El PDF es sólo la salida final o de revisión: el trabajo editable permanece dentro del sistema y puede trasladarse mediante respaldos JSON.

## Inicio rápido

1. Haga doble clic en `ABRIR_REVISTA.cmd`.
2. El sistema abrirá `http://127.0.0.1:8787/` en el navegador.
3. En **Mis revistas**, cree una edición nueva, abra una existente o importe un respaldo.

Use siempre el lanzador. No abra `index.html` directamente para el trabajo habitual: `file://` y `http://127.0.0.1:8787` conservan datos en espacios separados del navegador. Consulte el procedimiento completo en [`DOCUMENTACION/MANUAL_SOFTWARE.md`](DOCUMENTACION/MANUAL_SOFTWARE.md).

Mantenga una sola pestaña del taller abierta. Si una segunda pestaña muestra **El taller ya está abierto**, continúe en la primera para proteger el autoguardado.

## Programa editorial

- P01: portada.
- P02: sumario, créditos y contacto.
- P03: carta editorial.
- P04: noticias breves.
- P05: avances de la agrupación.
- P06–P07: reportaje central.
- P08–P09: entrevista.
- P10–P11: memoria y patrimonio.
- P12: comunidad y servicios.
- P13: comercio local.
- P14: cartas y opinión vecinal.
- P15: agenda y datos útiles.
- P16: cultura y participación.
- P17: publicidad y colaboradores.
- P18: contraportada.

El programa detallado se encuentra en `DOCUMENTACION/PROGRAMA_18_PAGINAS.md`.

## Estructura

- `ABRIR_REVISTA.cmd`: acceso normal al software.
- `INICIAR_REVISTA.ps1` y `servidor-local.mjs`: inician la aplicación local.
- `index.html`: interfaz del taller editorial.
- `assets/`: identidad visual, estilos, funcionamiento, almacenamiento de ediciones y tipografías locales con sus licencias OFL.
- `segments/`: catorce carpetas independientes para las secciones editoriales.
- Cada segmento contiene `segmento.js`, su explicación y una carpeta `imagenes`.

Las carpetas de segmentos forman la plantilla común. El contenido de cada edición se guarda por separado en IndexedDB dentro del navegador.

## Uso recomendado

1. Cree o abra una revista desde **Mis revistas**.
2. Use el árbol lateral para recorrer los segmentos y las 18 páginas.
3. Abra **Datos de edición**, complete la información y confirme que fue comprobada. El sistema la reutiliza en las páginas correspondientes.
4. Presione **Editar** para cambiar textos y fotografías. Cada foto exige descripción accesible, crédito y confirmación de permiso. Si modifica una página aprobada, vuelve automáticamente a estado pendiente.
5. Use **Respaldar edición** con frecuencia. El archivo v2 contiene sólo la revista activa.
6. Ejecute **Revisión final** para detectar páginas pendientes, texto de muestra, marcadores, fotografías o fichas incompletas, baja resolución y contenido fuera del marco A5.
7. Si todavía hay observaciones, genere sólo un PDF de revisión. El sistema añade automáticamente la marca **BORRADOR · NO DISTRIBUIR**. Los problemas críticos bloquean la salida hasta corregirse.
8. Para una copia A5 de oficina o digital, presione **Guardar PDF** y elija papel A5, escala 100 %, márgenes ninguno y gráficos de fondo.

## Respaldo y copias JSON

El guardado automático usa IndexedDB y queda sólo en este navegador y en este dispositivo. No es un respaldo externo. Exporte una copia JSON y guárdela en una carpeta segura o en otro medio.

El sistema acepta respaldos v2 actuales y copias v1 del editor anterior. Toda importación crea una revista nueva e independiente; no reemplaza el proyecto abierto. Las copias antiguas de 16 páginas se pueden redistribuir a la estructura actual de 18 páginas. Abra únicamente archivos creados por este sistema y recibidos de una fuente confiable.

## Fotografías, permisos y créditos

Antes de publicar una imagen, confirme su archivo original, autor, permiso de publicación, pie de foto y crédito exacto. Use `PLANTILLAS/FICHA_FOTOGRAFIA.md` y el archivo `LEEME_IMAGENES.txt` de cada carpeta `imagenes`.

## Qué tipo de PDF se obtiene

- **PDF de revisión:** puede contener pendientes; el sistema incorpora la marca visible **BORRADOR · NO DISTRIBUIR** y no se usa como archivo final.
- **PDF A5 de oficina o digital:** las 18 páginas sirven para revisión en pantalla, distribución digital o impresión común en A5 después del control de cierre.
- **Cuadernillo doblado y corcheteado:** suele necesitar una cantidad de páginas múltiplo de cuatro. Consulte a la imprenta si debe ampliar la edición a 20 páginas antes de diseñar los pliegos.
- **Imprenta profesional:** consulte primero sus requisitos. La salida actual es A5 y no agrega sangrado, marcas de corte, imposición ni un perfil de color de imprenta. Si la imprenta exige esos elementos, debe preparar y validar una salida distinta.

El manual completo del software está en [`DOCUMENTACION/MANUAL_SOFTWARE.md`](DOCUMENTACION/MANUAL_SOFTWARE.md). La explicación de los controles Ultra está en [`DOCUMENTACION/GUIA_VERSION_ULTRA.md`](DOCUMENTACION/GUIA_VERSION_ULTRA.md).
