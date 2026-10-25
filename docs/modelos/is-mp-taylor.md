# IS-MP (Módulo G)

Modelo estático de tres ecuaciones en la tradición de Romer (2000) y Carlin y
Soskice (2015): la LM se reemplaza por una regla de política para la tasa
nominal; se agrega una curva de Phillips con expectativas exógenas. Ver también
[Curva de Phillips](curva-de-phillips.md) y [Regla de Taylor](regla-de-taylor.md).

## Supuestos

- **Unidades**: todas las variables en puntos porcentuales. x es la brecha del
  producto en % del potencial; π y las tasas en % anual.
- Expectativas de inflación πᵉ exógenas; tasa real ex ante r = i − πᵉ.
- El banco central fija la tasa nominal i (no la cantidad de dinero; el dinero
  se ajusta a la tasa, por eso no hay curva LM).
- Cota inferior efectiva i ≥ i_lb.
- Régimen **regla** (Taylor) o **tasa fija** (i = ī).

## Ecuaciones

| Bloque | Ecuación |
| --- | --- |
| IS | x = d − σ(i − πᵉ − rₙ) |
| Phillips | π = πᵉ + κ·x + u |
| Regla | i = r̂* + π + φπ(π − π*) + φy·x + v |
| Cota | i ≥ i_lb |

rₙ es la tasa real neutral verdadera (en la IS) y r̂* la que usa el banco central
en su regla; v es un shock discrecional de política.

## Derivación

Sustituyendo la curva de Phillips y la regla en la IS, con
Δ = 1 + σκ(1 + φπ) + σφy > 0:

x* = [d − σ((r̂* − rₙ + v) + (1 + φπ)·u + φπ·(πᵉ − π*))]/Δ,

luego π de la curva de Phillips e i de la regla. Si la regla prescribe i < i_lb,
la cota vincula: i = i_lb, x = d − σ(i_lb − πᵉ − rₙ) y π de la curva de Phillips.
Con tasa fija: x = d − σ(ī − πᵉ − rₙ).

## Método de cálculo

Solución cerrada con verificación de la rama de la cota; se informan los
residuos de las tres ecuaciones y las derivadas dx/dd, dπ/du, etc.

## Ejemplo numérico (calibración por defecto)

d = 0, σ = 1, rₙ = r̂* = 2, κ = 0,3, πᵉ = π* = 2, u = 0, φπ = φy = 0,5, v = 0,
i_lb = 0, ī = 4. Δ = 1,95. E₀: x = 0, π = 2 %, i = 4 %, r = 2 %.

| Experimento | Regla de Taylor | Tasa fija ī = 4 |
| --- | --- | --- |
| d = +2 | x 1,03; π 2,31 %; i 4,97 % | x 2,00; π 2,60 % |
| u = +1 | x −0,77; π 2,77 %; i 4,77 % | x 0; π 3,00 % |
| π* 2 → 3 | x 0,26; π 2,08 %; i 3,74 % | — |
| v = +1 | x −0,51; π 1,85 %; i 4,51 % | — |
| d = −10 | cota vinculante: i 0 %; x −6; π 0,20 % | — |

## Interpretación

La regla estabiliza: ante un shock de demanda la tasa sube y amortigua la
brecha (1,03 frente a 2 con tasa fija). Ante un shock de oferta la regla
enfrenta un dilema: reduce la inflación a costa de una brecha negativa. Con la
cota inferior vinculante la política convencional deja de responder y el shock
de demanda se transmite completo.

## Limitaciones

Modelo estático con expectativas exógenas; no es el modelo neokeynesiano con
optimización intertemporal (Clarida, Galí y Gertler, 1999; Galí, 2015;
Woodford, 2003), cuya IS y curva de Phillips son prospectivas. Sin dinámica de
inflación ni credibilidad.

## Referencias

Romer (2000); Carlin y Soskice (2015); Taylor (1993); Clarida, Galí y Gertler
(1999); Galí (2015); Woodford (2003).
