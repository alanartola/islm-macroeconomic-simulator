# IS-LM avanzado (Módulo B)

Extiende el modelo tradicional con impuestos proporcionales, transferencias y
tres especificaciones del mercado de dinero. Los Módulos C (construcción de
curvas) y D (políticas) usan exactamente este mismo modelo y estado.

## Supuestos

- Economía cerrada, precios fijos (P exógeno), corto plazo.
- Recaudación T = T₀ + t·Y con 0 ≤ t < 1; transferencias TR ≥ 0 a los hogares.
- LM **lineal**, **no lineal** (zona de trampa de liquidez asintótica) o **con
  cota inferior** i ≥ i_piso (trampa estricta).
- Régimen monetario: M exógena o tasa fija (acomodación, M endógena).

## Ecuaciones

| Bloque | Ecuación |
| --- | --- |
| Ingreso disponible | Y_d = Y − T₀ − tY + TR |
| Consumo | C = C₀ + c·Y_d |
| Inversión | I = I₀ − b·i |
| IS | Y = α(A − b·i), α = 1/[1 − c(1 − t)], A = C₀ − cT₀ + c·TR + I₀ + G |
| LM lineal | M/P = kY + L₀ − h·i |
| LM no lineal | M/P = kY + a/(i − i_min), i > i_min |
| LM con cota | lineal para i > i_piso; en i = i_piso la demanda es perfectamente elástica |

## Derivación

La IS surge de Y = C + I + G con el consumo sobre el ingreso disponible:
Y[1 − c(1 − t)] = A − b·i. El multiplicador simple α es menor que 1/(1 − c)
porque parte de cada aumento del ingreso se va en impuestos (estabilizador
automático; ver [Impuestos y transferencias](impuestos-y-transferencias.md)).

Con LM lineal el sistema es lineal y, con D = h/α + b·k:

Y* = (h·A + b(m − L₀))/D,  i* = (k·A − (m − L₀)/α)/D.

Con LM no lineal el equilibrio resuelve g(i) = Y_IS(i) − Y_LM(i) = 0, con
Y_LM(i) = (m − a/(i − i_min))/k. Como Y_IS es no creciente y Y_LM es
estrictamente creciente en i, g es estrictamente decreciente: **si existe, el
equilibrio es único** (ver [LM no lineal](lm-no-lineal.md)).

Con cota inferior, la cota vincula si la oferta real de dinero supera la
demanda a la tasa piso y al producto que implica la IS en esa tasa:
m > k·Y_IS(i_piso) + L₀ − h·i_piso. Entonces i = i_piso, Y = α(A − b·i_piso) y la
diferencia son saldos ociosos.

## Método de cálculo

- LM lineal y con cota: solución cerrada (Cramer) y verificación de la cota.
- LM no lineal: método de Brent sobre un intervalo que se amplía desde
  (i_min, i_min + 1] hasta encontrar cambio de signo; tolerancias 10⁻¹² en i y
  10⁻⁹ en g, máximo 300 iteraciones. Se informa método, iteraciones y residuo
  (ver [Métodos numéricos](metodos-numericos.md)).
- Multiplicadores y elasticidades: derivadas analíticas evaluadas en el
  equilibrio (teorema de la función implícita), no diferencias finitas.

## Ejemplo numérico (calibración por defecto)

C₀ = 200, c = 0,8, T₀ = 0, t = 0,25, TR = 125, I₀ = 300, b = 25, G = 325, M = 1.100,
P = 1, k = 0,5, a = 400, i_min = 1 (no lineal); h = 25, L₀ = 225 (lineal tangente).

- α = 2,5; A = 925; E₀: Y = **2.000**, i = **5 %** en las tres especificaciones
  (calibración elegida para ser verificable a mano: m − kY = 100 = 400/(5 − 1)).
- Pendiente de la LM no lineal en E₀: s = a·k/(m − kY)² = 0,02 pp por mil M.
- Expansión fiscal G = 375: LM no lineal Y = **2.047,38**, i = **6,24 %** (Brent, 7
  iteraciones, residuo < 10⁻¹²); LM lineal tangente Y = **2.055,56**, i = **6,11 %**.
  La diferencia muestra el efecto de la curvatura: la LM no lineal se empina a
  medida que Y crece y desplaza más inversión.

## Interpretación

La zona de la LM se clasifica con la proporción de desplazamiento
1 − (dY/dG)/α: trampa (< 10 %), intermedia o clásica (> 90 %). Es una
clasificación pedagógica de la eficacia relativa de las políticas, no un
umbral teórico.

## Limitaciones

Los parámetros son ilustrativos; la forma a/(i − i_min) es una forma funcional
didáctica, no una estimación. Valen las limitaciones del IS-LM estático.

## Referencias

Hicks (1937); Keynes (1936); Krugman (1998); Blanchard (2021); Brent (1973).
