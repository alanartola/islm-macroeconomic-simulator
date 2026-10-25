# Trampa de liquidez

## Supuestos

El laboratorio ofrece dos representaciones:

1. **Asintótica** (LM no lineal): la demanda especulativa a/(i − i_min) hace que
   la LM se aplane al acercarse la tasa a i_min. La tasa nunca alcanza i_min.
2. **Estricta** (LM con cota inferior): la demanda es lineal por encima de
   i_piso y perfectamente elástica en i_piso; la tasa no puede bajar más.

## Ecuaciones

- Asintótica: i(Y) = i_min + a/(m − kY).
- Estricta: i(Y) = max(i_piso, (kY + L₀ − m)/h).
- Condición verificable de cota vinculante:
  m > k·α(A − b·i_piso) + L₀ − h·i_piso. Saldos ociosos = diferencia entre ambos lados.

## Derivación de los efectos de política

Con la cota vinculante: Y = α(A − b·i_piso) no depende de m, por lo que
dY/dm = 0 y dY/dG = α (multiplicador keynesiano completo, sin desplazamiento).
En la versión asintótica las mismas conclusiones valen como límites:
dY/dm → 0 y dY/dG → α cuando la pendiente de la LM tiende a cero.

## Método de cálculo

Versión estricta: solución cerrada y verificación de la cota (sin
iteraciones). Versión asintótica: método de Brent (ver
[Métodos numéricos](metodos-numericos.md)).

## Ejemplos numéricos (escenarios B5, B6 y B11)

| Escenario | E₀ | E₁ | Resultado |
| --- | --- | --- | --- |
| B5: M 1.600 → 1.800 (no lineal) | Y 2.200; i 1,80 % | Y 2.213,93; i 1,58 % | +200 de dinero eleva Y solo 13,9 |
| B6: G 325 → 425 (no lineal, M = 1.600) | Y 2.200; i 1,80 % | Y 2.434,67; i 2,05 % | ΔY = 234,7 (desplazamiento < 10 %) |
| B11: M 1.500 → 1.700 (con cota) | Y 2.281,25; i 0,50 % | Y 2.281,25; i 0,50 % | dY/dM = 0: el dinero adicional queda ocioso |

## Interpretación

En la trampa de liquidez la expansión monetaria convencional pierde eficacia
porque el público absorbe el dinero adicional a una tasa que ya no baja; la
política fiscal no genera aumentos significativos de la tasa. Krugman (1998)
reinterpretó esta idea en términos de expectativas y tasas reales; esa versión
intertemporal **no** está modelada aquí.

## Limitaciones

No hay expectativas de inflación ni tasa real, por lo que no se representan
políticas de expectativas (orientación futura) ni la cota inferior en un modelo
con inflación; para eso ver el [IS-MP](is-mp-taylor.md), que incluye una cota
inferior efectiva sobre la tasa nominal.

## Referencias

Keynes (1936); Hicks (1937); Krugman (1998); Blanchard (2021).
