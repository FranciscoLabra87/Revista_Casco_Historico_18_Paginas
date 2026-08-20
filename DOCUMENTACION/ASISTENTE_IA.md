# Asistente editorial

El taller incluye un asistente que ayuda a redactar y revisar. Conoce la página
abierta, la pauta de su sección y la extensión que pide el programa editorial.

**Propone; no escribe.** El texto que entrega hay que leerlo, corregirlo y
pegarlo a mano en el campo que corresponda. La revista sigue siendo de quienes
la hacen.

## 1. Poner la llave

El asistente necesita una llave de la API de Anthropic y conexión a internet.
El resto del taller funciona sin ninguna de las dos cosas.

1. Obtenga la llave en <https://console.anthropic.com>.
2. Cree el archivo `clave-ia.txt` en la carpeta principal, junto a
   `servidor-local.mjs`, con la llave dentro y nada más.
3. Cierre el taller y ábralo de nuevo con `ABRIR_REVISTA.cmd`.

Como alternativa, defina la variable de entorno `ANTHROPIC_API_KEY` antes de
iniciar el taller. Si existen las dos, manda la variable de entorno.

### Dónde vive la llave y por qué importa

La llave queda **sólo en el servidor local**. La página del navegador nunca la
recibe: pide `/api/asistente` a su propio equipo y es el servidor el que habla
con la API.

```
Navegador  ──►  127.0.0.1:8787/api/asistente  ──►  API de Claude
(sin llave)          (con la llave)
```

`clave-ia.txt` está excluido de git y no viaja en los respaldos JSON de las
ediciones. El servidor local tampoco lo entrega: sólo sirve la interfaz, los
recursos y la documentación, y rechaza cualquier otra ruta. Aun así, **es una credencial de pago**: no la comparta, no la copie a
otro computador y cámbiela si sospecha que se filtró.

## 2. Qué hace

Con la página abierta, el panel muestra su sección, cuántas palabras lleva y el
rango que pide el programa. Desde ahí:

| Acción | Qué entrega |
| --- | --- |
| **Redactar un borrador** | Un primer texto según la pauta de la sección y la extensión objetivo |
| **Ajustar a la extensión** | Alarga o recorta lo escrito hasta el rango, sin inventar información |
| **Proponer titulares** | Cinco opciones de titular con su bajada |
| **Pie de foto y descripción accesible** | Los dos textos que el sistema exige por cada imagen |
| **Revisar estilo** | Observaciones de ortografía, tono y coherencia, sin reescribir |

**Copiar** deja la propuesta en el portapapeles. Se pega en el campo con
`Ctrl+V`, y el taller conserva sólo el texto, sin formato.

## 3. Reglas que el asistente tiene puestas

- No inventa hechos, cifras, fechas, nombres, cargos ni citas.
- Lo que no puede saber lo deja **entre corchetes**, por ejemplo
  `[fecha por confirmar]`. La revisión final ya detecta los corchetes como datos
  pendientes, así que un borrador señala solo lo que falta comprobar.
- No redacta testimonios, declaraciones ni cartas atribuidas a personas reales.
- Escribe en castellano de Chile, sin lenguaje publicitario.

En la entrevista (P08 y P09) y en las cartas al director (P14), el panel muestra
una advertencia: ahí hay palabras de personas identificadas. El asistente puede
corregir estilo o proponer preguntas, pero redactar un testimonio que nadie dijo
convierte esa página en falsa, y es justamente lo que esta revista se propone no
hacer.

## 4. Coste

Se paga por uso a Anthropic, según el texto enviado y recibido. Cada respuesta
muestra cuántos tokens consumió. Para una edición de 12 páginas el gasto es de
centavos de dólar, pero conviene revisarlo en la consola de Anthropic durante el
primer número para tener una cifra propia.

## 5. Si algo falla

| Mensaje | Qué hacer |
| --- | --- |
| «Falta la llave de la API» | Cree `clave-ia.txt` y reinicie el taller |
| «API key is invalid» | La llave está mal copiada o fue revocada |
| «No se pudo contactar la API» | Compruebe la conexión a internet |
| «No se pudo contactar el asistente» | Abra el taller con `ABRIR_REVISTA.cmd`, no con `index.html` |

Ninguno de estos errores afecta a la edición: el contenido está guardado y el
resto del taller sigue funcionando.
