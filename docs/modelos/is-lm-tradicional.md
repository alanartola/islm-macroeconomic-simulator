# IS-LM tradicional (Módulo A)

Modelo lineal de referencia de Hicks (1937), en la forma de los manuales de
Blanchard (2021) y Mankiw (2019). La referencia exhaustiva (unidades, todas las
reglas de validación) está en [`../MODELO.md`](../MODELO.md).

## Supuestos

- Economía cerrada, corto plazo, nivel de precios P fijo y exógeno.
- Consumo, inversión y demanda de dinero lineales; impuestos de suma fija T.
- Dos regímenes monetarios: oferta monetaria M exógena (la tasa es endógena) u
  objetivo de tasa ī (la cantidad de dinero es endógena).
- Estática comparativa: se comparan dos equilibrios (E₀ y E₁); no se modela la
  trayectoria entre ellos.

## Ecuaciones

| Bloque | Ecuación |
| --- | --- |
| Consumo | C = C₀ + c(Y − T), 0 ≤ c < 1 |
| Inversión | I = I₀ − b·i, b ≥ 0 |
| Mercado de bienes (IS) | Y = C + I + G |
| Mercado de dinero (LM) | M/P = k·Y − h·i, k > 0, h ≥ 0 |

## Derivación

Sustituyendo consumo e inversión en la condición de equilibrio de bienes:

Y = C₀ + c(Y − T) + I₀ − b·i + G ⇒ (1 − c)Y = A − b·i, con A = C₀ − cT + I₀ + G.

Con m = M/P, el sistema lineal en (Y, i) es

```
(1 − c)·Y + b·i = A
      k·Y − h·i = m
```

Su determinante es D = h(1 − c) + b·k > 0 (salvo b = h = 0, caso degenerado
que el motor rechaza). Por la regla de Cramer:

Y* = (h·A + b·m)/D,  i* = (k·A − (1 − c)·m)/D.

Con **tasa objetivo** ī, la LM es horizontal: Y* = α(A − b·ī), α = 1/(1 − c), y el
banco central provee el dinero demandado: M* = P(k·Y* − h·ī).

## Método de cálculo

Solución analítica cerrada (sin iteraciones). El motor valida los parámetros
antes de resolver (c ∈ [0, 1), P > 0, k > 0, b, h ≥ 0, no degeneración) y
verifica la solución sustituyéndola en ambas ecuaciones.

## Ejemplo numérico (calibración por defecto)

C₀ = 200, c = 0,75, T = 200, I₀ = 300, b = 25, G = 250, M = 700, P = 1, k = 0,5, h = 50.

- A = 200 − 150 + 300 + 250 = 600; D = 50·0,25 + 25·0,5 = 25.
- E₀: Y* = (50·600 + 25·700)/25 = **1.900**, i* = (0,5·600 − 0,25·700)/25 = **5 %**.
- G = 300: Y = **2.000**, i = **6 %**, I cae de 175 a 150 (desplazamiento del 50 %).
- M = 800: Y = **2.000**, i = **4 %**.
- Tasa fija en 5 % y G = 300: Y = 4·(650 − 125) = **2.100**, M* = 1.050 − 250 = **800**.

## Interpretación

Una expansión fiscal desplaza la IS; con M fija la mayor demanda de dinero
transaccional eleva la tasa y reduce la inversión (efecto desplazamiento). Con
tasa fija no hay desplazamiento y el multiplicador es el keynesiano simple,
porque la política monetaria acomoda el aumento de la demanda de dinero.

## Limitaciones

- No hay expectativas, dinámica ni restricción presupuestaria intertemporal.
- Precios fijos: no distingue efectos reales de nominales (ver [OA-DA](oa-da.md)).
- Linealidad: las pendientes son constantes y la eficacia relativa de las
  políticas no depende del punto de partida (ver [LM no lineal](lm-no-lineal.md)).

## Referencias

Hicks (1937); Blanchard (2021); Mankiw (2019); Poole (1970) para la elección del
instrumento monetario. Detalle en el [índice](README.md#bibliografía-verificada).
