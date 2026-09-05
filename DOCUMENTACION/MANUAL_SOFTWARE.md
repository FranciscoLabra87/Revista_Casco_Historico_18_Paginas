# Manual del software local de revistas

## 1. Qué es este sistema

El Taller Editorial Casco Histórico es un software local para crear y conservar varias ediciones de una revista comunal. Cada proyecto es independiente y parte de un **programa base de 12 páginas y 10 segmentos**, incluida la portada y la contraportada.

El programa base se puede adaptar dentro de cada edición: las secciones interiores se pueden agregar, quitar y reordenar, y cada una puede cambiar su número de páginas o su maqueta. La portada permanece al principio y la contraportada al final.

El formato también pertenece a la edición. Se puede trabajar en:

- **A5:** 148 × 210 mm, formato de bolsillo original de la revista;
- **A4:** 210 × 297 mm;
- **Tabloide:** 280 × 400 mm, formato de diario.

El PDF no es el archivo de trabajo. Es una salida final o de revisión. La edición editable permanece en el navegador y puede trasladarse mediante un respaldo JSON v2.

## 2. Cómo iniciar el software

1. Entre en la carpeta principal del sistema.
2. Haga doble clic en `ABRIR_REVISTA.cmd`.
3. El lanzador inicia el servidor local y abre `http://127.0.0.1:8787/` en el navegador predeterminado.
4. Espere a que aparezca la pantalla **Mis revistas**.

Éste es el acceso normal. No abra `index.html` directamente para trabajar: `file://` y `http://127.0.0.1:8787` utilizan almacenamientos distintos. Una edición guardada en un origen no aparece automáticamente en el otro.

Trabaje en una sola pestaña. Si aparece **El taller ya está abierto**, vuelva a la pestaña anterior. Este bloqueo evita que dos ventanas sobrescriban el mismo proyecto.

El lanzador requiere Node.js. Si no está disponible, ofrece un modo básico mediante `index.html`; no lo use como acceso habitual para las ediciones de trabajo.

## 3. Pantalla “Mis revistas”

Cada tarjeta representa una edición independiente y muestra su nombre interno, nombre público, fecha de actualización y avance de páginas aprobadas.

### Crear una revista

1. Presione **Nueva revista**.
2. Escriba un nombre interno que permita reconocer el proyecto.
3. Escriba el nombre público de la edición.
4. Presione **Crear y abrir**.

La nueva revista parte del programa base de 12 páginas. Los cambios posteriores de estructura, contenido o formato afectan sólo a ese proyecto.

### Abrir y renombrar

Use **Abrir** para entrar en una edición. Antes de cambiar de proyecto, el sistema termina de guardar los cambios pendientes.

Use **Renombrar** para cambiar el nombre interno de la tarjeta. Esto no modifica por sí solo el nombre impreso. Para los datos que aparecen dentro de la revista, use **Datos de edición**.

### Duplicar para una nueva edición

Use **Duplicar** para comenzar un número nuevo a partir de otro existente. La copia conserva la estructura actual, formato, textos, fotografías y fichas, pero reinicia:

- las aprobaciones de todas las páginas actuales;
- la confirmación de los datos generales;
- la fecha de esa confirmación.

Revise número, fecha, agenda, contactos, permisos, fuentes y cualquier contenido heredado antes de publicar la copia.

### Papelera, restauración y eliminación

- **Mover a papelera** retira una revista de la lista principal sin borrar todavía su contenido.
- **Papelera** muestra las revistas archivadas.
- **Restaurar** devuelve una revista a **Mis revistas**.
- **Eliminar definitivamente** borra el proyecto y todos sus registros de este navegador. No se puede deshacer.

Descargue un respaldo antes de eliminar una edición que pueda necesitar. Las revistas de la papelera cuentan para el límite local hasta que se eliminan definitivamente.

## 4. Guardado local y seguridad de los datos

El software guarda automáticamente cada edición en **IndexedDB**, una base de datos privada del navegador en este equipo. La barra superior informa **Guardando…**, **Guardado** o **Error al guardar**.

El autoguardado protege frente al cierre normal de la pestaña, pero no es un respaldo externo. Los datos pueden perderse si se borra la información del sitio, se limpia el perfil del navegador, se usa navegación privada, se cambia de equipo o se daña el perfil local.

Para un trabajo responsable:

1. use siempre el mismo navegador y `http://127.0.0.1:8787/`;
2. descargue un respaldo JSON al terminar cada jornada;
3. conserve otra copia en una carpeta, unidad o servicio seguro;
4. guarde fuera del navegador las fotografías originales y los comprobantes de permiso;
5. respalde antes de reiniciar, eliminar páginas o secciones, archivar por mucho tiempo o borrar una revista.

## 5. Respaldar e importar revistas

### Qué contiene el respaldo v2

**Respaldar edición** descarga un archivo `revista-casco-historico-v2` de la revista activa. Incluye:

- identidad y datos generales de la edición;
- estructura actual, incluidas las secciones agregadas, páginas y maquetas;
- textos, listas, estilos y encuadres guardados;
- copias reducidas de las fotografías y sus fichas;
- estados y aprobaciones de página.

También viajan registros conservados aunque un elemento de lista esté temporalmente oculto. Si se eliminó una sección completa, el taller no ofrece un botón para reconstruirla con sus antiguos identificadores: el respaldo descargado **antes** de la eliminación es la forma segura de volver a esa estructura.

El respaldo pertenece a una sola revista. No contiene las otras ediciones de **Mis revistas**, los originales fotográficos de máxima resolución, comprobantes externos ni `clave-ia.txt`.

### Importar un respaldo

**Importar respaldo** acepta copias v2 actuales y copias v1 creadas por editores anteriores. Toda importación crea un proyecto nuevo e independiente; no reemplaza ni mezcla la edición abierta. Si el archivo está dañado, excede los límites o contiene datos ajenos al sistema, se rechaza sin alterar los proyectos existentes.

Abra solamente respaldos creados por este software y recibidos de una fuente confiable.

### Ediciones históricas de 16 o 18 páginas

Algunas copias v1 pertenecen a programas anteriores. El software intenta reconocerlas y puede pedir que indique si tenían 16 o 18 páginas. Si no lo sabe, cancele: no adivine.

Al convertirlas, el contenido que sí tiene destino se traslada a la página nueva. Los datos sin equivalencia y las aprobaciones históricas se conservan dentro del respaldo bajo identificadores de compatibilidad; no aparecen como páginas actuales ni cuentan en el avance. Todas las páginas recompuestas vuelven a revisión.

La agenda actual admite tres actividades. Si una edición antigua contiene una cuarta ficha, la conversión deja visibles las tres primeras y conserva íntegra la cuarta dentro del archivo histórico del respaldo; no la elimina silenciosamente.

La importación redistribuye el contenido que reconoce hacia el programa base actual. Como las secciones cambiaron, ciertos campos antiguos pueden no tener un destino equivalente. Por eso:

1. conserve intacto el archivo de origen;
2. importe como proyecto nuevo;
3. revise una por una todas las páginas, textos, fotografías, créditos y folios;
4. prepare un respaldo v2 nuevo sólo después de confirmar el resultado.

Las ediciones que se usaban abriendo `index.html` no son visibles desde el servidor local porque los dos orígenes guardan por separado. Para trasladarlas, abra una vez el editor antiguo en el mismo navegador, descargue su JSON v1 y luego impórtelo desde **Mis revistas**.

### Trabajo en equipo

El taller guarda cada revista en un solo navegador y no mezcla cambios de dos personas. Mientras sea así:

1. **Una sola persona maqueta** la edición principal.
2. El resto entrega contenido mediante `PLANTILLAS/FICHA_ARTICULO.md`, `FICHA_FOTOGRAFIA.md` y `FICHA_PUBLICIDAD.md`.
3. Las fotografías originales viajan aparte, con ficha y comprobante de permiso.
4. El respaldo puede circular para revisar, pero cada importación crea otra copia y no se fusiona con la principal.
5. Mantenga una sola pestaña de edición abierta.

## 6. Componer una edición

### Programa base

Una revista nueva comienza así:

- P01: portada.
- P02: sumario, créditos y carta editorial.
- P03: noticias breves.
- P04: avances de la agrupación.
- P05–P06: reportaje central.
- P07: voces del comercio.
- P08: memoria y patrimonio.
- P09: observatorio de datos públicos.
- P10: comunidad, servicios y agenda.
- P11: cartas al director.
- P12: contraportada.

La pauta detallada está en `DOCUMENTACION/PROGRAMA_12_PAGINAS.md`.

### Cambiar la estructura de una edición

El árbol lateral muestra la estructura viva del proyecto. La portada y la contraportada son fijas; las secciones interiores permiten:

- **Subir** o **Bajar** para cambiar el orden;
- agregar o quitar páginas dentro de una sección;
- cambiar la maqueta de una página;
- eliminar una sección completa;
- **Agregar una sección** nueva de una a cuatro páginas y elegir sus maquetas.

El taller vuelve a numerar los folios y recompone el sumario. Los cambios se guardan sólo en la edición activa y en su respaldo; no crean carpetas físicas en `segments/` ni modifican otros proyectos.

Antes de eliminar una sección, descargue un respaldo y lea la confirmación completa. Después de reordenar o cambiar el número de páginas, revise el sumario, los llamados de portada, las extensiones, la publicidad, la posición de la contraportada y todas las páginas previamente aprobadas.

El árbol avisa si el total no es múltiplo de cuatro. Esa condición importa únicamente para un **cuadernillo doblado y corcheteado**. Un PDF digital, una copia de oficina o una producción en hojas sueltas puede tener otro total.

### Elegir el formato

En **Datos de edición** elija A5, A4 o tabloide. Hágalo antes de redactar: al cambiar el tamaño, la retícula, los márgenes, los cuerpos y los rangos de palabras se ajustan y todas las páginas deben revisarse otra vez.

El contador junto al folio muestra el rango que corresponde a la página y al formato actuales. Use ese contador y la advertencia de desborde, no una cifra antigua escrita en una pauta externa.

### Editar y verificar

Use las vistas **Página**, **Doble página** o **Todas** según la tarea. Presione **Editar** para cambiar campos y fotografías. Cuando se modifica algo que afecta una página aprobada, esa aprobación se retira.

En **Datos de edición** registre nombre público, responsable, fecha, contacto, ubicación y demás información compartida. Confirme los datos sólo después de comprobarlos.

Cada fotografía debe tener descripción accesible, crédito y permiso confirmado. Si aparecen menores, registre además la autorización correspondiente. El software guarda la ficha, pero el equipo debe verificar que sea verdadera y conservar el original y su comprobante fuera del navegador.

## 7. Revisión y salidas PDF

El PDF se genera únicamente desde la edición activa:

1. termine textos, datos e imágenes;
2. revise y apruebe todas las páginas actuales;
3. presione **Revisión final**;
4. corrija contenido de muestra, campos incompletos, fuentes, imágenes, contactos y desbordes;
5. presione **Guardar PDF** y elija la salida adecuada.

Si quedan observaciones no críticas, el sistema permite un **PDF de revisión** con la marca **BORRADOR · NO DISTRIBUIR**. Los problemas críticos bloquean la salida. Cuando la revisión está limpia y todas las páginas actuales están aprobadas, se habilita el PDF final.

En el cuadro de impresión use siempre:

- destino **Guardar como PDF**;
- escala **100 %**;
- márgenes **ninguno**;
- gráficos de fondo activados.

### PDF de oficina o uso digital

Conserva cada página al tamaño final elegido: A5, A4 o tabloide. No lleva sangrado ni marcas. Sirve para leer en pantalla, distribuir por correo o mensajería e imprimir en una impresora común.

Seleccione el papel que corresponde al formato. El tabloide de 280 × 400 mm puede requerir un tamaño personalizado en el diálogo de impresión.

### Archivo de imprenta

Coloca cada página en una hoja mayor y agrega 3 mm de sangrado, marcas de corte y registro, además de un pie técnico con folio, edición, medida de corte y sangrado. El tamaño de corte es el formato elegido, no siempre A5.

Esta salida no incluye:

- imposición de pliegos;
- perfil de color de imprenta;
- sustitución automática de las copias reducidas por los originales fotográficos.

Entregue también los originales y acuerde con la imprenta resolución, perfil de color, papel, encuadernación e imposición. Para una edición A4 o tabloide, confirme antes qué tamaño de hoja de impresión debe usar el proveedor.

### Cuadernillo doblado y corcheteado

Es una forma de encuadernación, no otro modo de exportación. Sus pliegos suelen exigir un total múltiplo de cuatro. Compruebe el número actual de páginas y consulte a la imprenta antes del cierre. La condición no se aplica por sí sola al PDF digital ni a páginas sueltas.

## 8. Límites de esta versión

- Hasta **40 revistas** locales en total, incluidas las de la papelera.
- Hasta **1.000 elementos guardados** por edición.
- Hasta **40.000.000 de caracteres codificados** por edición o respaldo.
- Hasta **100.000 caracteres** en un campo de texto.
- Fotografías JPG, PNG o WebP de hasta **20 MB**.
- La copia guardada de cada fotografía se convierte a JPEG y limita su lado mayor a **1.600 píxeles**.
- Cada imagen guardada puede ocupar como máximo unos **6,3 millones de caracteres codificados**.
- Una sección nueva admite de una a cuatro páginas.

El espacio real depende del navegador y del disco. Si aparece **Error al guardar** o falta de espacio, no siga agregando contenido: descargue un respaldo, compruebe que se puede importar y libere espacio de forma controlada.

## 9. Archivos y documentación complementaria

- `LEEME_PRIMERO.md`: acceso rápido y flujo esencial.
- `ESTRUCTURA_RAMIFICADA.md`: relación entre carpetas base y estructura propia de cada edición.
- `DOCUMENTACION/PROGRAMA_12_PAGINAS.md`: pauta del programa base vigente.
- `DOCUMENTACION/GUIA_VERSION_ULTRA.md`: controles editoriales y de cierre.
- `DOCUMENTACION/ASISTENTE_IA.md`: instalación, límites y uso responsable del asistente.
- `PLANTILLAS/`: fichas de artículo, fotografía, publicidad y control de cierre.

`DOCUMENTACION/PROGRAMA_16_PAGINAS.md`, `Vista_general_18_paginas.png`, `Vista_previa_revista_Casco_Historico.pdf` y `Programa_editorial_revista_Casco_Historico.docx` corresponden a etapas anteriores. Se conservan sólo como referencia histórica o de migración; no describen el programa base vigente y no deben usarse para cerrar una edición actual.
