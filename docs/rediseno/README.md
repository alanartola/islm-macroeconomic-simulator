# Rediseño visual del laboratorio

Este documento registra la auditoría de la interfaz anterior, el sistema de
diseño adoptado y la comparación entre ambas versiones. El rediseño no modifica
ningún motor económico: `src/engine`, `src/interpretation` y `src/state` no
cambiaron, y las pruebas que verifican los resultados económicos y la
interfaz se mantienen aprobadas (374, incluidas las nuevas de navegación). La versión anterior queda conservada en la
etiqueta Git `v2.0-antes-del-rediseno`.

Capturas: [`antes/`](antes) (versión publicada antes del rediseño) y
[`despues/`](despues), generadas con `node scripts/screenshots.mjs --out <carpeta>`
desde un almacenamiento local vacío (español y modo oscuro por defecto).

## 1. Auditoría de la versión anterior

| Problema | Dónde se veía | Efecto |
|---|---|---|
| Todo era una caja redondeada con sombra | 8 tarjetas de resultados idénticas, 13 botones de escenarios en grilla, notas, controles segmentados, cada gráfico | Repetición mecánica; ninguna jerarquía entre lo importante y lo accesorio |
| El azul era a la vez color de datos y de interfaz | Curva IS, acento, chips, titular de la explicación, cajas de nota, escenario activo | El color no comunicaba significado económico |
| Cifras en tipografía monoespaciada y negrita | Resultados, variaciones, entradas | Aspecto de consola; valores y unidades se cortaban en dos líneas a 1024 px |
| Navegación con píldoras | Barra de módulos y chips de los gráficos | Estética de plantilla; el módulo activo competía con el resto |
| Jerarquía tipográfica plana | Título del módulo (17 px) casi igual a los títulos de tarjeta; barra superior con dos líneas de texto pequeño | Difícil saber qué leer primero |
| Iconos y emojis decorativos | Avisos con ⛔ ⚠ ℹ, insignias numeradas en cajas | Ruido visual sin información |
| Portada genérica | Ocho tarjetas idénticas en grilla de 3 columnas y un botón azul | Parecía una página de producto, no una herramienta de investigación |
| Móvil | Barra de módulos con desplazamiento horizontal cortada; tarjetas grandes | Navegación incómoda |

## 2. Sistema de diseño

**Principio.** Estructurar con tipografía y filetes, no con cajas. Solo se usa un
contenedor cuando un grupo debe leerse como un objeto (tooltip, diálogo, panel
de parámetros en móvil).

### Paleta (modo oscuro predeterminado)

| Rol | Oscuro | Claro |
|---|---|---|
| Página / superficies | grafito `#121315`, `#17181b`, `#1e2024` | papel `#f4f2ec`, `#faf9f5`, `#ece9e1` |
| Texto | `#ebe7df`, `#b6b1a7`, `#8a857c` | `#1c1b18`, `#4b4842`, `#726e66` |
| Acento de interfaz (estado activo, foco) | latón `#d4ab5f` | `#86621a` |

El modo claro es una paleta propia (papel y tinta), no una inversión: los colores
de las curvas son pasos más oscuros de los mismos tonos.

### Colores con significado económico (iguales en todos los módulos)

| Concepto | Elementos | Color |
|---|---|---|
| Demanda / mercado de bienes | IS, DA, IS*, I(i), GA | cobre |
| Mercado monetario / política monetaria | LM, MP, regla de Taylor, curvas monetarias | acero |
| Oferta y precios | OA de corto plazo, curva de Phillips | ciruela |
| Sector externo | paridad cambiaria, BP | oliva |
| Referencias | producto potencial, cotas, LM tangente | gris neutro |
| Equilibrios | E₀ anillo hueco · E₁ punto sólido; curvas iniciales discontinuas | — |
| Signo de una variación | aumento / disminución | verde apagado / ladrillo |

Los escenarios comparados usan una paleta categórica que nunca coincide con los
colores de mercado. El mapa de calor usa una rampa secuencial de un solo tono
(arena → cobre) ordenada por luminosidad.

### Tipografía

| Uso | Fuente |
|---|---|
| Títulos, análisis, epígrafes, notas académicas, variables (*Y*, *i*, *c*) | Source Serif 4 (OFL), tamaño óptico variable |
| Interfaz, etiquetas, controles | IBM Plex Sans (OFL) |
| Cifras | IBM Plex Sans con cifras tabulares (las columnas se alinean) |
| Ecuaciones en bloque | IBM Plex Mono |

Las etiquetas que contienen símbolos matemáticos (dY/dG, Δi, E₀) nunca se pasan a
mayúsculas: hacerlo convertiría *i* (tasa) en *I* (inversión).

### Componentes

- **Cabecera:** marca en serif, preferencias como controles de texto y una
  navegación por secciones separadas por tema (economía cerrada · abierta ·
  precios e inflación · análisis comparado), con subrayado latón en el módulo
  activo. En pantallas angostas, un selector de módulo agrupado por tema y un
  botón «Parámetros».
- **Encabezado de módulo:** letra y tema como antetítulo, nombre del modelo en
  serif, descripción y acciones.
- **Resultados:** una banda contable con filetes finos; producto y tasa de
  interés en serif más grande como cifras principales.
- **Figuras:** sin caja; filete superior, numeración automática «Fig. n»,
  herramientas (fórmulas, SVG, PNG, ampliar) como texto discreto, etiquetas de
  curvas en serif cursiva como en un libro de texto, cuadrícula vertical casi
  invisible.
- **Análisis en cinco niveles:** un texto con entradilla en serif y secciones
  numeradas; la naturaleza de cada afirmación (resultado, interpretación,
  implicancia, advertencia) en versalitas, sin insignias.
- **Parámetros:** símbolo en serif cursiva, entrada numérica precisa con cifras
  tabulares, deslizador de pista fina con la marca de E₀ debajo.
- **Escenarios predefinidos:** lista de experimentos con viñeta, no grilla de botones.
- **Avisos:** filete lateral de color y título en versalitas, sin emojis.
- **Portada:** antetítulo, título, entradilla, una figura IS-LM calculada por el
  motor (expansión fiscal de 50 mil M) con su epígrafe y cifras, índice de los
  ocho módulos agrupado por tema con variables principales, y las convenciones
  gráficas.

## 3. Comparación

| Pantalla | Antes | Después |
|---|---|---|
| Inicio | ![](antes/inicio-oscuro.png) | ![](despues/inicio-oscuro.png) |
| IS-LM tradicional | ![](antes/simulador-fiscal-oscuro.png) | ![](despues/simulador-fiscal-oscuro.png) |
| IS-LM avanzado | ![](antes/avanzado-trampa-oscuro.png) | ![](despues/avanzado-trampa-oscuro.png) |
| Construcción de curvas | ![](antes/construccion-oscuro.png) | ![](despues/construccion-oscuro.png) |
| Políticas económicas | ![](antes/politicas-oscuro.png) | ![](despues/politicas-oscuro.png) |
| Mundell-Fleming | ![](antes/mundell-fleming-oscuro.png) | ![](despues/mundell-fleming-oscuro.png) |
| Oferta y demanda agregada | ![](antes/oa-da-oscuro.png) | ![](despues/oa-da-oscuro.png) |
| IS-MP | ![](antes/is-mp-oscuro.png) | ![](despues/is-mp-oscuro.png) |
| Laboratorio de escenarios | ![](antes/laboratorio-oscuro.png) | ![](despues/laboratorio-oscuro.png) |
| Informe (claro) | ![](antes/laboratorio-informe-claro.png) | ![](despues/laboratorio-informe-claro.png) |
| Notebook 1024 px | ![](antes/notebook-1024-oscuro.png) | ![](despues/notebook-1024-oscuro.png) |
| Tablet 768 px | ![](antes/tablet-768-oscuro.png) | ![](despues/tablet-768-oscuro.png) |
| Teléfono 390 px | ![](antes/inicio-movil-oscuro.png) | ![](despues/inicio-movil-oscuro.png) |

## 4. Evaluación crítica

**Lo que cambió de fondo.** La interfaz dejó de ser una colección de tarjetas:
los resultados son una banda contable, los gráficos son figuras numeradas, la
explicación es un texto, los escenarios son una lista y la portada presenta un
resultado real del modelo en lugar de iconos. El color pasó a significar algo
(mercado, signo de la variación o estado de un control) y es el mismo en los
ocho módulos. La unidad «mil M» ya no se parte en dos líneas.

**Lo que todavía se puede mejorar.**

- La lista de escenarios predefinidos del Módulo A sigue siendo larga (13
  experimentos) y empuja los parámetros hacia abajo en el panel lateral; podría
  plegarse por grupo.
- Algunas etiquetas de curvas y de equilibrios pueden superponerse cuando dos
  curvas terminan muy cerca (por ejemplo, LM₀ y LM₁ en pantallas angostas); el
  algoritmo de colocación es simple.
- En 1024 px la banda de resultados pasa a dos columnas y ocupa más altura que
  en escritorio.
- Los módulos con muchos gráficos (C y D) dependen de la numeración de figuras
  para orientarse; un índice lateral de figuras sería una mejora natural.
