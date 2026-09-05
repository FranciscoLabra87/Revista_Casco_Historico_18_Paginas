# Compilar el taller en un ejecutable

El taller se puede entregar como un solo archivo `.exe` que no necesita Node
instalado. Quien lo recibe hace doble clic y el navegador se abre en la revista.

```bash
npm run build
```

El resultado queda en `dist/TallerCascoHistorico.exe`, alrededor de **89 MB**.

## Qué hace la compilación

Tres pasos, todos en `build/compilar.mjs`:

1. **Reunir los archivos.** Recorre lo que el servidor declara público —`index.html`,
   `assets/`, `segments/`, `DOCUMENTACION/`, `PLANTILLAS/`— y arma la lista de
   recursos. Quedan fuera `assets/demo/` y los tres archivos pesados de
   consulta, que suman 24 MB y no hacen falta para trabajar.
2. **Preparar el blob.** `node --experimental-sea-config` empaqueta el código y
   esos recursos en un único bloque binario.
3. **Inyectar.** Copia el propio `node.exe` y le mete el blob con `postject`,
   que se descarga en el momento con `npx`. El taller sigue sin dependencias en
   tiempo de ejecución: la única herramienta externa es de compilación.

Al terminar imprime el tamaño y el **sha256**. Publique ese sha256 junto al
archivo: es lo que permite a quien descarga comprobar que recibió el mismo
ejecutable que usted generó.

## Por qué el servidor está partido en dos

`servidor-local.mjs` es un envoltorio de cuatro líneas y el servidor de verdad
está en `servidor/nucleo.cjs`, en CommonJS.

No es una preferencia de estilo: **un ejecutable SEA sólo arranca un `main` en
CommonJS**. Si el núcleo fuera ESM, no habría ejecutable. El envoltorio se
conserva para que `npm start`, el lanzador de Windows y las pruebas sigan
usando la misma ruta de siempre.

El núcleo detecta en qué modo corre con `sea.isSea()`:

- **Desde la carpeta**, lee los archivos del disco como siempre.
- **Empaquetado**, los lee de los recursos embebidos con `sea.getRawAsset()`.

La lista blanca, la comprobación de la cabecera `Host` y el manejo de la llave
del asistente son exactamente los mismos en los dos modos. Se comprobó en el
ejecutable: `/package.json`, `/.gitignore`, `/servidor/nucleo.cjs` y
`/tests/…` responden 400, y una cabecera `Host` ajena responde 403.

## Comprobar el ejecutable antes de publicarlo

```bash
dist/TallerCascoHistorico.exe 8791
```

Arranca en el puerto que se le indique. La variable `CASCO_NO_ABRIR=1` evita que
abra el navegador, que es cómodo para comprobarlo desde un script.

Verifique al menos: que `/__casco_health` responde con `"empaquetado": true`, que
la portada carga con sus tipografías, y que se puede crear una edición.

## Las ediciones guardadas no se pierden

El ejecutable sirve en `http://127.0.0.1:8787`, el mismo host y puerto que la
versión de carpeta. Para el navegador es **el mismo origen**, así que las
ediciones guardadas en IndexedDB siguen a la vista al pasar de una forma a la
otra.

Por eso el puerto por omisión no debe cambiarse a la ligera: cambiarlo esconde
las ediciones existentes sin borrarlas, que es peor que borrarlas, porque nadie
entiende qué pasó.

## Lo que el ejecutable no resuelve

**Windows va a desconfiar.** El archivo no está firmado —`postject` invalida la
firma de `node.exe` al inyectar— así que la primera vez aparece «Windows protegió
tu PC». Hay que pulsar **Más información → Ejecutar de todas formas**. Firmarlo
requiere un certificado de firma de código, que se paga por año.

**Algún antivirus puede marcarlo.** Es común con ejecutables construidos así.
El sha256 publicado sirve para descartar que el archivo venga alterado.

**Sólo sirve para Windows.** El ejecutable se construye para la plataforma donde
se compila. Para macOS o Linux hay que compilar en esa plataforma, y macOS
además exige notarización.

**Sigue abriendo el navegador.** No es una ventana propia: el taller se ve en una
pestaña, con las mismas reglas de siempre —una sola pestaña abierta—. Una
aplicación con ventana propia sería otro trabajo, más grande.

**Queda una consola abierta.** Mientras el taller funciona hay una ventana negra
detrás. Cerrarla apaga el taller, y el propio ejecutable lo advierte al arrancar.

## Publicar una versión

1. `npm run check` y `npm run build`.
2. Comprobar el ejecutable como se indica arriba.
3. Crear una release en GitHub, adjuntar el `.exe` y **pegar el sha256** en el
   texto de la release.
4. Indicar en las notas que Windows mostrará el aviso de SmartScreen y cómo
   continuar.
