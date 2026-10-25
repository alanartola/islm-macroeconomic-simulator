# Mundell-Fleming (Módulo E)

Modelo de una economía pequeña y abierta con movilidad perfecta de capitales,
según Mundell (1963) y Fleming (1962), en la presentación de manual de Mankiw
(2019) y Blanchard (2021).

## Supuestos

- Economía pequeña: la tasa internacional i* es exógena.
- Movilidad perfecta de capitales, sin prima de riesgo y con expectativas
  cambiarias estáticas: i = i*.
- Precios interno P y externo P^f fijos. Tipo de cambio real q = E·P^f/P; **una
  suba de q es una depreciación real**. Con precios fijos, q y E se mueven uno a
  uno.
- Oferta monetaria M = D + R (crédito interno + reservas).
- Régimen **flexible**: D y R exógenos. Régimen **fijo**: E = Ē; las reservas se
  ajustan para sostener la paridad (deben permanecer ≥ 0).

## Ecuaciones

| Bloque | Ecuación |
| --- | --- |
| Exportaciones | X = X₀ + v·Y* + x_q·q |
| Importaciones | IM = IM₀ + m·Y − m_q·q |
| Exportaciones netas | NX = X − IM |
| Consumo | C = C₀ + c(Y − T₀ − tY + TR) |
| Inversión | I = I₀ − b·i* |
| IS* | Y = α_o(A_o − b·i* + n·q), α_o = 1/[1 − c(1 − t) + m], n = x_q + m_q |
| LM* | M/P = k·Y − h·i* |

A_o = C₀ − cT₀ + c·TR + I₀ + G + X₀ + v·Y* − IM₀. La condición n > 0 es la
versión lineal de la condición de Marshall-Lerner (m_q es la respuesta de
volumen neta del efecto valuación).

## Derivación

- **Flexible.** M es exógena, por lo que la LM* determina Y = (M/P + h·i*)/k; la
  IS* determina q. Una expansión fiscal aprecia q y reduce NX en el mismo
  monto (desplazamiento completo vía tipo de cambio): dY/dG = 0. Una expansión
  monetaria eleva Y en ΔM/(k·P) y deprecia q.
- **Fijo.** q = q̄ es exógeno; la IS* determina Y y la LM* determina la cantidad
  de dinero necesaria, M = P(kY − h·i*); las reservas se ajustan R = M − D. Una
  expansión fiscal tiene multiplicador α_o; un aumento del crédito interno se
  compensa con una pérdida igual de reservas y no cambia Y.

## Método de cálculo

Solución cerrada en ambos regímenes. El motor rechaza resultados sin sentido
económico (Y ≤ 0, q ≤ 0, M ≤ 0, reservas negativas en el régimen fijo, n = 0
con tipo flexible), advierte cuando n < 0 (falla la condición de
Marshall-Lerner) y comprueba los residuos de los mercados de bienes y dinero,
de la identidad ahorro–inversión y de la balanza comercial.

## Ejemplo numérico (calibración por defecto)

c = 0,8, t = 0,25, TR = 125, G = 300, X₀ = 200, v = 0,1, Y* = 1.000, x_q = 100,
IM₀ = 300, m = 0,1, m_q = 100, k = 0,5, h = 50, i* = 4, D = 600, R = 200, Ē = 1.
α_o = 1/(1 − 0,6 + 0,1) = 2; E₀: Y = 2.000, q = 1, NX = 0.

| Experimento | Flexible | Fijo |
| --- | --- | --- |
| G 300 → 350 | Y 2.000; q 0,75; NX −50 | Y 2.100; q 1; NX −10; R 250 |
| D 600 → 700 | Y 2.200; q 1,50; NX +80 | Y 2.000; R 100 (pérdida de reservas) |

## Interpretación

Con movilidad perfecta de capitales la política monetaria es eficaz con tipo
flexible e ineficaz con tipo fijo; la política fiscal es eficaz con tipo fijo e
ineficaz con tipo flexible. Es el resultado central de Mundell (1963) y Fleming
(1962).

## Limitaciones

Sin prima de riesgo, expectativas cambiarias, efectos de balance ni ajuste de
precios; la movilidad imperfecta de capitales (BP con pendiente) no está
modelada en este módulo. La «trinidad imposible» se ilustra solo en su versión
de movilidad perfecta.

## Referencias

Mundell (1963); Fleming (1962); Mankiw (2019); Blanchard (2021).
