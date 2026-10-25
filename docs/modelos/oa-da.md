# Oferta y demanda agregada (Módulo F)

## Supuestos

- La **demanda agregada** se deriva del IS-LM del Módulo B con LM lineal, dejando
  que los saldos reales dependan del nivel de precios: M/P.
- **Oferta agregada de corto plazo** lineal con precio esperado Pᵉ exógeno:
  P = Pᵉ + θ(Y − Yₙ) + s, con θ ≥ 0 y un shock de costos s.
- **Mediano plazo**: expectativas cumplidas (Pᵉ = P).
- **Ajuste**: solo se muestra una trayectoria cuando hay una regla explícita:
  expectativas adaptativas Pᵉ_{t+1} = P_t, resolviendo cada período como un
  equilibrio de corto plazo.

## Ecuaciones

| Bloque | Ecuación |
| --- | --- |
| IS | Y = α(A − b·i), α = 1/[1 − c(1 − t)] |
| LM | M/P = kY + L₀ − h·i |
| DA | Y_DA(P) = a₁ + a₂/P, a₁ = (hA − bL₀)/D, a₂ = bM/D, D = h/α + bk |
| OA de corto plazo | P = Pᵉ + θ(Y − Yₙ) + s |
| Brecha | 100·(Y − Yₙ)/Yₙ (% del potencial) |

## Derivación

Resolviendo IS y LM para un P dado se obtiene Y_DA(P) = a₁ + a₂/P: la DA tiene
pendiente negativa porque un P mayor reduce M/P, eleva la tasa y reduce la
inversión (efecto Keynes).

Equilibrio de corto plazo: P = Pᵉ + s + θ(a₁ + a₂/P − Yₙ). Multiplicando por P > 0:

P² − B·P − θ·a₂ = 0,  B = Pᵉ + s + θ(a₁ − Yₙ)  ⇒  P* = [B + √(B² + 4θa₂)]/2,

la única raíz positiva cuando θ·a₂ > 0. Luego Y* = Y_DA(P*).

Mediano plazo: θ(Y − Yₙ) + s = 0 ⇒ Y_MP = Yₙ − s/θ y P_MP = a₂/(Y_MP − a₁). Un s
persistente se interpreta como un cambio del margen de fijación de precios y
reduce el producto de mediano plazo.

## Método de cálculo

Fórmula cerrada (raíz positiva de la cuadrática), validada: si no existe una
raíz positiva el motor informa el problema en lugar de un número. La trayectoria
de ajuste aplica la misma fórmula período a período con Pᵉ_{t+1} = P_t.

## Ejemplo numérico (calibración por defecto)

Parámetros del Módulo B con LM lineal (h = 25, L₀ = 225), Yₙ = 2.000, Pᵉ = 1,
θ = 0,0005, s = 0. a₁ = 777,78, a₂ = 1.222,22; E₀: Y = 2.000, P = 1, i = 5 %.

| Experimento | Corto plazo | Mediano plazo |
| --- | --- | --- |
| M 1.100 → 1.200 | Y 2.067,55; P 1,0338; brecha +3,38 % | Y 2.000; P 1,0909 (= 1.200/1.100) |
| G 325 → 375 | Y 2.034,71; P 1,0174; i 6,44 % | Y 2.000; P 1,0476; i 7 % |
| s 0 → 0,05 | Y 1.962,79; P 1,0314; brecha −1,86 % | Y 1.900; P 1,0891 |

Trayectoria tras la expansión monetaria (Pᵉ_{t+1} = P_t): brecha 3,38 % → 2,10 %
→ 1,32 % → 0,83 % → 0,53 % → 0,34 %; P converge a 1,0909.

## Interpretación

En el corto plazo una expansión de la demanda eleva producto y precios; a
medida que las expectativas se ajustan el producto vuelve a Yₙ y solo queda el
efecto sobre los precios. La expansión monetaria es neutral en el mediano plazo
(P aumenta en la misma proporción que M); la fiscal deja una tasa de interés más
alta y menor inversión.

## Limitaciones

Expectativas exógenas en el corto plazo y adaptativas simples en el ajuste; sin
crecimiento del producto potencial ni inflación persistente. Para un análisis
en términos de inflación y regla de tasa ver el [IS-MP](is-mp-taylor.md).

## Referencias

Blanchard (2021); Mankiw (2019); Friedman (1968); Phelps (1967).
