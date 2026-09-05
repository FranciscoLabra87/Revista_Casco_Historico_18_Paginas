# Arquitectura del Taller Editorial

## Propósito

Este documento explica cómo se organiza el software, qué decisiones protegen las revistas existentes y cómo debe continuar su evolución. La prioridad es **no perder contenido ni romper respaldos antiguos** mientras se reduce el acoplamiento acumulado en la primera versión.

La aplicación seguirá siendo un software web local sin compilador ni framework obligatorio. Esto permite abrirlo con el lanzador actual, mantener una instalación sencilla y conservar el formato de datos de IndexedDB y de los respaldos JSON v2.

## Diagnóstico de agosto de 2026

La mayor parte del código no era basura: implementaba edición, fotografías, estructura, revisión, impresión, proyectos y recuperación de datos. El problema era de organización. `assets/app.js` superaba las 5.400 líneas y reunía lógica editorial, acceso al DOM, persistencia, migraciones, PDF, asistente y más de cien conexiones de eventos.

Además existían fuentes de verdad repetidas:

- formatos y medidas de impresión dentro del controlador;
- catálogo de maquetas separado del validador de respaldos;
- mapa y señales de migración 16→18 en dos archivos;
- validación de claves, imágenes y ajustes con reglas distintas según el punto de entrada;
- una maqueta `culture` admitida por los respaldos y con renderizador escrito, pero no registrada para mostrarse.

La reforma se hace por sustitución gradual, no mediante una reescritura total. Una reescritura simultánea de interfaz y base de datos elevaría el riesgo de perder compatibilidad sin aportar valor editorial inmediato.

## Resultado de la primera fase

- `app.js` dejó de declarar formatos, catálogo, estructura compilada, validadores y tablas de migración; bajó de 5.443 a 5.080 líneas sin mover todavía los renderizadores de mayor riesgo visual.
- `backup-tools.js` pasó de más de 200 líneas de reglas repetidas a una fachada de unas 30 líneas sobre el esquema común.
- `data-store.js` delega el esquema y la detección heredada, y protege la caché activa frente a una escritura nueva que ocurra mientras termina una transacción por lote.
- Se retiraron wrappers, variables y selectores sin uso, además de aliases CSS históricos comprobados como huérfanos.
- La migración 16→18→12 mueve al editor actual los campos aprovechables de entrevista, comercio, patrimonio y agenda; lo que no tiene destino visible queda archivado sin sobrescribir archivos históricos previos. Si una agenda antigua tiene cuatro fichas, muestra las tres compatibles con la maqueta actual y conserva la cuarta en el archivo histórico.
- La suite automatizada cubre once contratos y flujos, incluida sintaxis, módulos puros, estructura, registro de maquetas, respaldos, migraciones encadenadas, fachada de almacenamiento y servidor local.

## Capas y dirección de las dependencias

```text
segments/ ───────────────┐
                        v
assets/core/  <──  assets/app.js  ──>  index.html + styles.css
     ^                  |
     |                  v
validación       assets/data-store.js  ──>  IndexedDB
     |
     └────────── respaldos JSON

servidor-local.mjs  ──> archivos públicos + proxy opcional del asistente
```

La regla principal es que `assets/core/` contiene lógica de dominio pura: no conoce `document`, IndexedDB, `fetch` ni diálogos. `app.js` coordina la interfaz y llama a esas funciones. `data-store.js` es el adaptador de almacenamiento. El servidor local es un proceso separado y no decide reglas editoriales.

## Módulos actuales

### Núcleo editorial (`assets/core/`)

- `modelo-editorial.js`: formatos A5/A4/tabloide, medidas de salida, instrucciones de PDF, ajustes generales, presupuestos de palabras, tonos, listas y registro permitido de maquetas.
- `estructura.js`: ordena segmentos, crea la estructura base, interpreta una estructura guardada y compila las páginas reales de una edición.
- `migraciones.js`: concentra las señales y el mapa 16→18, y planifica de forma pura y atómica la conversión 18→12.
- `esquema-registros.js`: fuente única de límites, claves y validación de textos, imágenes, fichas, ajustes, estructura y colecciones de registros.

Todos publican una API pequeña e inmutable bajo un nombre `Casco…`. Se mantienen como scripts clásicos para conservar el modo local actual. Las pruebas los ejecutan también fuera del navegador, sin copiar funciones desde `app.js`.

### Aplicación (`assets/app.js`)

Es el controlador de transición. Conserva la composición visual, los renderizadores y la interacción con la persona usuaria, pero delega reglas puras al núcleo. No debe volver a declarar formatos, esquemas de respaldo, catálogos o tablas de migración.

### Persistencia (`assets/data-store.js`)

Es la fachada de proyectos y ediciones sobre IndexedDB. Administra edición activa, caché, autoguardado, operaciones por lote, papelera e importación/exportación. Las escrituras estructurales y migraciones se aplican con `putMany` para que un fallo no deje media transformación realizada.

### Respaldo (`assets/backup-tools.js`)

Mantiene el nombre público `MagazineBackupTools` por compatibilidad, pero delega la validación al esquema común. Un respaldo se valida completamente antes de crear una edición importada.

### Servidor local

`servidor-local.mjs` sirve sólo los archivos públicos admitidos, expone una ruta de salud identificable y, si existe una llave fuera de OneDrive, ofrece el proxy del asistente. La revista, el guardado y el PDF siguen funcionando sin internet ni llave de IA.

## Contratos que no se deben romper

1. Las claves editoriales permanecen relativas: `text:…`, `image:…`, `image-meta:…`, `done:…` y `settings:…`.
2. El respaldo actual conserva `format: revista-casco-historico-v2` y `schemaVersion: 2`.
3. Una importación crea una edición independiente; nunca reemplaza primero el proyecto abierto.
4. Las migraciones conservan cada valor vigente o lo archivan bajo una clave `plegacy…`; no lo descartan silenciosamente.
5. Las aprobaciones no se trasladan a una página recompuesta.
6. Portada y contraportada conservan los extremos de la estructura actual.
7. Toda maqueta aceptada por el esquema debe tener exactamente un renderizador disponible.
8. El PDF se deriva del formato y de la cantidad real de páginas, no de literales históricos.

## Estrategia de pruebas

`npm test` debe comprobar como mínimo:

- programa base, orden de scripts y compilación de estructura;
- correspondencia entre maquetas admitidas y renderizadores;
- normalización de ajustes y dimensiones de PDF para cada formato;
- migraciones reales sobre mapas de registros, incluidas colisiones, archivo histórico e idempotencia;
- validación común y round-trip de respaldos dinámicos;
- seguridad básica y ciclo de vida del servidor local.

Las pruebas nuevas deben llamar las API del núcleo. No deben extraer fragmentos de código por comentarios o posiciones, porque mover una función entre archivos no cambia su comportamiento.

## Próximas extracciones, por riesgo

1. Separar la revisión final en un recolector de hechos del DOM y reglas puras de preflight.
2. Dar a los renderizadores un `RenderContext` explícito y extraer primero las siete maquetas genéricas.
3. Convertir edición, listas, invalidación y deshacer en comandos comprobables sin DOM.
4. Separar internamente el repositorio IndexedDB de la sesión activa y de la cola de autoguardado, conservando la fachada pública.
5. Dividir el CSS por componentes sólo con una comparación visual controlada; hoy contiene una pila histórica de ajustes cuya eliminación masiva sería riesgosa.
6. Dejar `app.js` como arranque y coordinación. El objetivo es cohesión y contratos claros, no alcanzar una cifra arbitraria de archivos o líneas.

No se recomienda introducir React, Vue, un empaquetador o una base de datos distinta en la misma etapa que estas extracciones. Esas decisiones pueden evaluarse después de estabilizar el núcleo y aumentar la cobertura de regresión.
