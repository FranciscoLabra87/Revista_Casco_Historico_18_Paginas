# Manual del software local de revistas

## 1. Qué es este sistema

El Taller Editorial Casco Histórico es un software local para crear y conservar varias ediciones de una revista comunal. La aplicación administra cada revista como un proyecto independiente, permite componer sus 18 páginas, revisar el cierre editorial y, al final del proceso, exportar una salida PDF A5.

El PDF no es el archivo de trabajo. Es una salida final o de revisión. El contenido editable permanece en el software y puede trasladarse mediante un respaldo JSON.

La plantilla incluida corresponde a la revista **Casco Histórico de Puente Alto**, con portada, contraportada y 16 páginas interiores. Las carpetas de `segments/` definen las secciones y sus páginas; las ediciones creadas se guardan en la base de datos local del navegador.

## 2. Cómo iniciar el software

1. Entre en la carpeta principal del sistema.
2. Haga doble clic en `ABRIR_REVISTA.cmd`.
3. El lanzador inicia el servidor local y abre la dirección `http://127.0.0.1:8787/` en el navegador predeterminado.
4. Espere a que aparezca la pantalla **Mis revistas**.

Éste es el acceso normal y recomendado. No abra `index.html` directamente para trabajar: una página abierta como `file://` y la aplicación abierta como `http://127.0.0.1:8787` utilizan almacenamientos distintos. Por esa razón, una edición guardada en un modo no aparece automáticamente en el otro.

Trabaje en una sola pestaña. El software bloquea una segunda ventana de edición para impedir que dos copias sobrescriban el mismo proyecto; si aparece el aviso **El taller ya está abierto**, vuelva a la pestaña anterior.

El lanzador requiere Node.js para iniciar el servidor local. Si Node.js no está disponible, ofrece un modo básico mediante `index.html`; ese modo no debe usarse como acceso habitual para las ediciones de trabajo.

## 3. Pantalla “Mis revistas”

**Mis revistas** es el inicio del software. Cada tarjeta representa una edición independiente y muestra su nombre, el nombre público de la edición, la fecha de actualización y el avance de páginas aprobadas.

### Crear una revista

1. Presione **Nueva revista**.
2. Escriba un nombre interno que permita reconocer el proyecto.
3. Escriba el nombre público de la edición, tal como debe aparecer en la revista.
4. Presione **Crear y abrir**.

La nueva revista parte de la plantilla editorial de 18 páginas. Sus cambios no afectan a las demás ediciones.

### Abrir una revista

Presione **Abrir** en la tarjeta correspondiente. Antes de cambiar de proyecto, el sistema termina de guardar los cambios pendientes de la edición actual.

### Renombrar una revista

Use **Renombrar** para cambiar el nombre con el que el proyecto se identifica en **Mis revistas**. Este cambio no modifica por sí solo el nombre público impreso. Para cambiar los datos que aparecen dentro de la publicación, use **Datos de edición** en el taller.

### Duplicar para una nueva edición

Use **Duplicar** cuando quiera comenzar un número nuevo a partir de otro existente. Se copian los textos, las fotografías y sus fichas, pero se reinician:

- las aprobaciones de las 18 páginas;
- la confirmación de que los datos generales fueron comprobados;
- la fecha de esa comprobación.

La copia es un proyecto independiente. Revise fechas, número de edición, agenda, datos de contacto, permisos fotográficos y cualquier contenido heredado antes de publicarla.

### Papelera, restauración y eliminación

- **Mover a papelera** retira una revista de la lista principal sin borrar todavía su contenido.
- **Papelera** muestra las revistas archivadas.
- **Restaurar** devuelve una revista a **Mis revistas**.
- **Eliminar definitivamente** borra el proyecto y todos sus textos, imágenes, fichas y estados guardados en este navegador. Esta acción no se puede deshacer.

Descargue un respaldo antes de eliminar una edición que pueda necesitar más adelante. Las revistas de la papelera también cuentan para el límite local hasta que se eliminan definitivamente.

## 4. Guardado local y seguridad de los datos

El software guarda automáticamente cada edición en **IndexedDB**, una base de datos privada del navegador en este equipo. El indicador de la barra superior muestra estados como **Guardando…**, **Guardado** o **Error al guardar**.

El autoguardado protege frente al cierre normal de la pestaña, pero no es un respaldo externo. Los datos pueden perderse si se borra la información del sitio, se limpia el perfil del navegador, se usa navegación privada, se cambia de equipo o se daña el perfil local.

Para un trabajo responsable:

1. use siempre el mismo navegador y el acceso `http://127.0.0.1:8787/`;
2. descargue un respaldo JSON al terminar cada jornada de edición;
3. conserve una copia adicional en otra carpeta, unidad o servicio seguro;
4. guarde fuera del navegador las fotografías originales y los comprobantes de permiso;
5. cree un respaldo antes de reiniciar, archivar de forma prolongada o eliminar una revista.

## 5. Respaldar e importar revistas

### Respaldo v2

El botón **Respaldar edición** descarga un archivo JSON en formato `revista-casco-historico-v2`. Incluye los datos del proyecto, textos editados, fotografías incorporadas, fichas de imagen, datos generales y estados de página de la edición activa.

El respaldo pertenece a una sola revista. No contiene todas las ediciones del panel.

### Importación v1 y v2

El botón **Importar respaldo** acepta:

- respaldos actuales `revista-casco-historico-v2`;
- copias antiguas `revista-casco-historico-v1` creadas por el editor anterior.

Toda importación se crea como un **proyecto nuevo e independiente**. No reemplaza ni mezcla la edición abierta. Si el archivo está dañado, excede los límites o contiene datos ajenos al sistema, se rechaza sin alterar los proyectos existentes.

Abra solamente respaldos creados por este software y obtenidos de una fuente confiable.

### Compatibilidad de una revista antigua de 16 páginas

Al importar un respaldo v1, el sistema detecta si pertenece al programa antiguo de 16 páginas. Cuando lo reconoce, redistribuye el contenido a la plantilla actual de 18 páginas:

| Página antigua | Página actual | Página antigua | Página actual |
| --- | --- | --- | --- |
| P01 | P01 | P09 | P10 |
| P02 | P02 | P10 | P12 |
| P03 | P03 | P11 | P13 |
| P04 | P06 | P12 | P14 |
| P05 | P07 | P13 | P15 |
| P06 | P04 | P14 | P16 |
| P07 | P08 | P15 | P17 |
| P08 | P09 | P16 | P18 |

Las nuevas P05 y P11 conservan el contenido inicial de la plantilla de 18 páginas hasta que el equipo las complete. Si una copia antigua no contiene señales suficientes para reconocer el programa, el software solicita indicar si corresponde a 16 o 18 páginas; ante una duda, cancele y revise el archivo antes de continuar.

Las ediciones que se habían usado abriendo directamente `index.html` no son visibles desde el servidor local porque `file://` y `http://127.0.0.1:8787` tienen almacenes separados. Para trasladarlas, abra una vez el editor antiguo en el mismo navegador, descargue su copia JSON v1 y luego impórtela desde **Mis revistas**.

## 6. Componer una edición

Dentro del taller, el árbol lateral reproduce la estructura ramificada de la revista. Las 14 secciones controlan las 18 páginas:

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
- P15: agenda y cultura.
- P16: participación y próxima edición.
- P17: publicidad y colaboradores.
- P18: contraportada.

Use las vistas de página, doble página o revista completa según la tarea. Presione **Editar** para modificar los campos habilitados. Al cambiar un texto, una fotografía o un dato que afecta una página aprobada, esa aprobación se retira para obligar a revisarla nuevamente.

En **Datos de edición** se registran el nombre público, número, fecha, contacto y demás información compartida por distintas páginas. Confirme esos datos sólo después de comprobarlos.

Cada fotografía incorporada debe tener descripción accesible, crédito, pie cuando corresponda y confirmación de permiso. El software registra estos datos, pero el equipo editorial debe verificar su veracidad y conservar los originales.

## 7. Revisión y salida PDF A5

El PDF se genera únicamente como salida de la edición activa:

1. termine la edición de textos, datos e imágenes;
2. revise y apruebe cada una de las 18 páginas;
3. presione **Revisión final**;
4. corrija contenido de muestra, campos incompletos, imágenes faltantes o de baja resolución y contenido fuera del marco;
5. presione **Guardar PDF** y siga las instrucciones del navegador.

Si quedan observaciones no críticas, el sistema permite crear un **PDF de revisión** con la marca **BORRADOR · NO DISTRIBUIR**. Los problemas críticos bloquean la salida hasta que se corrijan. Cuando el control está limpio y todas las páginas están aprobadas, se habilita el **PDF final A5**.

En el cuadro de impresión seleccione:

- destino **Guardar como PDF**;
- papel **A5** (148 × 210 mm);
- escala **100 %**;
- márgenes **ninguno**;
- gráficos de fondo activados.

La salida incluida sirve para distribución digital o impresión de oficina. No agrega por sí sola sangrado, marcas de corte, imposición ni perfil de color profesional. Además, 18 no es múltiplo de cuatro; para un cuadernillo doblado y corcheteado, consulte a la imprenta si debe ampliar la edición a 20 páginas.

## 8. Límites de esta versión

- Hasta **40 revistas** locales en total, incluidas las que estén en la papelera.
- Hasta **1.000 elementos guardados** por edición.
- Hasta **40.000.000 de caracteres codificados** por edición o respaldo.
- Hasta **100.000 caracteres** en un campo de texto individual.
- Fotografías de origen JPG, PNG o WebP de hasta **20 MB**.
- Al incorporar una fotografía, el software la convierte a JPEG y limita su lado mayor a **1.600 píxeles** para el almacenamiento local.
- Cada imagen guardada puede ocupar como máximo unos **6,3 millones de caracteres codificados**.

El espacio real disponible depende del navegador y del disco del equipo. Si aparece **Error al guardar** o un aviso de espacio insuficiente, no continúe agregando contenido: descargue un respaldo, compruebe que abre correctamente y libere espacio de forma controlada.

## 9. Archivos y documentación complementaria

- `LEEME_PRIMERO.md`: acceso rápido y flujo esencial.
- `ESTRUCTURA_RAMIFICADA.md`: estructura técnica y editorial de las carpetas.
- `DOCUMENTACION/PROGRAMA_18_PAGINAS.md`: pauta detallada de cada página.
- `DOCUMENTACION/GUIA_VERSION_ULTRA.md`: controles editoriales y de cierre.
- `PLANTILLAS/`: fichas de artículo, fotografía, publicidad y control de cierre.
