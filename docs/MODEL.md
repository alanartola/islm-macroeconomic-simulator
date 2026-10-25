# Model reference — IS-LM with two monetary regimes

This document is the technical reference for the engine in `src/engine/`. Every formula below is implemented there and covered by tests in `src/engine/*.test.ts`.

## 1. Assumptions

1. Closed economy: no foreign trade or capital flows.
2. Short run with a fixed price level P (exogenous). No aggregate-supply block, no inflation, no expectations; the nominal and real interest rates coincide.
3. Linear behavioural relations with constant coefficients; lump-sum net taxes T.
4. Two financial assets (money and bonds) and a single interest rate.
5. Comparative statics: equilibria are compared; adjustment paths are not modelled.
6. The default parameters are a **hypothetical** calibration chosen for round, hand-checkable results. They are not estimates of any economy.

## 2. Notation and units

| Symbol | Meaning | Unit | Restriction |
|---|---|---|---|
| Y | output / income | bn per period | endogenous, must be > 0 |
| C, I | consumption, investment | bn | endogenous |
| G, T | government purchases, lump-sum net taxes | bn | G ≥ 0 (T < 0 allowed: net transfers, flagged) |
| C₀, I₀ | autonomous consumption, investment | bn | ≥ 0 |
| c | marginal propensity to consume | — | 0 ≤ c < 1 |
| b | interest sensitivity of investment | bn / pp | ≥ 0 |
| i | interest rate | pp (5 ⇒ 5%) | endogenous (Mode 1) or ī exogenous (Mode 2) |
| M | nominal money stock | bn | > 0 in Mode 1; endogenous in Mode 2 |
| P | price level | index | > 0 |
| k | income sensitivity of money demand | — | > 0 |
| h | interest sensitivity of money demand | bn / pp | ≥ 0 |

Because i is measured in percentage points, b·i and h·i are in bn and all equations are dimensionally homogeneous. Re-expressing i as a decimal requires multiplying b and h by 100; the real allocation is unchanged (tested).

## 3. Structural equations

```
(1) Y = C + I + G
(2) C = C₀ + c (Y − T)
(3) I = I₀ − b i
(4) M/P = k Y − h i
```

## 4. IS curve

Substituting (2)–(3) in (1):

```
Y = C₀ + cY − cT + I₀ − b i + G
(1 − c) Y = A − b i,           A ≡ C₀ − cT + I₀ + G
Y = α (A − b i),               α ≡ 1/(1 − c)
i = [A − (1 − c) Y] / b        (b > 0)
```

- Slope: di/dY = −(1 − c)/b < 0. With b = 0 the IS is vertical at Y = αA.
- A change ΔA shifts the IS horizontally by αΔA at any rate.
- Changes in b or c **rotate** the IS around its intercept at i = 0 (Y = αA; c also moves this intercept).

## 5. LM curve

With m ≡ M/P:

```
m = k Y − h i
Y = (m + h i)/k
i = (k Y − m)/h                (h > 0)
```

- Slope: di/dY = k/h > 0. With h = 0 the LM is vertical at Y = m/k (classical case); as h → ∞ it becomes horizontal (liquidity trap).
- A change Δm shifts the LM horizontally by Δm/k; changes in k or h rotate it.

## 6. Equilibrium — Mode 1 (money supply exogenous)

Solving the IS and LM equations:

```
D  ≡ h (1 − c) + b k
Y* = (h A + b m) / D
i* = (k A − (1 − c) m) / D
```

D > 0 whenever b > 0 or h > 0; D = 0 only when b = h = 0 (both curves vertical, equilibrium undetermined) and that case is rejected.

**Default calibration:** C₀ = 200, c = 0.75, T = 200, I₀ = 300, b = 25, G = 250, M = 700, P = 1, k = 0.5, h = 50:

```
A = 200 − 150 + 300 + 250 = 600,  m = 700,  D = 12.5 + 12.5 = 25
Y* = (50·600 + 25·700)/25 = 1900,   i* = (0.5·600 − 0.25·700)/25 = 5
C = 1475, I = 175, S_p = 225, S_g = −50, S = 175 = I
```

## 7. Equilibrium — Mode 2 (interest-rate target)

The central bank sets i = ī and supplies the money demanded at that rate. The LM curve is the horizontal line i = ī.

```
Y* = α (A − b ī)
M* = P (k Y* − h ī)          (must be > 0, otherwise the target is infeasible)
```

M is endogenous; the M parameter is ignored. Pegging ī at the Mode 1 equilibrium rate reproduces the Mode 1 equilibrium exactly (tested).

## 8. Multipliers

Mode 1 (differentiating the reduced form):

```
∂Y/∂G = ∂Y/∂I₀ = ∂Y/∂C₀ = h/D           ∂i/∂G = k/D
∂Y/∂T = −c h/D                          ∂i/∂T = −c k/D
∂Y/∂m = b/D                             ∂i/∂m = −(1 − c)/D
balanced budget (dT = dG): (1 − c) h/D
crowding-out share: 1 − (h/D)/α = b k / D
```

Mode 2:

```
∂Y/∂G = α,   ∂Y/∂T = −c α,   balanced budget = 1,   ∂Y/∂ī = −α b,   ∂M/∂G = P k α
```

Limiting cases (Mode 1): h → 0 ⇒ ∂Y/∂G → 0 (full crowding out); h → ∞ ⇒ ∂Y/∂G → α and ∂Y/∂m → 0; b → 0 ⇒ ∂Y/∂m → 0 and ∂Y/∂G → α.

## 9. Comparative statics reported by the engine

For E₀ → E₁ (`src/engine/comparative.ts`):

- **Changes**: Δx = x₁ − x₀ and %Δx = Δx/|x₀|·100 (reported as *n/a* when x₀ = 0, never ±∞).
- **IS shift at i₀**: Y_IS,1(i₀) − Y_IS,0(i₀). **LM shift at i₀**: Y_LM,1(i₀) − Y_LM,0(i₀) (Mode 1). Rotations are detected from slope changes.
- **Output decomposition (exact)**:
  `ΔY = [Y_IS,1(i₀) − Y₀] + [−α₁ b₁ Δi]` — IS displacement at the initial rate plus the interest-rate effect along the new IS (crowding out when positive demand shocks raise i; crowding in when negative shocks lower it).
- **Investment decomposition (exact)**: `ΔI = ΔI₀ − Δb·i₀ − b₁·Δi`.
- **Money-demand decomposition (exact)**: `ΔL = k₁ΔY − h₁Δi + (Δk·Y₀ − Δh·i₀)`, which equals Δ(M/P).

## 10. Validation rules

| Severity | Condition | Code |
|---|---|---|
| error | any non-finite input | `NON_FINITE` |
| error | c < 0 or c ≥ 1 | `MPC_OUT_OF_RANGE` |
| error | b < 0 or h < 0 | `NEGATIVE_SENSITIVITY` |
| error | k ≤ 0 | `NON_POSITIVE_K` |
| error | P ≤ 0 | `NON_POSITIVE_PRICE` |
| error | M ≤ 0 (Mode 1) | `NON_POSITIVE_MONEY` |
| error | C₀ < 0, I₀ < 0, G < 0 | `NEGATIVE_AUTONOMOUS`, `NEGATIVE_GOVERNMENT` |
| error | b = h = 0 (Mode 1) | `DEGENERATE_SYSTEM` |
| error | Y* ≤ 0 | `NON_POSITIVE_OUTPUT` |
| error | M* ≤ 0 (Mode 2) | `INFEASIBLE_TARGET` |
| warning | i* < 0 (lower bound not modelled) | `NEGATIVE_RATE` |
| warning | I* < 0, C* < 0, Y − T < 0 | `NEGATIVE_INVESTMENT`, `NEGATIVE_CONSUMPTION`, `NEGATIVE_DISPOSABLE_INCOME` |
| warning | T < 0 | `NEGATIVE_TAXES` |
| warning | c > 0.95 (multiplier > 20) | `HIGH_MPC` |
| info | b = 0, h = 0, h ≥ 2000 | `VERTICAL_IS`, `VERTICAL_LM`, `NEAR_LIQUIDITY_TRAP` |

Errors block the computation; warnings and notes are displayed alongside valid results. The UI sliders cover a convenient range, but numeric inputs accept any value and rely on these rules.

## 11. Economically implausible parametrisations

The engine solves (with warnings) several admissible but implausible cases that are useful pedagogically: negative equilibrium interest rates (very large M), negative investment (large b with high rates), c close to 1 (explosive multipliers) and very large h (liquidity trap). They should be read as illustrations of the model's mechanics, not as descriptions of realistic economies.

## 12. Limitations

See the *Limitations* section of the [README](../README.md#limitations).
