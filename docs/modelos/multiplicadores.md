# Multiplicadores y efecto desplazamiento

## Supuestos

Los multiplicadores son **derivadas locales** del equilibrio respecto de un
instrumento, manteniendo constantes los demás parámetros. En modelos lineales
coinciden con el efecto de un cambio discreto; en modelos no lineales (LM no
lineal, Mundell-Fleming con reservas, OA-DA) el efecto de un cambio discreto se
obtiene resolviendo de nuevo el equilibrio, y el multiplicador local cambia
entre E₀ y E₁.

## Derivación general (Módulos A y B)

Diferenciando IS y LM en el equilibrio, con s = di/dY a lo largo de la LM:

- IS: dY = α(dA − b·di)
- LM: di = s·dY + (∂i/∂m)·dm

Sustituyendo:

dY/dG = α/(1 + α·b·s),  dY/dm = −α·b·(∂i/∂m)/(1 + α·b·s).

Proporción de desplazamiento (crowding out): 1 − (dY/dG)/α = α·b·s/(1 + α·b·s),
la fracción del efecto keynesiano a tasa constante que se pierde por el aumento
de la tasa.

Casos límite:

| Situación | s | dY/dG | dY/dm |
| --- | --- | --- | --- |
| Tasa fija (acomodación) | 0 | α | 0 (M endógena) |
| Trampa de liquidez | → 0 | → α | → 0 |
| LM vertical (h = 0) | ∞ | 0 | 1/k |
| IS vertical (b = 0) | — | α | 0 |

En el Módulo A (lineal, s = k/h) las expresiones se reducen a
dY/dG = h/D y dY/dm = b/D, con D = h(1 − c) + b·k.

## Ejemplos numéricos

- Módulo A por defecto: α = 4, dY/dG = 2, dY/dm = 1, dY/dT = −1,5,
  presupuesto equilibrado 0,5, desplazamiento 50 %.
- Módulo B, E₀ no lineal: α = 2,5, s = 0,02, dY/dG = 2,5/2,25 = 1,111,
  dY/dm = 1,111, desplazamiento 55,6 %.
- Módulo E (Mundell-Fleming): con tipo de cambio flexible dY/dG = 0 y
  dY/dM = 1/(k·P); con tipo fijo dY/dG = α_o y dY/dD = 0.

## Método de cálculo

Fórmulas analíticas evaluadas en el equilibrio (no diferencias finitas). En el
Módulo D, además, cada experimento discreto se resuelve completo y se informa
el «multiplicador efectivo» ΔY/Δinstrumento junto al desplazamiento en mil M
(ΔY a tasa constante − ΔY efectivo).

## Interpretación

El multiplicador no es una constante del modelo sino una propiedad del
equilibrio: depende de la pendiente de la LM en el punto de partida, del
régimen monetario y cambiario y de la tasa impositiva.

## Limitaciones

Multiplicadores de estática comparativa (impacto de largo plazo dentro del
corto plazo del modelo); no son multiplicadores dinámicos ni estimaciones
empíricas.

## Referencias

Hicks (1937); Blanchard (2021); Mankiw (2019); Mundell (1963); Fleming (1962).
