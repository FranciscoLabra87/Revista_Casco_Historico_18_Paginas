# Estructura ramificada

La carpeta principal contiene el software local, su plantilla editorial y catorce carpetas de segmentos. La plantilla compone una revista A5 de 18 páginas, incluida la portada y la contraportada. Cada carpeta reúne una sección editorial y puede controlar una o dos páginas.

El sistema tiene dos ramificaciones complementarias:

- **Plantilla en carpetas:** define la identidad, el diseño, las secciones y las páginas comunes.
- **Proyectos en “Mis revistas”:** conserva varias ediciones independientes dentro de IndexedDB. Cada una tiene sus propios textos, imágenes, datos y aprobaciones.

```text
Sistema_Revista_Casco_Historico_Interactivo/
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
│   ├── 02_sumario_creditos/           P02
│   ├── 03_carta_editorial/            P03
│   ├── 04_articulo_central/           P06–P07
│   ├── 05_noticias_breves/            P04–P05
│   ├── 06_entrevista/                 P08–P09
│   ├── 07_memoria_patrimonio/         P10–P11
│   ├── 08_comunidad_servicios/        P12
│   ├── 09_comercio_local/             P13
│   ├── 10_cartas_director/            P14
│   ├── 11_agenda_datos/               P15
│   ├── 12_cultura_participacion/      P16
│   ├── 13_cierre_publicidad/          P17
│   └── 14_contraportada/              P18
├── DOCUMENTACION/
│   └── MANUAL_SOFTWARE.md
└── PLANTILLAS/
```

Las carpetas 04 y 05 conservan sus nombres históricos, pero el orden de lectura es primero noticias y avances (P04–P05) y después el reportaje central (P06–P07).

Dentro de cada segmento:

- `segmento.js` contiene los textos de muestra y la información que aparece en el sistema.
- `LEEME.md` explica el objetivo, la extensión, las páginas y los materiales necesarios.
- `imagenes/` recibe fotografías y recursos originales del segmento.

`ABRIR_REVISTA.cmd` es el punto de entrada normal: inicia el servidor local y abre `http://127.0.0.1:8787/`. No conviene abrir `index.html` directamente, porque los orígenes `file://` y `http://127.0.0.1:8787` no comparten almacenamiento.

Los cambios realizados desde el botón **Editar** se guardan automáticamente en la edición activa. Para conservar una copia trasladable, utilice **Respaldar edición**. Al importar un respaldo v1 o v2, el software crea un proyecto nuevo y no sobrescribe las demás revistas.

El PDF de 18 páginas sirve para distribución digital o impresión de oficina. Si se desea un cuadernillo doblado y corcheteado, consulte a la imprenta: normalmente exige una cantidad de páginas múltiplo de cuatro, por lo que puede ser necesario ampliar esta edición a 20 páginas.

La administración de ediciones, los respaldos y la salida PDF se explican en [`DOCUMENTACION/MANUAL_SOFTWARE.md`](DOCUMENTACION/MANUAL_SOFTWARE.md).
