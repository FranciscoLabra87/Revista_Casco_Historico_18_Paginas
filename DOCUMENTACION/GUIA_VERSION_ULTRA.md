# Guía de la versión Ultra

La versión Ultra agrega control editorial, estructura variable y preparación de salida al programa base de 12 páginas y 10 segmentos. Mantiene la identidad visual patrimonial y permite elegir formato A5, A4 o tabloide de 280 × 400 mm.

Las familias Cinzel, Cormorant Garamond, Source Serif 4, Archivo Narrow y Source Sans 3 se incluyen localmente en `assets/fonts`, en formato WOFF2 y con sus licencias OFL. La composición no depende de que estén instaladas en el computador.

## 1. Programa editorial base

Una revista nueva incluye:

- P01 portada;
- P02 sumario, créditos y carta editorial;
- P03 noticias breves;
- P04 avances de la agrupación;
- P05–P06 reportaje central;
- P07 voces del comercio;
- P08 memoria y patrimonio;
- P09 observatorio de datos públicos;
- P10 comunidad, servicios y agenda;
- P11 cartas al director;
- P12 contraportada.

Consulte la pauta en `PROGRAMA_12_PAGINAS.md`.

## 2. Estructura propia de cada edición

El programa base es el punto de partida. Dentro de una revista abierta se pueden:

- mover las secciones interiores;
- agregar o quitar páginas;
- cambiar la maqueta de una página;
- eliminar una sección;
- crear una sección nueva de una a cuatro páginas.

La portada permanece al principio y la contraportada al final. El taller vuelve a numerar los folios y recompone el sumario. Los cambios afectan sólo a la edición activa y viajan en su respaldo JSON.

Antes de eliminar una sección, descargue un respaldo. Después de un cambio estructural, revise llamados de portada, sumario, extensiones, publicidad, aprobaciones y total de páginas.

El aviso de múltiplo de cuatro se refiere únicamente a un cuadernillo doblado y corcheteado. No bloquea un PDF digital, una impresión de oficina ni una producción en páginas sueltas.

## 3. Datos y formato de la edición

**Datos de edición** centraliza:

- nombre y fecha de la edición;
- responsable editorial;
- correo y teléfono o WhatsApp;
- fecha límite para recibir aportes;
- ubicación y frase institucional;
- formato A5, A4 o tabloide.

Los datos compartidos se aplican a portada, créditos, firma y contraportada sin reemplazar a ciegas un texto cambiado manualmente. Las páginas que realmente cambian vuelven a estado pendiente.

Cambiar el formato recompone la retícula, márgenes, tipografía y capacidad de todas las páginas actuales. El contador de palabras ajusta sus rangos al tamaño elegido. Conviene seleccionar el formato antes de redactar y revisar toda la edición después de cambiarlo.

## 4. Estados por página

Cada página actual se puede marcar como lista sólo cuando no conserva advertencias ni problemas críticos. El árbol muestra el avance con el total real de la edición. Si cambia un texto, fotografía, dato compartido, formato o estructura, las páginas afectadas deben revisarse de nuevo.

## 5. Revisión final

La revisión final analiza todas las páginas actuales, aunque en pantalla se vea una sola o una doble página. Comprueba:

- estructura, orden y folios;
- páginas aún no aprobadas;
- fotografías faltantes;
- descripción accesible, crédito y permiso de cada fotografía;
- autorización registrada cuando aparecen menores;
- resolución de las copias guardadas y de los originales declarados;
- marcadores entre corchetes;
- textos que siguen iguales al modelo;
- autoría de páginas y citas cuando corresponde;
- extensión frente al rango del formato actual;
- contenido fuera del marco de la página;
- contactos y datos generales incompletos;
- conservación externa de los originales fotográficos.

Cada observación incluye un acceso a la página que debe corregirse. Los desbordes bloquean la aprobación hasta resolverlos.

La cabecera de portada es editable. Si se aparta de la identidad institucional, la revisión pide confirmarlo porque identifica la revista entre números.

Las observaciones de extensión, recorte o resolución pueden ser informativas. El sistema no puede comprobar por sí solo que una fuente, permiso o declaración sea verdadera: el control humano y los comprobantes externos siguen siendo obligatorios.

## 6. Copia editable completa

**Respaldar edición** descarga un JSON v2 de la revista activa con:

- estructura actual y maquetas;
- textos, listas, estilos y ajustes;
- datos generales y formato;
- copias reducidas de fotografías y sus fichas;
- estados y aprobaciones.

No incluye las otras revistas del panel, los originales de máxima resolución, sus comprobantes externos ni la llave del asistente. El autoguardado y las imágenes quedan sólo en el navegador de este dispositivo hasta que se descarga un respaldo.

Al importar una copia v1 o v2, el sistema valida el archivo y crea un proyecto nuevo; no reemplaza ni mezcla la edición abierta. Las copias históricas de 16 o 18 páginas pueden necesitar redistribución. Conserve el archivo original y revise todas las páginas importadas.

## 7. Salida PDF

**Guardar PDF** ejecuta primero la revisión final. Antes de abrir el diálogo de impresión, el sistema:

- monta todas las páginas actuales en orden;
- oculta controles y marcas de edición;
- espera las fuentes y fotografías;
- aplica el tamaño elegido a la composición.

### PDF de revisión

Si quedan observaciones no críticas, el archivo lleva **BORRADOR · NO DISTRIBUIR** en todas las páginas. Un problema crítico bloquea la salida hasta corregirlo.

### PDF de oficina o digital

Guarda las páginas al tamaño final elegido —A5, A4 o tabloide—, sin sangrado ni marcas. Sirve para pantalla, correo, mensajería e impresión común. En el diálogo use escala 100 %, márgenes ninguno y gráficos de fondo. El tabloide puede requerir un papel personalizado.

### Archivo de imprenta

Coloca cada página sobre una hoja mayor, con 3 mm de sangrado, marcas de corte y registro, y un pie técnico que declara folio, edición, corte y sangrado. El corte coincide con el formato elegido.

Esta salida no hace imposición de pliegos, no aplica un perfil de color y no reemplaza automáticamente las copias reducidas por los originales. Confirme con la imprenta hoja, papel, resolución, color, encuadernación e imposición, y entregue los originales cuando los solicite.

### Cuadernillo doblado y corcheteado

Es una forma de encuadernación. Sus pliegos suelen necesitar un total múltiplo de cuatro. Compruebe el número actual de páginas y consulte a la imprenta antes del cierre. Esta condición no se aplica por sí sola a las otras salidas.

## 8. Significado de las vistas

- **Página:** una hoja para corregir detalles.
- **Doble página:** dos páginas enfrentadas en orden de lectura; no es imposición de imprenta.
- **Todas:** revisión continua de todas las páginas actuales.

En teléfonos, el sistema comienza en vista de una página y mantiene acceso a edición, estructura y revisión.

## 9. Archivos de imagen

Las carpetas que admiten originales contienen `imagenes/LEEME_IMAGENES.txt`. Para cada imagen, conserve aparte el original y registre nombre del archivo, autor, permiso, pie y crédito. No publique mientras alguno de esos datos esté pendiente.

El taller guarda una copia reducida para maquetar y producir el PDF de oficina. Esa copia no reemplaza el original de alta resolución que puede exigir una imprenta.
