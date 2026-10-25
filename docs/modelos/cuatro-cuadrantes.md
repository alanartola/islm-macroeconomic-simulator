# Construcción gráfica de la IS y la LM (Módulo C)

## Supuestos

Se usa el modelo del [Módulo B](islm-avanzado.md) con sus mismos parámetros y
estado: cualquier cambio en el panel lateral actualiza los siete gráficos a la
vez. La construcción en cuatro cuadrantes de la LM corresponde al régimen de
oferta monetaria (con tasa fija la LM es horizontal y M es endógena).

## Los siete gráficos

| # | Gráfico | Qué muestra |
| --- | --- | --- |
| 1 | Cruz keynesiana | GA(Y) = C(Y) + I(i) + G frente a la recta de 45°; pendiente c(1 − t) |
| 2 | Formación de la IS | Equilibrio de bienes para dos tasas i_a < i_b y los puntos (Y, i) resultantes |
| 3 | IS en cuatro cuadrantes | Inyecciones, igualdad J = W, filtraciones y la IS |
| 4 | Mercado monetario | Oferta real M/P, demanda total, transaccional y especulativa |
| 5 | Formación de la LM | Tasas que equilibran el mercado de dinero para dos niveles de Y |
| 6 | LM en cuatro cuadrantes | Demanda especulativa, reparto de M/P, demanda transaccional y la LM |
| 7 | Equilibrio IS-LM | Curvas inicial y final, E₀ y E₁ |

## Ecuaciones y derivación

**IS en cuatro cuadrantes.**

- II: inyecciones J(i) = I₀ − b·i + G.
- III: equilibrio de bienes J = W (recta de 45°).
- IV: filtraciones W(Y) = Y − C(Y) = S_p + (T − TR), con pendiente 1 − c(1 − t).
- I: IS = {(Y, i) : W(Y) = J(i)}, es decir Y = α(J(i) + C₀ − cT₀ + c·TR).

**LM en cuatro cuadrantes.**

- II: demanda especulativa L_s(i) (L₀ − h·i lineal, a/(i − i_min) no lineal).
- III: reparto de la oferta real L_t + L_s = M/P (recta de pendiente −1).
- IV: demanda transaccional L_t = k·Y.
- I: LM = {(Y, i) : k·Y + L_s(i) = M/P}.

**Formación paso a paso.** Para la IS se eligen dos tasas, se calcula la
inversión, se resuelve el equilibrio de la cruz keynesiana para cada una y se
trasladan los pares (Y, i); la pendiente resultante es di/dY = −1/(α·b). Para la
LM se eligen dos niveles de producto, se calcula la demanda transaccional y la
tasa que equilibra el mercado monetario.

## Método de cálculo

Cada punto de cada gráfico se obtiene de las funciones estructurales del motor
(consumo, inversión, inyecciones, filtraciones, demanda de dinero), de modo que
los siete paneles representan el mismo modelo. Las «rondas del multiplicador»
de la cruz keynesiana se muestran como descomposición lógica
ΔY = ΔA·(1 + c' + c'² + …), c' = c(1 − t), a tasa constante: no son una
trayectoria temporal.

## Ejemplo

Con la calibración por defecto (t = 0,25, A = 925): c' = 0,6, α = 2,5. Para
i_a = 3 % e i_b = 7 %: I(3) = 225 e I(7) = 125; los equilibrios de bienes dan
Y_a = 2,5·(925 − 75) = 2.125 e Y_b = 2,5·(925 − 175) = 1.875, de modo que la IS
tiene pendiente (7 − 3)/(1.875 − 2.125) = −0,016 pp por mil M = −1/(2,5·25).
Con G = 375 (escenario B1) los mismos pasos dan 2.250 y 2.000: la IS se desplaza
α·ΔG = 125 a la derecha sin cambiar de pendiente.

## Interpretación

La construcción muestra de dónde vienen las pendientes: la IS es más plana
cuanto mayores son α y b; la LM es más plana cuanto más sensible a la tasa es la
demanda especulativa.

## Limitaciones

Es una representación gráfica del mismo modelo estático; no agrega supuestos ni
dinámica.

## Referencias

Hicks (1937); Hansen (1953); Dornbusch, Fischer y Startz (2014).
