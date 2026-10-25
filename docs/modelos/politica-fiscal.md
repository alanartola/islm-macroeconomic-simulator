# Política fiscal (Módulo D)

## Supuestos

Modelo del [Módulo B](islm-avanzado.md). Cada experimento se resuelve como un
equilibrio completo en E₀ y E₁; los efectos no se obtienen sumando
componentes aislados.

## Instrumentos

| Instrumento | Cambio | Canal |
| --- | --- | --- |
| Gasto público | ΔG (financiado con déficit) | Demanda autónoma directa |
| Impuesto autónomo | ΔT₀ | −c·ΔT₀ en el consumo |
| Tasa impositiva | Δt | Cambia α y la recaudación inducida |
| Transferencias | ΔTR | +c·ΔTR en el consumo |
| Gasto financiado con impuestos | ΔG = ΔT₀ | (1 − c)·ΔG en la demanda autónoma |
| Expansión con acomodación | ΔG con i sostenida en i₀ | M endógena, sin desplazamiento |

## Ecuaciones

- ΔY a tasa constante (desplazamiento horizontal de la IS en i₀): α·ΔA.
- Efecto desplazamiento (mil M) = ΔY a tasa constante − ΔY efectivo.
- Multiplicador efectivo = ΔY/Δinstrumento (no se informa para t, cuyas unidades difieren).
- Δ saldo fiscal = Δ(T₀ + tY − G − TR), incluida la recaudación inducida por ΔY.

## Derivación

Ver [Multiplicadores](multiplicadores.md): dY/dG = α/(1 + α·b·s). La
acomodación monetaria fija s = 0 y lleva el multiplicador a α.

## Ejemplos numéricos (LM no lineal, E₀: Y = 2.000, i = 5 %)

| Experimento | Y₁ | i₁ | ΔY | Observación |
| --- | --- | --- | --- | --- |
| G +50 | 2.047,38 | 6,24 % | +47,38 | ΔY a tasa constante = 125; desplazamiento ≈ 77,6 |
| G +50 con acomodación | 2.125,00 | 5,00 % | +125,00 | Sin desplazamiento; M aumenta |
| G +100 en zona de trampa (M = 1.600) | 2.434,67 | 2,05 % | +234,67 | Desplazamiento bajo |
| G +100 en zona clásica (M = 780) | 1.509,52 | 16,85 % | +15,65 | Desplazamiento casi total |

## Interpretación

La eficacia de la política fiscal depende de la respuesta de la tasa de
interés, es decir, de la pendiente de la LM en el punto de partida y del
régimen monetario. La matriz de combinaciones del Módulo D resuelve cada par
(política fiscal, política monetaria) conjuntamente y muestra la diferencia
con la suma de efectos individuales, que en modelos no lineales no es aditiva.

## Limitaciones

Sin financiamiento explícito del déficit, deuda, expectativas ni efectos de
oferta de los impuestos.

## Referencias

Blanchard (2021); Mankiw (2019); Hicks (1937).
