# Estructura ramificada

La carpeta principal contiene el software local y un **programa base de 12 páginas y 10 segmentos**, incluida la portada y la contraportada. Ese programa es el punto de partida: cada edición puede agregar, quitar y reordenar secciones o páginas sin modificar las demás revistas.

El sistema tiene dos ramificaciones complementarias:

- **Programa base en carpetas:** define la identidad, las maquetas y el contenido inicial común.
- **Ediciones en “Mis revistas”:** cada proyecto conserva en IndexedDB su propia estructura, textos, imágenes, datos, formatos y aprobaciones.

```text
Revista_Casco_Historico/
├── index.html
├── ABRIR_REVISTA.cmd
├── INICIAR_REVISTA.ps1
├── servidor-local.mjs
├── assets/
│   ├── app.js
│   ├── data-store.js
│   ├── styles.css
│   ├── brand/
│   └── fonts/
├── segments/
│   ├── 01_portada/                    P01
│   ├── 02_sumario_editorial/          P02
│   ├── 03_noticias_breves/            P03–P04
│   ├── 04_reportaje_central/          P05–P06
│   ├── 05_voces_comercio/             P07
│   ├── 06_memoria_patrimonio/         P08
│   ├── 07_observatorio_datos/         P09
│   ├── 08_comunidad_servicios/        P10
│   ├── 09_cartas_director/            P11
│   └── 10_contraportada/              P12
├── DOCUMENTACION/
│   ├── MANUAL_SOFTWARE.md
│   └── PROGRAMA_12_PAGINAS.md
└── PLANTILLAS/
```

El número de carpeta indica el orden de los segmentos en el programa base; no es necesariamente el folio. Si una edición cambia su estructura, el taller vuelve a numerar las páginas y recompone el sumario automáticamente. La portada permanece al principio y la contraportada al final.

Dentro de cada segmento:

- `segmento.js` contiene la maqueta y los textos iniciales del programa base.
- `LEEME.md` explica el propósito, la extensión y los materiales de la sección.
- Cuando existe, `imagenes/` recibe los originales y comprobantes externos de esa sección.

Las secciones creadas desde el taller viven dentro de la edición y de su respaldo JSON; no crean carpetas nuevas en `segments/`. Una sección nueva puede tener de una a cuatro páginas. Antes de quitar una sección o cambiar mucho la estructura, descargue un respaldo.

`ABRIR_REVISTA.cmd` es el punto de entrada normal: inicia el servidor local y abre `http://127.0.0.1:8787/`. No conviene abrir `index.html` directamente, porque `file://` y el servidor local no comparten almacenamiento.

El formato de una edición puede ser A5, A4 o tabloide de 280 × 400 mm. Cambiarlo recompone todas sus páginas y obliga a revisarlas nuevamente.

Los cambios se guardan automáticamente en la edición activa. **Respaldar edición** descarga una copia trasladable de esa revista, incluida su estructura actual. Importar un respaldo crea otro proyecto y no sobrescribe los existentes.

El PDF de oficina o digital mantiene el tamaño elegido y no exige que el total sea múltiplo de cuatro. Esa condición se aplica solamente cuando la revista se producirá como cuadernillo doblado y corcheteado. El archivo de imprenta agrega sangrado y marcas, pero no hace la imposición de pliegos ni aplica un perfil de color.

La administración de ediciones, la estructura variable, los respaldos y las salidas PDF se explican en [`DOCUMENTACION/MANUAL_SOFTWARE.md`](DOCUMENTACION/MANUAL_SOFTWARE.md).
