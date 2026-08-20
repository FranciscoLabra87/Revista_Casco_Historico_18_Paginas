# Guía de la versión Ultra

La versión Ultra agrega una capa de control editorial al sistema ramificado de 12 páginas sin cambiar el formato A5 ni la identidad visual patrimonial.

Las familias Cinzel, Cormorant Garamond y Source Sans 3 se incluyen localmente en `assets/fonts`, en formato WOFF2 con el subconjunto latino completo y junto con sus licencias OFL. Por eso la composición no depende de que estén instaladas en el computador.

## 1. Programa editorial

La edición incluye portada y contraportada:

- P01 portada; P02 sumario y créditos; P03 editorial.
- P04 noticias breves; P05 avances de la agrupación.
- P06–P07 reportaje central; P08–P09 entrevista; P10–P11 memoria y patrimonio.
- P12 comunidad y servicios; P13 comercio local; P14 cartas y opinión.
- P15 agenda y datos útiles; P16 cultura y participación.
- P17 publicidad y colaboradores; P18 contraportada.

Consulte el detalle en `PROGRAMA_12_PAGINAS.md`.

## 2. Datos generales de edición

El botón `Datos generales de edición` centraliza:

- nombre y fecha de la edición;
- responsable editorial;
- correo y teléfono o WhatsApp;
- fecha límite para recibir aportes;
- ubicación y frase institucional.

Al guardar, esos datos se aplican en portada, contacto editorial, firma, convocatoria y contraportada. Las páginas afectadas vuelven a estado pendiente para que sean revisadas otra vez.

La confirmación institucional registra que una persona responsable comprobó esos datos. Cualquier cambio obliga a confirmarlos nuevamente antes del cierre.

## 3. Estados por página

Cada página se puede marcar como lista durante la edición sólo cuando no conserva advertencias ni problemas críticos. El árbol lateral muestra el avance de las 12 páginas. Si se cambia un texto o una fotografía, la aprobación de esa página se retira automáticamente.

## 4. Revisión final

La revisión final analiza las 12 páginas, aunque en pantalla se vea una sola o una doble página. Comprueba:

- estructura y orden de las 12 páginas;
- páginas aún no aprobadas;
- fotografías faltantes;
- descripción accesible, crédito y confirmación de permiso de cada fotografía incorporada;
- resolución estimada de las fotografías cargadas;
- resolución del archivo original frente a los 300 ppp que pide una imprenta;
- marcadores entre corchetes que todavía deben reemplazarse;
- textos de muestra que siguen exactamente iguales al modelo;
- extensión de la página frente al rango del programa editorial;
- texto horizontal o vertical fuera del marco A5;
- datos generales incompletos;
- recordatorio de conservar los archivos fotográficos originales.

Cada observación incluye un botón para ir directamente a la página que debe corregirse. Los desbordes de texto también aparecen como una alerta sobre la hoja y bloquean su aprobación hasta corregirlos.

La cabecera de la portada es editable, y la revisión avisa si se aparta de la identidad institucional: no lo impide, sólo pide confirmarlo, porque esa cabecera identifica a la revista de un número al siguiente.

La detección de texto de muestra compara cada campo con el valor del modelo: si el texto sigue igual, aparece en la lista con el nombre del campo. Por eso el control sigue funcionando aunque se edite un archivo `segmento.js`.

Las observaciones de extensión y de resolución de imprenta son informativas: avisan, pero no bloquean la aprobación de la página.

El sistema exige registrar crédito y confirmar el permiso, pero no puede comprobar por sí solo que la declaración sea verdadera. El equipo debe conservar los originales y comprobantes fuera del navegador y realizar el control humano antes de aprobar el PDF final.

## 5. Copia editable

`Respaldar edición` descarga un archivo JSON v2 con textos, estados, datos generales, fotografías y sus fichas de la revista activa. Al importar una copia v1 o v2, el sistema valida su estructura y crea una revista nueva e independiente; no reemplaza ni mezcla la edición abierta. Las copias v1 del programa antiguo de 16 páginas se pueden redistribuir a la estructura actual de 12 páginas.

El guardado automático y las fotografías quedan sólo en el navegador de este dispositivo. No son un respaldo externo. Conviene usar archivos JPEG o WebP optimizados, descargar copias editables con frecuencia y guardarlas en otro lugar seguro.

Abra sólo copias JSON creadas por este sistema y entregadas por su propio equipo. Revise el nombre y la fecha antes de importarlas; el archivo se agregará a **Mis revistas** como un proyecto nuevo.

## 6. Salida PDF

`Guardar PDF` ejecuta primero la revisión final. Antes de imprimir, el sistema:

- monta automáticamente las 12 páginas en orden;
- desactiva las marcas y controles de edición;
- espera las fuentes disponibles y dos ciclos de dibujo del navegador;
- usa páginas A5 de 148 × 210 mm sin márgenes añadidos.

### PDF de revisión

Si quedan observaciones, el archivo es sólo para revisión y el sistema coloca automáticamente la marca **BORRADOR · NO DISTRIBUIR** en todas las páginas. Si existe un problema crítico, la salida PDF se bloquea hasta corregirlo.

### PDF A5 de oficina o digital

Cuando el control de cierre esté completo, puede guardar las 12 páginas para pantalla o impresión común. En el cuadro del navegador, elija `Guardar como PDF`, papel A5, escala 100 %, márgenes ninguno y gráficos de fondo activados.

### Cuadernillo e imprenta profesional

Una revista doblada y corcheteada suele requerir un total de páginas múltiplo de cuatro. Antes de enviarla, consulte si la imprenta necesita ampliar el programa a 20 páginas. La salida actual no incluye imposición, sangrado, marcas de corte ni perfil de color de imprenta. Pregunte además por resolución, perfil de color y especificaciones de entrega; si se exigen, prepare y valide un archivo distinto.

## 7. Significado de las vistas

- `Página`: una hoja para corregir detalles.
- `Doble página`: dos páginas enfrentadas en orden de lectura. No es imposición de imprenta.
- `Todas`: revisión continua de las 12 páginas.

En teléfonos, el sistema inicia en vista de una página y conserva acceso a edición, estructura y revisión final.

## 8. Archivos de imagen

Cada carpeta `imagenes` contiene un `LEEME_IMAGENES.txt`. Para cada imagen, conserve aparte el original y registre nombre del archivo, autor, permiso de publicación, pie de foto y crédito exacto. No publique una imagen mientras alguno de esos datos esté pendiente.
