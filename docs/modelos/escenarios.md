# Laboratorio de escenarios (Módulo H)

## Supuestos de diseño

- Un escenario guarda **solo supuestos**: modelo, parámetros de E₀ y E₁,
  régimen y, cuando corresponde, especificación de la LM y tasas objetivo.
- **Los resultados siempre se recalculan** con el motor del modelo al mostrar,
  comparar, exportar o imprimir. Un archivo importado con resultados alterados
  no puede modificar lo que se muestra.
- Se comparan hasta **cuatro** escenarios a la vez; se almacenan hasta 40 en el
  navegador (clave `islm.lab.v1`), sin servidor.

## Comparabilidad

Las variables se agrupan en familias con **la misma definición y unidad**. Solo
comparten fila las variables de una misma familia; si un modelo no define la
variable, la celda indica «no definido en este modelo».

| Familia | Definida en |
| --- | --- |
| Producto Y, tasa de mercado i, C, I, G, T, M/P | A, B, E, F (Y en mil M; i en %) |
| Ahorro nacional S, multiplicador local dY/dG | A, B, E |
| Ahorro público T − G | A, B, E, F |
| Nivel de precios P | F |
| Brecha del producto (% del potencial) | F y G |
| Inflación, tasa de política | G |
| NX, tipo de cambio real q, reservas R | E |

El IS-MP mide la actividad como brecha y la tasa como tasa de política en un
contexto con inflación: por eso **no** se compara con el producto en niveles ni
con la tasa de los modelos IS-LM de precios fijos. La brecha sí es comparable
entre OA-DA e IS-MP porque ambas se definen como % del potencial.

## Gráficos

- **Variación por escenario**: barras E₁ − E₀ de una variable elegida.
- **Comparación de equilibrios en (Y, i)**: E₀ y E₁ de cada escenario con
  producto y tasa definidos, unidos por una flecha que compara dos equilibrios
  estáticos (no es una trayectoria).
- **Curvas de sensibilidad** y **mapa de calor**: ver
  [Análisis de sensibilidad](sensibilidad.md).

Cada gráfico se exporta en SVG o PNG.

## Exportación e importación

- **CSV** de la comparación: una fila por variable y estadístico (E0, E1,
  delta), una columna por escenario, celdas vacías donde la variable no está
  definida; codificación UTF-8 con BOM.
- **JSON**: `{ "format": "islm-lab", "version": 1, "exportedAt", "scenarios":
  [{ id, name, createdAt, config, results }] }`. `results` es informativo.
- **Importación**: se valida el formato y cada configuración (modelo conocido,
  todos los parámetros numéricos y finitos, régimen y especificación válidos).
  Las entradas inválidas se rechazan y se informa cuántas.
- **Enlaces**: `?m=<módulo>#x=<configuración>` reabre exactamente la
  configuración en su módulo; un enlace mal formado se ignora.

## Informe imprimible

El informe (Imprimir / PDF desde el navegador) incluye, para cada escenario:
nombre del modelo, régimen, fecha, supuestos, perturbación, parámetros de E₀ y
E₁, equilibrio inicial y final con variaciones, explicación en cinco niveles,
ecuaciones y limitaciones; luego la tabla comparativa y los gráficos. Se
imprime siempre con la paleta clara.

## Limitaciones

Los escenarios se guardan solo en el navegador del usuario; borrar los datos
del sitio los elimina (exportar a JSON para conservarlos).
