# Análisis de sensibilidad

## Supuestos

Un análisis de sensibilidad varía uno o dos parámetros manteniendo constantes
todos los demás y **resuelve el modelo completo en cada punto**. No se
extrapolan derivadas: en modelos no lineales el resultado de cada punto es un
equilibrio calculado. Los puntos sin solución económicamente válida se omiten
(nunca se interpolan ni se reemplazan por valores ficticios).

## Herramientas por módulo

| Módulo | Herramienta | Variable barrida | Resultado |
| --- | --- | --- | --- |
| A | Curvas de sensibilidad | b o h (121 puntos) | dY/dG, dY/d(M/P), desplazamiento y pendiente |
| A | Tabla de efectos | combinaciones de b y h | ΔY ante ΔG y Δ(M/P) dados |
| D | Curvas de multiplicadores | c, b, h, a, k o t (81 puntos) | dY/dG y dY/d(M/P) locales |
| D | Mapa de calor | b y un segundo parámetro | dY/dG o dY/d(M/P) en cada celda |
| G | Curvas de política | φπ o φy entre 0 y 3 (61 puntos) | brecha, inflación y tasa |
| H | Curvas de sensibilidad | cualquier parámetro común a los escenarios (41 puntos) | cualquier variable comparable de E₁ |
| H | Mapa de calor | dos parámetros de un escenario (13 × 13) | nivel en E₁ o variación E₁ − E₀ |

## Ecuaciones

En los modelos lineales los multiplicadores tienen forma cerrada y la
sensibilidad puede leerse directamente, por ejemplo en el Módulo A:

- ∂(dY/dG)/∂h > 0: una demanda de dinero más sensible a la tasa aplana la LM y
  reduce el desplazamiento.
- ∂(dY/dm)/∂b > 0: dY/dm = b/[h(1 − c) + bk] crece con b y tiende a 1/k cuando b → ∞.

En los modelos no lineales los multiplicadores dependen del punto de equilibrio,
por lo que cada punto de la curva requiere resolver el modelo de nuevo (método
de Brent cuando la LM es no lineal).

## Método de cálculo

- Rango del barrido en el Módulo H: ±50 % alrededor del valor de E₁ de cada
  escenario (para parámetros nulos se usa un rango fijo en las unidades del
  parámetro). Las curvas se dividen en tramos cuando aparecen puntos sin
  solución, para no unir puntos inexistentes.
- Mapas de calor: escala secuencial de un solo tono; el valor actual se marca
  con un recuadro; las celdas sin solución se muestran en gris.

## Ejemplo

Módulo A con la calibración por defecto: en h = 50, dY/dG = 2 y el
desplazamiento es del 50 %; con h → 0 la LM se vuelve vertical, dY/dG → 0 y
dY/dm → 1/k = 2. Módulo G: al subir φπ de 0,5 a 1,5, el traspaso de un shock de
demanda a la brecha (1/Δ) baja de 0,513 a 1/2,25 = 0,444.

## Interpretación

La sensibilidad muestra qué conclusiones dependen de la calibración. Un
resultado que cambia de signo o de orden de magnitud dentro de un rango
razonable de parámetros no debe presentarse como robusto.

## Limitaciones

Análisis local de un parámetro (o dos) por vez; no es un análisis de
incertidumbre conjunta ni una estimación de la distribución de los parámetros.

## Referencias

Blanchard (2021); Mankiw (2019); Poole (1970).
