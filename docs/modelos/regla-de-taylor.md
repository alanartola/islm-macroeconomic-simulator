# Regla de Taylor (Módulo G)

## Supuestos

El banco central fija la tasa nominal según la forma propuesta por Taylor
(1993), que con φπ = φy = 0,5, r̂* = 2 % y π* = 2 % reproduce su
especificación original.

## Ecuación

i = r̂* + π + φπ·(π − π*) + φy·x + v,  sujeta a i ≥ i_lb.

- r̂*: tasa real neutral que usa el banco central (puede diferir de la
  verdadera rₙ).
- φπ, φy ≥ 0: respuestas a la inflación y a la brecha.
- v: shock discrecional (pp).

## Principio de Taylor

El coeficiente total de i sobre π es 1 + φπ. Con φπ > 0 la tasa nominal sube
más que la inflación y la tasa **real** aumenta ante más inflación, lo que
estabiliza. El motor advierte cuando φπ ≤ 0 (en esta forma de la regla, el
principio exige φπ > 0).

## Derivación de los efectos

En el [IS-MP](is-mp-taylor.md), con Δ = 1 + σκ(1 + φπ) + σφy:

- dx/dd = 1/Δ: un φπ o φy mayor reduce el traspaso de los shocks de demanda.
- dx/du = −σ(1 + φπ)/Δ: ante un shock de oferta, más respuesta a la inflación
  implica más pérdida de producto.
- Error en la tasa neutral: si r̂* > rₙ la política es contractiva aunque v = 0
  (dx/dr̂* = −σ/Δ).

## Método de cálculo

Solución cerrada; las curvas de sensibilidad del módulo recalculan el
equilibrio para 61 valores de φπ o φy entre 0 y 3, manteniendo constantes los
demás parámetros.

## Ejemplo numérico

Calibración por defecto (Δ = 1,95):

- d = +2: i pasa de 4 % a 4,97 %; la tasa real sube 0,97 pp y la brecha queda en
  1,03 (dx/dd = 1/1,95 = 0,513).
- v = +1 (contracción discrecional): i = 4,51 %, x = −0,51, π = 1,85 %.
- Cota inferior: con d = −10 la regla pediría una tasa negativa; la cota vincula
  en i = 0 y la brecha es −6 (con la regla sin cota sería −5,13).

## Interpretación

La regla describe una política sistemática; la elección de φπ y φy refleja el
peso relativo de estabilizar inflación y actividad. Con la cota vinculante la
regla deja de operar y aparecen los argumentos a favor de herramientas no
convencionales, que este modelo no representa.

## Limitaciones

Regla de un período, sin suavizamiento de tasas, sin expectativas endógenas y
sin incertidumbre sobre rₙ más allá del parámetro r̂*.

## Referencias

Taylor (1993); Clarida, Galí y Gertler (1999); Woodford (2003); Carlin y
Soskice (2015).
