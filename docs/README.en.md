# IS-LM | Advanced Macroeconomics Lab

> English summary of the main documentation. The primary documentation and the
> default interface language are **Spanish**: see the [main README](../README.md)
> and the academic notes in [docs/modelos](modelos/README.md).

**Live application:** https://alanartola.github.io/islm-macroeconomic-simulator/?lang=en
(English interface; the default link opens in Spanish and dark mode)
 · **Module A model reference:** [MODEL.en.md](MODEL.en.md)

[![CI & Deploy](https://github.com/alanartola/islm-macroeconomic-simulator/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/alanartola/islm-macroeconomic-simulator/actions/workflows/ci-deploy.yml)

![Traditional IS-LM — fiscal expansion under the money-supply regime (dark theme)](screenshots/en-simulator-fiscal-dark.png)

> **Scope.** Static textbook models with **hypothetical calibrations** chosen for
> teaching clarity. They illustrate theoretical mechanisms through comparative
> statics; they are **not** forecasts or policy advice for any real economy.

## Modules

| | Module | Content |
|---|---|---|
| A | Traditional IS-LM | Linear model with exogenous money supply or an interest-rate target; transmission panels, sensitivity, saved scenarios, KaTeX model reference |
| B | Advanced IS-LM | Proportional taxes and transfers; linear, non-linear (liquidity trap) or lower-bounded LM; LM regions; numerical-method diagnostics |
| C | Curve construction | Seven coordinated charts: Keynesian cross, IS and LM formation, IS and LM in four quadrants, money market, full equilibrium; presentation mode |
| D | Economic policy | Fiscal (G, T₀, t, TR, balanced budget, accommodation) and monetary policy (M, rate, liquidity preference, lower bound), policy-mix matrix and multiplier sensitivity |
| E | Mundell-Fleming | Small open economy with perfect capital mobility; fixed and flexible exchange rates; reserves |
| F | Aggregate supply and demand | AD derived from IS-LM, short-run AS, medium run and an adjustment path with adaptive expectations |
| G | IS-MP and monetary policy | IS, Phillips curve and Taylor rule with an effective lower bound; fixed rate; sensitivity to φπ and φy |
| H | Scenario lab | Save and compare up to four scenarios; comparison charts, sensitivity curves, heat map; CSV, JSON (validated import), PNG/SVG, printable report and links |

Every module explains results on five levels (what changed, transmission
mechanism, equilibrium, mathematics, macroeconomic interpretation) using only
computed values. Results in the scenario lab are always recomputed from the
saved inputs, and only variables with the same definition and unit are
compared across models.

## Exercises, usage guide and observatory

- **Usage guide:** an eight-step walkthrough (choose a model, exogenous and
  endogenous variables, change a parameter, read the equilibrium, interpret
  shifts, compare scenarios, solve exercises, look at real data). It opens on
  the first visit, can be skipped and is reopened from “User guide” in the top bar.
- **Exercises (20):** introductory, intermediate and advanced problems —
  conceptual, multiple choice, numerical, graph reading, curve shifts,
  qualitative prediction, equilibrium, policy comparison, historical analysis and
  real data. Numerical answers are graded against the model engines; each
  exercise has hints, the working, an economic interpretation and a button that
  opens its scenario in the simulator. Progress is stored only in the browser.
- **Macroeconomic observatory:** 50 official series for Argentina and the
  United States (BCRA, INDEC, Ministry of Economy, U.S. Treasury, Federal
  Reserve via FRED, BLS, World Bank) with full metadata; synchronised panels by
  unit; levels, year-on-year changes, base-100 indices and percentage-point
  differences; 21 documented Argentine episodes (2018–2026) and 5 foreign-trade
  milestones, each in four parts (context, decision or shock, evidence,
  interpretation) with verified sources; Argentina's trade balance (INDEC) with
  identity checks; curated news and official notices.
- **Macroeconomic transmission:** the goods market (AD–Y, top right), the
  IS-LM equilibrium (i–Y, bottom right) and the money market (i–M/P, bottom
  left) in one synchronised three-quadrant diagram computed with the Module A
  engine, with 14 policies and shocks, both monetary regimes and a step-by-step
  explanation of each transmission mechanism.
- **One indicator at a time:** the Argentina chart of the observatory shows a
  single indicator chosen from a menu, with both axes named (variable and unit;
  date), events hidden, shown as ticks or studied one at a time, and an optional
  comparison that never puts different units on one axis.
- **Updates:** GitHub Actions downloads and validates the data every business
  day and on every change to `main`; a failing source keeps the last validated
  version, and the site is only deployed when every test passes.
- **Theory vs evidence:** modules A–H are simulations under assumptions; the
  observatory shows published data. A movement after a decision does not prove
  the decision caused it.

![Observatory: Argentina, August 2018](screenshots/observatorio-episodio-oscuro.png)

## Preferences

- **Language:** Spanish on every first visit; English only with `?lang=en` or an
  explicit choice (stored). The browser language is ignored.
- **Theme:** **dark** on every first visit regardless of the operating-system
  setting; an explicit light/dark choice is stored and applied before the first
  paint (no flash). `?theme=` changes a single visit without overwriting it.
- **Level:** educational (essential variables) or advanced (every parameter,
  derivatives and diagnostics).

## Running locally

```bash
git clone https://github.com/alanartola/islm-macroeconomic-simulator.git
cd islm-macroeconomic-simulator
npm ci
npm run dev
```

`npm run validate` runs typecheck, lint, tests and the production build, as in CI.

## Validation

497 automated tests (Vitest) check the engines against hand-derived solutions,
residuals and finite-difference derivatives, the Brent solver, the generated
explanations in both languages, the scenario lab, the exercise answers, the
data pipeline (parsers, validation, fallback, transformations) and the published
data (identities, units, frequencies, metadata), episodes and news, and the
interface defaults (Spanish, dark mode, persistence). GitHub Actions runs every check and deploys
`main` to GitHub Pages only when all of them pass.

## Bibliography

See the verified list in the [main README](../README.md#bibliografía) and in
[docs/modelos](modelos/README.md#bibliografía-verificada).

![Transmission panels (light theme)](screenshots/en-transmission-light.png)
