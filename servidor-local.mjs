// Punto de entrada del taller cuando se trabaja desde la carpeta, con Node
// instalado. El servidor de verdad está en `servidor/nucleo.cjs`.
//
// Está partido en dos por una razón concreta: un ejecutable compilado con Node
// SEA sólo arranca un `main` en CommonJS, así que el núcleo tiene que ser CJS.
// Este archivo se conserva para que `npm start`, el lanzador de Windows y las
// pruebas sigan invocando la misma ruta de siempre.
//
// El puerto se pasa como primer argumento: `node servidor-local.mjs 8790`.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./servidor/nucleo.cjs");
