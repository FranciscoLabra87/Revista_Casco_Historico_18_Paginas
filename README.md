# Taller Editorial · Revista Casco Histórico

Software local para que una asociación de barrio arme, revise e imprima su propia
revista, sin diseñador y sin pagar una licencia.

Lo usa la Asociación Casco Histórico de Puente Alto para publicar una revista
comunal gratuita, financiada con bingos, rifas y los avisos de sus páginas.

---

## Qué problema resuelve

Una agrupación vecinal junta noticias, fotografías y cartas. Entre eso y un PDF
que la imprenta acepte hay un abismo: retículas, sangrado, marcas de corte,
pliegos múltiplos de cuatro, permisos de fotografía. Ese abismo normalmente se
cruza pagando a alguien.

Este taller lo cruza solo. Abre en el navegador, escribe encima de las páginas
como si fueran papel, y al final entrega dos PDF: uno para revisar en la oficina
y otro listo para la imprenta.

No hay cuenta que crear, ni servidor que contratar, ni nada que viaje a internet.

## Cómo se usa

1. Doble clic en `ABRIR_REVISTA.cmd`.
2. El sistema abre `http://127.0.0.1:8787/` en el navegador.
3. En **Mis revistas**, crear una edición nueva, abrir una existente o importar
   un respaldo.

Usar siempre el lanzador. Abrir `index.html` directamente no sirve para trabajar:
`file://` y `http://127.0.0.1:8787` guardan los datos en espacios separados del
navegador y las ediciones no se ven entre sí.

Mantener **una sola pestaña** abierta. Si una segunda dice «El taller ya está
abierto», seguir en la primera: es lo que protege el autoguardado.

El procedimiento completo está en
[`DOCUMENTACION/MANUAL_SOFTWARE.md`](DOCUMENTACION/MANUAL_SOFTWARE.md).

## Qué trae

**Estructura que se puede cambiar.** El programa base son 12 páginas en 10
secciones, pero cada edición agrega, quita y reordena las suyas. El sumario se
recalcula solo con los números de página reales.

**Tres formatos.** A5 de bolsillo, A4 y tabloide de 280 × 400 mm. Cambiar el
formato recompone todas las páginas: la retícula se deriva del tamaño de corte,
no está escrita a mano.

**Veintisiete maquetas de página**, entre las del programa base —portada, sumario,
carta editorial, breves, reportaje, entrevista, patrimonio, datos, agenda,
cartas, contraportada— y las del catálogo que el equipo agrega a mano.

**Editor de fotografía** con encuadre, giro y ajustes de luz. Cada fotografía
exige descripción accesible, crédito y confirmación de permiso antes de poder
imprimirse. Si hay menores en la imagen, pide además la autorización.

**Espacios publicitarios vendibles.** Faldón al pie en las páginas impares —las
de la derecha del cuadernillo—, avisos a página completa y por módulos, y la
contraportada, que alterna entre versión institucional y espacio vendido. Todo
aviso lleva rótulo obligatorio: «Publicidad», «Contenido patrocinado» o «Espacio
cedido».

**Revisión final de imprenta.** Antes de cerrar una edición, el taller revisa que
no queden contactos de muestra sin reemplazar, que ningún texto se salga de su
caja, que todas las páginas estén aprobadas y que el total sea múltiplo de cuatro
si la revista se va a doblar y corchetear.

**Dos salidas.** El PDF de oficina conserva el tamaño elegido, sin sangrado. El
archivo de imprenta agrega 3 mm de sangrado y marcas de corte y registro.

**Respaldo JSON.** Es la única manera de mover una edición entre computadores.

## Cómo funciona por dentro

| Ruta | Qué hace |
| --- | --- |
| `index.html` | El marcado del taller: barra, árbol de secciones, diálogos |
| `assets/app.js` | La interfaz y el renderizado de las páginas de la revista |
| `assets/core/` | El modelo editorial puro: formatos, tonos, maquetas, esquema de registros y migraciones |
| `assets/data-store.js` | Guardado en IndexedDB, por edición |
| `assets/styles.css` | El diseño de la página, en milímetros |
| `segments/` | El programa editorial base, como datos |
| `servidor-local.mjs` | Servidor estático local |
| `tests/` | Pruebas del modelo y del servidor |

La lógica editorial que se puede probar vive en `assets/core/`, fuera del DOM, y
está cubierta por `tests/integridad.test.mjs`. `assets/app.js` se ocupa de la
pantalla.

## Decisiones que explican el código

Si vas a leer las fuentes, estas cuatro te ahorran preguntas:

**Las páginas se miden en milímetros, no en píxeles.** El destino es papel. Las
columnas, los márgenes y la línea base se derivan del tamaño de corte, así que
cambiar de A5 a tabloide recompone la revista en vez de romperla.

**El servidor sirve una lista blanca, no una lista de exclusiones.** `servidor-local.mjs`
entrega sólo las carpetas que el taller necesita, y verifica la cabecera `Host`.
Sin eso, un sitio cualquiera puede apuntar su dominio a `127.0.0.1` y leer las
respuestas como si fueran del mismo origen.

**Al abrir una revista se entra directamente en modo edición.** Antes había que
pulsar «Editar», y la gente pulsaba «Agregar fotografía» sin que pasara nada.
«Terminar edición» da la vista limpia para revisar.

**Hay dos páginas donde no se vende publicidad**, aunque sean impares: la apertura
del reportaje, que es donde la revista pone su mejor trabajo, y el observatorio
de datos, que declara al pie de dónde salen sus cifras. Un aviso pagado bajo esa
declaración pone en duda lo que la página acaba de afirmar.

## Datos y privacidad

Las ediciones se guardan en el IndexedDB del navegador, asociadas al origen
`http://127.0.0.1:8787`. No se sincronizan con ningún servicio y no hay
telemetría.

La contrapartida es que **borrar los datos del navegador borra las ediciones**.
Los respaldos JSON no son un lujo: son la copia de seguridad.

**La única excepción es el asistente editorial**, y es opcional. Si se configura
una llave de la API de Anthropic, el taller puede pedirle ayuda para redactar o
revisar un texto. En ese caso el texto de la consulta sale del computador hacia
`api.anthropic.com`. Sin llave, el resto del taller funciona igual y sin
conexión a internet.

Dos detalles del diseño que vale la pena conocer:

- **La llave vive fuera de la carpeta del proyecto**, en
  `%LOCALAPPDATA%\CascoHistorico\clave-ia.txt` o en la variable de entorno
  `ANTHROPIC_API_KEY`. Así no viaja cuando la carpeta de la revista se copia, se
  comparte o se respalda.
- **El navegador nunca recibe la llave.** La página pide `/api/asistente` a su
  propio equipo y es el servidor local el que habla con la API.

El asistente propone; no escribe. Lo que entrega hay que leerlo, corregirlo y
pegarlo a mano. Detalles en
[`DOCUMENTACION/ASISTENTE_IA.md`](DOCUMENTACION/ASISTENTE_IA.md).

## Desarrollo

Requiere Node.js. No hay empaquetador ni dependencias externas.

```bash
npm start        # levanta el taller en http://127.0.0.1:8787
npm run check    # sintaxis de los módulos + pruebas
npm test         # sólo las pruebas
```

## Estado

En desarrollo activo, sobre la rama `mejoras-auditoria`.

Hay un rediseño editorial en curso, documentado en
[`DOCUMENTACION/especificaciones/`](DOCUMENTACION/especificaciones/) y
[`DOCUMENTACION/planes/`](DOCUMENTACION/planes/). Los archivos
`assets/demo/edicion-prueba.html` y `assets/demo/edicion-24.html` son maquetas de
referencia de ese rediseño, no parte del programa: se borran cuando el taller
produzca lo mismo.

## Licencias y contenido de terceros

**Tipografías.** El proyecto incluye Cinzel, Cormorant Garamond, Source Serif 4,
Source Sans 3 y Archivo Narrow, todas bajo SIL Open Font License 1.1. Sus textos
de licencia están junto a los archivos, en `assets/fonts/`.

**Identidad de la asociación.** El emblema de `assets/brand/` pertenece a la
Asociación Casco Histórico y no es material reutilizable: identifica a una
organización real.

**Fotografías de prueba.** Las de `assets/demo/` se generaron para maqueta. No son
registro documental de ningún lugar, comercio ni persona real, y no deben
publicarse como fotografía periodística. Ver
[`assets/demo/LEEME.md`](assets/demo/LEEME.md).

**Código.** Este repositorio todavía no declara una licencia. Sin una, «público»
sólo significa que se puede leer: nadie puede reutilizarlo ni adaptarlo
legalmente. Si la idea es que otras juntas de vecinos puedan usar el taller, hace
falta agregar un archivo `LICENSE`.
