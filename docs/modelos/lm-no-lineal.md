# LM no lineal

## Supuestos

La demanda real de dinero tiene un componente transaccional lineal en el
ingreso y un componente especulativo que crece sin límite cuando la tasa se
acerca a un mínimo i_min (los agentes prefieren mantener liquidez cuando la
tasa es muy baja):

L(Y, i) = k·Y + a/(i − i_min),  a > 0,  i > i_min.

## Ecuaciones

Equilibrio monetario M/P = L(Y, i):

- LM como tasa: i(Y) = i_min + a/(m − kY), con dominio m − kY > 0.
- LM como producto: Y(i) = (m − a/(i − i_min))/k, para i > i_min.

## Derivación de la pendiente

di/dY = a·k/(m − kY)² > 0, creciente en Y:

- Para Y bajo (m − kY grande) la pendiente tiende a 0: la LM es casi horizontal
  y la tasa se aproxima a i_min (**zona de trampa de liquidez**).
- Cuando Y se acerca a m/k la pendiente tiende a infinito: la LM es casi
  vertical (**zona clásica**).

Derivada respecto de la oferta real de dinero, con Y fijo:
∂i/∂m = −a/(m − kY)². Un mismo aumento de m baja poco la tasa en la zona de
trampa y mucho en la zona clásica.

## Método de cálculo

La intersección con la IS no tiene solución cerrada útil (resulta una ecuación
cuadrática en i con raíces que deben filtrarse por dominio), por lo que el motor
resuelve g(i) = α(A − b·i) − (m − a/(i − i_min))/k = 0 con el método de Brent.
g es estrictamente decreciente en (i_min, ∞) y tiende a +∞ cuando i → i_min⁺,
de modo que la raíz es única si existe; si no se encuentra cambio de signo se
informa «sin equilibrio» en lugar de un número.

## Ejemplo numérico

Con la calibración del Módulo B (a = 400, i_min = 1, k = 0,5, M/P = 1.100):

| Caso | Y | i | Zona | dY/dG | Desplazamiento |
| --- | --- | --- | --- | --- | --- |
| E₀ | 2.000 | 5,00 % | intermedia | 1,111 | 55,6 % |
| M = 1.600 | 2.200 | 1,80 % | trampa | 2,381 | 4,8 % |
| M = 780 | 1.493,87 | 13,10 % | clásica | 0,201 | 92,0 % |

## Interpretación

La no linealidad hace que la eficacia de las políticas dependa del punto de
partida: con abundancia de liquidez la política monetaria pierde fuerza y la
fiscal la gana; con escasez ocurre lo contrario. Con LM lineal (Módulo A) ese
contraste no existe.

## Limitaciones

Forma funcional didáctica; i_min es un parámetro y no se deriva de un
problema de optimización. El modelo es estático.

## Referencias

Keynes (1936); Hicks (1937); Hansen (1953); Krugman (1998).
