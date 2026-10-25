# Impuestos y transferencias

## Supuestos

Recaudación T = T₀ + t·Y (componente autónomo y tasa marginal 0 ≤ t < 1) y
transferencias TR a los hogares. Ambos afectan el consumo a través del ingreso
disponible Y_d = Y − T₀ − tY + TR.

## Ecuaciones

- IS: Y = α(A − b·i), con α = 1/[1 − c(1 − t)] y A = C₀ − cT₀ + c·TR + I₀ + G.
- Saldo fiscal: T − G − TR = T₀ + tY − G − TR.

## Derivación

Diferenciando el sistema IS-LM en el equilibrio (s = pendiente de la LM):

| Multiplicador | Expresión |
| --- | --- |
| dY/dG | α/(1 + α·b·s) |
| dY/dTR | c · dY/dG |
| dY/dT₀ | −c · dY/dG |
| dY/dt | −c·Y · dY/dG |

**Estabilizador automático.** α disminuye con t: con c = 0,8, α = 5 si t = 0 y
α = 2,5 si t = 0,25. Un shock de demanda autónoma mueve el producto menos cuando
la recaudación responde al ingreso.

**Transferencias versus gasto.** Una transferencia se gasta solo en la fracción
c; por eso su multiplicador es c veces el del gasto. Ex ante, una expansión de G
financiada con un aumento igual de T₀ cambia el gasto autónomo en (1 − c)·ΔG y
tiene multiplicador (1 − c)·dY/dG > 0; con s = 0 y t = 0 vale exactamente 1
(resultado clásico del presupuesto equilibrado). En el Módulo A, con los
parámetros por defecto, es 0,25 × 2 = 0,5.

## Método de cálculo

El equilibrio completo se recalcula en E₀ y E₁ (no se suman efectos aislados);
los multiplicadores locales son derivadas analíticas en cada equilibrio.

## Ejemplos numéricos (LM no lineal, calibración por defecto)

| Experimento | Y₁ | i₁ | ΔY |
| --- | --- | --- | --- |
| B1: G 325 → 375 | 2.047,38 | 6,24 % | +47,38 |
| B2: TR 125 → 175 | 2.039,15 | 5,97 % | +39,15 |
| B12: t 0,25 → 0,30 | 1.895,96 | 3,63 % | −104,04 |

Con ΔG = ΔTR = 50, el efecto de las transferencias es menor (39,15 frente a
47,38). No es exactamente 0,8 veces porque el cambio es discreto y la pendiente
de la LM no lineal varía entre E₀ y E₁; la relación c·dY/dG vale para el
multiplicador local.

## Limitaciones

No hay deuda pública, restricción presupuestaria intertemporal ni efectos de
incentivos de los impuestos sobre la oferta.

## Referencias

Blanchard (2021); Mankiw (2019); Dornbusch, Fischer y Startz (2014).
