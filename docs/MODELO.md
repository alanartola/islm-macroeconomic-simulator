# Referencia del modelo — IS-LM con dos regímenes monetarios

Este documento es la referencia técnica del motor ubicado en `src/engine/`. Cada fórmula está implementada allí y verificada por las pruebas de `src/engine/*.test.ts`.

> Traducción al inglés: [MODEL.en.md](MODEL.en.md).

## 1. Supuestos

1. Economía cerrada: sin comercio exterior ni flujos de capital.
2. Corto plazo con nivel de precios P fijo (exógeno). Sin bloque de oferta agregada, inflación ni expectativas; las tasas de interés nominal y real coinciden.
3. Relaciones de comportamiento lineales con coeficientes constantes; impuestos netos de suma fija T.
4. Dos activos financieros (dinero y bonos) y una única tasa de interés.
5. Estática comparativa: se comparan equilibrios; no se modelan las trayectorias de ajuste.
6. Los parámetros por defecto son una calibración **hipotética**, elegida para obtener resultados redondos y verificables a mano. No son estimaciones de ninguna economía.

## 2. Notación y unidades

| Símbolo | Significado | Unidad | Restricción |
|---|---|---|---|
| Y | producto / ingreso | mil M por período | endógena, debe ser > 0 |
| C, I | consumo, inversión | mil M | endógenas |
| G, T | gasto público, impuestos netos de suma fija | mil M | G ≥ 0 (T < 0 admitido: transferencias netas, se señala) |
| C₀, I₀ | consumo e inversión autónomos | mil M | ≥ 0 |
| c | propensión marginal a consumir | — | 0 ≤ c < 1 |
| b | sensibilidad de la inversión a la tasa | mil M / pp | ≥ 0 |
| i | tasa de interés | pp (5 ⇒ 5%) | endógena (Modo 1) o ī exógena (Modo 2) |
| M | cantidad nominal de dinero | mil M | > 0 en el Modo 1; endógena en el Modo 2 |
| P | nivel de precios | índice | > 0 |
| k | sensibilidad de la demanda de dinero al ingreso | — | > 0 |
| h | sensibilidad de la demanda de dinero a la tasa | mil M / pp | ≥ 0 |

"mil M" = miles de millones de unidades monetarias. Como i se mide en puntos porcentuales, b·i y h·i se miden en mil M y todas las ecuaciones son dimensionalmente homogéneas. Expresar i como decimal exige multiplicar b y h por 100; la asignación real no cambia (verificado por las pruebas).

## 3. Ecuaciones estructurales

```
(1) Y = C + I + G
(2) C = C₀ + c (Y − T)
(3) I = I₀ − b i
(4) M/P = k Y − h i
```

## 4. Curva IS

Sustituyendo (2)–(3) en (1):

```
Y = C₀ + cY − cT + I₀ − b i + G
(1 − c) Y = A − b i,           A ≡ C₀ − cT + I₀ + G
Y = α (A − b i),               α ≡ 1/(1 − c)
i = [A − (1 − c) Y] / b        (b > 0)
```

- Pendiente: di/dY = −(1 − c)/b < 0. Con b = 0 la IS es vertical en Y = αA.
- Un cambio ΔA desplaza la IS horizontalmente en αΔA a cualquier tasa.
- Los cambios en b o c **rotan** la IS alrededor de su intersección en i = 0 (Y = αA; c también mueve esa intersección).

## 5. Curva LM

Con m ≡ M/P:

```
m = k Y − h i
Y = (m + h i)/k
i = (k Y − m)/h                (h > 0)
```

- Pendiente: di/dY = k/h > 0. Con h = 0 la LM es vertical en Y = m/k (caso clásico); cuando h → ∞ se vuelve horizontal (trampa de liquidez).
- Un cambio Δm desplaza la LM horizontalmente en Δm/k; los cambios en k o h la rotan.

## 6. Equilibrio — Modo 1 (oferta monetaria exógena)

Resolviendo las ecuaciones IS y LM:

```
D  ≡ h (1 − c) + b k
Y* = (h A + b m) / D
i* = (k A − (1 − c) m) / D
```

D > 0 siempre que b > 0 o h > 0; D = 0 solo cuando b = h = 0 (ambas curvas verticales, equilibrio indeterminado), caso que se rechaza.

**Calibración por defecto:** C₀ = 200, c = 0,75, T = 200, I₀ = 300, b = 25, G = 250, M = 700, P = 1, k = 0,5, h = 50:

```
A = 200 − 150 + 300 + 250 = 600,  m = 700,  D = 12,5 + 12,5 = 25
Y* = (50·600 + 25·700)/25 = 1900,   i* = (0,5·600 − 0,25·700)/25 = 5
C = 1475, I = 175, S_p = 225, S_g = −50, S = 175 = I
```

## 7. Equilibrio — Modo 2 (objetivo de tasa de interés)

El banco central fija i = ī y provee el dinero demandado a esa tasa. La curva LM es la recta horizontal i = ī.

```
Y* = α (A − b ī)
M* = P (k Y* − h ī)          (debe ser > 0; si no, el objetivo es inviable)
```

M es endógena; el parámetro M se ignora. Fijar ī en la tasa de equilibrio del Modo 1 reproduce exactamente ese equilibrio (verificado por las pruebas).

## 8. Multiplicadores

Modo 1 (diferenciando la forma reducida):

```
∂Y/∂G = ∂Y/∂I₀ = ∂Y/∂C₀ = h/D           ∂i/∂G = k/D
∂Y/∂T = −c h/D                          ∂i/∂T = −c k/D
∂Y/∂m = b/D                             ∂i/∂m = −(1 − c)/D
presupuesto equilibrado (dT = dG): (1 − c) h/D
proporción del efecto desplazamiento: 1 − (h/D)/α = b k / D
```

Modo 2:

```
∂Y/∂G = α,   ∂Y/∂T = −c α,   presupuesto equilibrado = 1,   ∂Y/∂ī = −α b,   ∂M/∂G = P k α
```

Casos límite (Modo 1): h → 0 ⇒ ∂Y/∂G → 0 (efecto desplazamiento total); h → ∞ ⇒ ∂Y/∂G → α y ∂Y/∂m → 0; b → 0 ⇒ ∂Y/∂m → 0 y ∂Y/∂G → α.

## 9. Estática comparativa informada por el motor

Para E₀ → E₁ (`src/engine/comparative.ts`):

- **Variaciones**: Δx = x₁ − x₀ y %Δx = Δx/|x₀|·100 (se informa *n/d* cuando x₀ = 0, nunca ±∞).
- **Desplazamiento de la IS a i₀**: Y_IS,1(i₀) − Y_IS,0(i₀). **Desplazamiento de la LM a i₀**: Y_LM,1(i₀) − Y_LM,0(i₀) (Modo 1). Las rotaciones se detectan por cambios de pendiente.
- **Descomposición del producto (exacta)**:
  `ΔY = [Y_IS,1(i₀) − Y₀] + [−α₁ b₁ Δi]`: desplazamiento de la IS a la tasa inicial más el efecto tasa de interés a lo largo de la nueva IS (efecto desplazamiento de la inversión privada cuando una perturbación positiva de demanda eleva i; efecto atracción cuando una perturbación negativa la reduce).
- **Descomposición de la inversión (exacta)**: `ΔI = ΔI₀ − Δb·i₀ − b₁·Δi`.
- **Descomposición de la demanda de dinero (exacta)**: `ΔL = k₁ΔY − h₁Δi + (Δk·Y₀ − Δh·i₀)`, igual a Δ(M/P).

## 10. Reglas de validación

| Gravedad | Condición | Código |
|---|---|---|
| error | cualquier entrada no finita | `NON_FINITE` |
| error | c < 0 o c ≥ 1 | `MPC_OUT_OF_RANGE` |
| error | b < 0 o h < 0 | `NEGATIVE_SENSITIVITY` |
| error | k ≤ 0 | `NON_POSITIVE_K` |
| error | P ≤ 0 | `NON_POSITIVE_PRICE` |
| error | M ≤ 0 (Modo 1) | `NON_POSITIVE_MONEY` |
| error | C₀ < 0, I₀ < 0, G < 0 | `NEGATIVE_AUTONOMOUS`, `NEGATIVE_GOVERNMENT` |
| error | b = h = 0 (Modo 1) | `DEGENERATE_SYSTEM` |
| error | Y* ≤ 0 | `NON_POSITIVE_OUTPUT` |
| error | M* ≤ 0 (Modo 2) | `INFEASIBLE_TARGET` |
| advertencia | i* < 0 (cota inferior no modelada) | `NEGATIVE_RATE` |
| advertencia | I* < 0, C* < 0, Y − T < 0 | `NEGATIVE_INVESTMENT`, `NEGATIVE_CONSUMPTION`, `NEGATIVE_DISPOSABLE_INCOME` |
| advertencia | T < 0 | `NEGATIVE_TAXES` |
| advertencia | c > 0,95 (multiplicador > 20) | `HIGH_MPC` |
| nota | b = 0, h = 0, h ≥ 2000 | `VERTICAL_IS`, `VERTICAL_LM`, `NEAR_LIQUIDITY_TRAP` |

Los errores bloquean el cálculo; las advertencias y notas se muestran junto a resultados válidos. Los controles deslizantes cubren un rango cómodo, pero las entradas numéricas aceptan cualquier valor y se apoyan en estas reglas. Los códigos son identificadores internos; la interfaz muestra los mensajes traducidos.

## 11. Parametrizaciones económicamente poco plausibles

El motor resuelve (con advertencias) varios casos admisibles pero poco plausibles que resultan útiles para la enseñanza: tasas de interés de equilibrio negativas (M muy alta), inversión negativa (b grande con tasas altas), c cercana a 1 (multiplicadores explosivos) y h muy grande (trampa de liquidez). Deben leerse como ilustraciones de la mecánica del modelo, no como descripciones de economías realistas.

## 12. Limitaciones

Ver la sección *Limitaciones* del [README](../README.md#limitaciones).
