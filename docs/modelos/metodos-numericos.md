# Métodos numéricos y validación

## Principios

1. **Solución cerrada cuando existe.** Los modelos lineales (Módulo A, B con LM
   lineal o con cota, Mundell-Fleming, IS-MP) se resuelven con fórmulas
   analíticas.
2. **Métodos robustos cuando no existe.** La LM no lineal se resuelve con el
   método de Brent sobre un intervalo con cambio de signo verificado.
3. **Nunca un número sin solución.** Si no hay equilibrio, el método no
   converge o el resultado viola restricciones económicas, el motor devuelve un
   diagnóstico explícito y la interfaz lo muestra en lugar de valores.
4. **Verificación.** Toda solución se sustituye en las ecuaciones originales y
   se informan los residuos.

## Soluciones cerradas

| Modelo | Método |
| --- | --- |
| IS-LM lineal | Regla de Cramer sobre el sistema 2 × 2; determinante D > 0 |
| LM con cota | Solución lineal y verificación de la condición de cota vinculante |
| OA-DA | Raíz positiva de P² − B·P − θa₂ = 0 |
| Mundell-Fleming | Despeje secuencial según el régimen (LM* → Y o IS* → Y) |
| IS-MP | Fórmula de x* con Δ > 0 y rama de cota inferior |

## Método de Brent (LM no lineal)

Se busca la raíz de g(i) = α(A − b·i) − (m − a/(i − i_min))/k en (i_min, ∞).

- **Existencia y unicidad.** g es continua y estrictamente decreciente en el
  dominio y g(i) → +∞ cuando i → i_min⁺; si existe una raíz es única.
- **Intervalo.** Se parte de [i_min + ε, i_min + 1] y se amplía el extremo
  superior con pasos crecientes (hasta 80 ampliaciones) hasta detectar cambio de
  signo; si no se detecta se informa «sin equilibrio».
- **Iteración.** Brent (1973, cap. 4) combina interpolación cuadrática inversa,
  secante y bisección; converge superlinealmente para funciones suaves y nunca
  abandona el intervalo.
- **Tolerancias.** |Δi| ≤ 10⁻¹², |g| ≤ 10⁻⁹, máximo 300 iteraciones. Se
  informan método, iteraciones, residuo e intervalo final.

Ejemplo: con la calibración del Módulo B, E₀ se obtiene en 5 iteraciones con
residuo 4,5·10⁻¹³ sobre el intervalo [1,000000001; 9].

## Derivadas

Multiplicadores, pendientes y elasticidades se calculan con derivadas
analíticas (teorema de la función implícita) evaluadas en el equilibrio; las
pruebas automáticas las contrastan con diferencias finitas.

## Validaciones económicas

Antes de resolver: propensiones y tasas en [0, 1), precios y k positivos,
sensibilidades no negativas, sistema no degenerado, tasa objetivo dentro del
dominio. Después de resolver: producto, precios, tipo de cambio y cantidad de
dinero positivos, reservas no negativas (tipo fijo), raíz positiva en OA-DA.
Las situaciones posibles pero inusuales (inversión o tasa negativas,
deflación, cota vinculante) se informan como advertencias o notas.

## Pruebas

Las pruebas automáticas (Vitest) comparan los motores con soluciones
calculadas a mano, verifican residuos, unicidad, casos límite (h = 0, b = 0,
trampa, zona clásica, cota inferior), regímenes cambiarios y monetarios, y las
propiedades de estática comparativa.

## Referencias

Brent (1973).
