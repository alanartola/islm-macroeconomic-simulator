import { DEFAULT_PARAMS, solve, type ModelParams, type PolicyRegime, type SolvedEconomy } from '../engine';
import { ADV_DEFAULTS, solveAdvanced } from '../engine/advanced';
import { OPEN_DEFAULTS, solveOpen, type OpenParams } from '../engine/open/mundellFleming';
import { ADAS_DEFAULTS, solveADAS } from '../engine/adas/adas';
import { ISMP_DEFAULTS, solveISMP, type ISMPParams, type MPRegime } from '../engine/ismp/ismp';
import { formatAs } from '../i18n/format';
import { beforeAfter, tradeRows, type Lang2, type SeriesFile } from '../data/core';
import type { LabConfig } from '../lab/scenario';

/**
 * Exercise bank. Answers of model exercises are computed with the same
 * engines as the simulator; answers of real-data exercises are computed from
 * the published series when the exercise is opened. Nothing is typed by hand
 * except conceptual multiple-choice keys.
 */
export type ExLevel = 'inicial' | 'intermedio' | 'avanzado';
export type ExType = 'concept' | 'choice' | 'numeric' | 'graph' | 'shift' | 'prediction' | 'equilibrium' | 'policy' | 'history' | 'data';

export interface Option {
  id: string;
  label: Lang2;
}

export type Question =
  | { id: string; kind: 'choice'; prompt: Lang2; options: Option[]; answer: string }
  | { id: string; kind: 'number'; prompt: Lang2; answer: number; tolerance: number; unit: Lang2 }
  | { id: string; kind: 'classify'; prompt: Lang2; statements: { id: string; text: Lang2; answer: 'obs' | 'hyp' | 'int' }[] };

export interface ExerciseContent {
  data: Lang2[];
  questions: Question[];
  steps: Lang2[];
  interpretation: Lang2;
}

export interface Exercise {
  id: string;
  level: ExLevel;
  types: ExType[];
  topic: 'closed' | 'open' | 'prices' | 'data';
  title: Lang2;
  statement: Lang2;
  objective: Lang2;
  hints: Lang2[];
  /** Static content (model exercises). */
  content?: ExerciseContent;
  /** Real-data exercises: series needed and builder run with the loaded files. */
  dataSeries?: string[];
  build?: (files: Record<string, SeriesFile>) => ExerciseContent | null;
  /** Scenario that reproduces the exercise in a module. */
  config?: LabConfig;
  /** Episode or date to open in the observatory. */
  observatory?: { date: string; episode?: string };
  /** Exercise that shows a chart of the configuration (graph interpretation). */
  graph?: boolean;
}

type F = (x: number, fmt: string) => string;
const L = (es: string, en: string): Lang2 => ({ es, en });
/** Builds a bilingual text whose numbers are formatted in each language. */
const T = (es: (n: F) => string, en: (n: F) => string): Lang2 => ({ es: es((x, f) => formatAs('es', x, f)), en: en((x, f) => formatAs('en', x, f)) });

const UP = L('Sube', 'Rises');
const DOWN = L('Baja', 'Falls');
const SAME = L('No cambia', 'Unchanged');
const dir = (x: number, tol = 1e-9) => (x > tol ? 'up' : x < -tol ? 'down' : 'none');
const dirQ = (id: string, prompt: Lang2, answer: string): Question => ({
  id,
  kind: 'choice',
  prompt,
  options: [
    { id: 'up', label: UP },
    { id: 'down', label: DOWN },
    { id: 'none', label: SAME },
  ],
  answer,
});
const num = (id: string, prompt: Lang2, answer: number, unit: Lang2, tolerance?: number): Question => ({
  id,
  kind: 'number',
  prompt,
  answer,
  unit,
  tolerance: tolerance ?? Math.max(0.01, Math.abs(answer) * 0.005),
});
const BN = L('mil M', 'bn');
const PP = L('pp', 'pp');
const PCT = L('%', '%');

function basic(params: Partial<ModelParams>, regime: PolicyRegime = 'money-supply', target = 5): SolvedEconomy {
  const r = solve({ params: { ...DEFAULT_PARAMS, ...params }, regime, targetRate: target });
  if (!r.ok) throw new Error('exercise configuration has no solution');
  return r.value;
}
const basicConfig = (shocked: Partial<ModelParams>, regime: PolicyRegime = 'money-supply'): LabConfig => ({ model: 'basic', baseline: { ...DEFAULT_PARAMS }, shocked: { ...DEFAULT_PARAMS, ...shocked }, regime, target0: 5, target1: 5 });
const DATA_A = T(
  (n) => `IS-LM tradicional: C₀ = ${n(200, 'n0')}, c = ${n(0.75, 'n2')}, T = ${n(200, 'n0')}, I₀ = ${n(300, 'n0')}, b = ${n(25, 'n0')}, G = ${n(250, 'n0')}, M = ${n(700, 'n0')}, P = 1, k = ${n(0.5, 'n1')}, h = ${n(50, 'n0')} (oferta monetaria exógena).`,
  (n) => `Traditional IS-LM: C₀ = ${n(200, 'n0')}, c = ${n(0.75, 'n2')}, T = ${n(200, 'n0')}, I₀ = ${n(300, 'n0')}, b = ${n(25, 'n0')}, G = ${n(250, 'n0')}, M = ${n(700, 'n0')}, P = 1, k = ${n(0.5, 'n1')}, h = ${n(50, 'n0')} (exogenous money supply).`,
);
const shiftQ = (answer: 'IS' | 'LM' | 'both' | 'none'): Question => ({
  id: 'curve',
  kind: 'choice',
  prompt: L('¿Qué curva se desplaza?', 'Which curve shifts?'),
  options: [
    { id: 'IS', label: L('La IS', 'The IS') },
    { id: 'LM', label: L('La LM', 'The LM') },
    { id: 'both', label: L('Ambas', 'Both') },
    { id: 'none', label: L('Ninguna', 'Neither') },
  ],
  answer,
});
const sideQ = (answer: 'right' | 'left'): Question => ({
  id: 'side',
  kind: 'choice',
  prompt: L('¿En qué dirección?', 'In which direction?'),
  options: [
    { id: 'right', label: L('Hacia la derecha', 'To the right') },
    { id: 'left', label: L('Hacia la izquierda', 'To the left') },
  ],
  answer,
});

function buildBank(): Exercise[] {
  const e0 = basic({});
  const q0 = e0.equilibrium;
  // ── Inicial ──────────────────────────────────────────────────────────────
  const m10 = basic({ M: 770 });
  const g50 = basic({ G: 300 });
  const t50 = basic({ T: 150 });
  const i0Down = basic({ I0: 250 });
  // ── Intermedio ───────────────────────────────────────────────────────────
  const g40 = basic({ G: 290 });
  const m20 = basic({ M: 840 });
  const gTarget = basic({ G: 300 }, 'interest-target');
  const openFlex0 = solveOpen({ params: OPEN_DEFAULTS, regime: 'flexible' });
  const openFlexG = solveOpen({ params: { ...OPEN_DEFAULTS, G: OPEN_DEFAULTS.G + 50 }, regime: 'flexible' });
  const openFix0 = solveOpen({ params: OPEN_DEFAULTS, regime: 'fixed' });
  const openFixD = solveOpen({ params: { ...OPEN_DEFAULTS, D: OPEN_DEFAULTS.D + 100 }, regime: 'fixed' });
  const openFlexI = solveOpen({ params: { ...OPEN_DEFAULTS, iStar: OPEN_DEFAULTS.iStar + 1 }, regime: 'flexible' });
  const ad0 = solveADAS(ADAS_DEFAULTS);
  const adM = solveADAS({ ...ADAS_DEFAULTS, M: ADAS_DEFAULTS.M + 100 });
  // ── Avanzado ─────────────────────────────────────────────────────────────
  const trap0 = solveAdvanced({ params: { ...ADV_DEFAULTS, M: 1600 }, lm: 'nonlinear', regime: 'money', targetRate: 5 });
  const trap1 = solveAdvanced({ params: { ...ADV_DEFAULTS, M: 1800 }, lm: 'nonlinear', regime: 'money', targetRate: 5 });
  const ismp = (p: Partial<ISMPParams>, regime: MPRegime = 'rule') => {
    const r = solveISMP({ params: { ...ISMP_DEFAULTS, ...p }, regime });
    if (!r.ok) throw new Error('exercise configuration has no solution');
    return r.value;
  };
  const sD = ismp({ d: 2 });
  const sURule = ismp({ u: 1 });
  const sUPeg = ismp({ u: 1 }, 'peg');
  const sElb = ismp({ d: -10 });
  if (!openFlex0.ok || !openFlexG.ok || !openFix0.ok || !openFixD.ok || !openFlexI.ok || !ad0.ok || !adM.ok || !trap0.ok || !trap1.ok) throw new Error('exercise configuration has no solution');
  const OF0 = openFlex0.value.equilibrium;
  const OFG = openFlexG.value.equilibrium;
  const OX0 = openFix0.value.equilibrium;
  const OXD = openFixD.value.equilibrium;
  const OFI = openFlexI.value.equilibrium;
  const openConfig = (p: Partial<OpenParams>, regime: 'flexible' | 'fixed'): LabConfig => ({ model: 'open', baseline: { ...OPEN_DEFAULTS }, shocked: { ...OPEN_DEFAULTS, ...p }, regime });

  return [
    {
      id: 'ini-monetaria-10',
      level: 'inicial',
      types: ['shift', 'prediction'],
      topic: 'closed',
      title: L('Política monetaria: aumento de la oferta de dinero', 'Monetary policy: higher money supply'),
      statement: L('El Banco Central incrementa la oferta monetaria en un 10%, manteniéndose constantes los restantes parámetros de un modelo IS-LM tradicional.', 'The central bank raises the money supply by 10%, all other parameters of a traditional IS-LM model held constant.'),
      objective: L('Identificar el desplazamiento y predecir el signo de los efectos.', 'Identify the shift and predict the sign of the effects.'),
      hints: [L('El dinero entra en el equilibrio del mercado monetario: M/P = kY − h·i.', 'Money enters the money-market equilibrium: M/P = kY − h·i.'), L('Con más saldos reales, ¿qué tasa equilibra el mercado de dinero para un mismo Y?', 'With more real balances, which rate clears the money market for the same Y?')],
      content: {
        data: [DATA_A, T((n) => `Shock: M pasa de ${n(700, 'n0')} a ${n(770, 'n0')} (+10%).`, (n) => `Shock: M rises from ${n(700, 'n0')} to ${n(770, 'n0')} (+10%).`)],
        questions: [shiftQ('LM'), sideQ('right'), dirQ('i', L('¿Qué ocurre con la tasa de interés?', 'What happens to the interest rate?'), dir(m10.equilibrium.i - q0.i)), dirQ('inv', L('¿Qué sucede con la inversión?', 'What happens to investment?'), dir(m10.equilibrium.I - q0.I)), dirQ('Y', L('¿Cómo cambia el producto de equilibrio?', 'How does equilibrium output change?'), dir(m10.equilibrium.Y - q0.Y))],
        steps: [
          T((n) => `La LM es M/P = kY − h·i: con M = ${n(770, 'n0')} se desplaza a la derecha en ΔM/(kP) = ${n(140, 'n0')}.`, (n) => `The LM is M/P = kY − h·i: with M = ${n(770, 'n0')} it shifts right by ΔM/(kP) = ${n(140, 'n0')}.`),
          T((n) => `Nuevo equilibrio: Y = ${n(m10.equilibrium.Y, 'n1')}, i = ${n(m10.equilibrium.i, 'n2')}%, I = ${n(m10.equilibrium.I, 'n1')}.`, (n) => `New equilibrium: Y = ${n(m10.equilibrium.Y, 'n1')}, i = ${n(m10.equilibrium.i, 'n2')}%, I = ${n(m10.equilibrium.I, 'n1')}.`),
          T((n) => `Variaciones: ΔY = ${n(m10.equilibrium.Y - q0.Y, 'sn1')}, Δi = ${n(m10.equilibrium.i - q0.i, 'sn2')} pp, ΔI = ${n(m10.equilibrium.I - q0.I, 'sn1')}.`, (n) => `Changes: ΔY = ${n(m10.equilibrium.Y - q0.Y, 'sn1')}, Δi = ${n(m10.equilibrium.i - q0.i, 'sn2')} pp, ΔI = ${n(m10.equilibrium.I - q0.I, 'sn1')}.`),
        ],
        interpretation: L('El exceso de oferta de dinero baja la tasa; la menor tasa estimula la inversión y, por el multiplicador, el producto. Es un movimiento a lo largo de la IS.', 'Excess money supply lowers the rate; the lower rate stimulates investment and, through the multiplier, output. It is a movement along the IS.'),
      },
      config: basicConfig({ M: 770 }),
    },
    {
      id: 'ini-fiscal-g',
      level: 'inicial',
      types: ['shift', 'prediction'],
      topic: 'closed',
      title: L('Política fiscal: más gasto público', 'Fiscal policy: more government spending'),
      statement: L('El gobierno aumenta el gasto público de 250 a 300 mil M, con oferta monetaria constante.', 'The government raises spending from 250 to 300 bn, with a constant money supply.'),
      objective: L('Predecir los efectos y reconocer el efecto desplazamiento.', 'Predict the effects and recognise crowding out.'),
      hints: [L('El gasto público es parte del gasto autónomo de la IS.', 'Government spending is part of the IS autonomous spending.')],
      content: {
        data: [DATA_A],
        questions: [shiftQ('IS'), sideQ('right'), dirQ('i', L('¿Qué ocurre con la tasa de interés?', 'What happens to the interest rate?'), dir(g50.equilibrium.i - q0.i)), dirQ('inv', L('¿Qué sucede con la inversión privada?', 'What happens to private investment?'), dir(g50.equilibrium.I - q0.I)), dirQ('Y', L('¿Y el producto?', 'And output?'), dir(g50.equilibrium.Y - q0.Y))],
        steps: [
          T((n) => `A tasa constante el producto subiría α·ΔG = 4 × 50 = ${n(200, 'n0')}.`, (n) => `At a constant rate output would rise α·ΔG = 4 × 50 = ${n(200, 'n0')}.`),
          T((n) => `Con M fija la tasa sube ${n(g50.equilibrium.i - q0.i, 'n2')} pp y la inversión cae ${n(q0.I - g50.equilibrium.I, 'n1')}: el producto sube ${n(g50.equilibrium.Y - q0.Y, 'n1')}.`, (n) => `With fixed M the rate rises ${n(g50.equilibrium.i - q0.i, 'n2')} pp and investment falls ${n(q0.I - g50.equilibrium.I, 'n1')}: output rises ${n(g50.equilibrium.Y - q0.Y, 'n1')}.`),
        ],
        interpretation: L('La mayor demanda de dinero transaccional eleva la tasa y desplaza parte de la inversión privada (crowding out).', 'Higher transactions demand for money raises the rate and crowds out part of private investment.'),
      },
      config: basicConfig({ G: 300 }),
    },
    {
      id: 'ini-endogenas',
      level: 'inicial',
      types: ['concept', 'choice'],
      topic: 'closed',
      title: L('Variables exógenas y endógenas', 'Exogenous and endogenous variables'),
      statement: L('En el IS-LM tradicional con oferta monetaria exógena, el modelo determina algunas variables a partir de otras dadas.', 'In the traditional IS-LM with an exogenous money supply, the model determines some variables from others that are given.'),
      objective: L('Distinguir variables exógenas y endógenas.', 'Distinguish exogenous and endogenous variables.'),
      hints: [L('Exógena: se fija fuera del modelo (políticas, parámetros). Endógena: la resuelve el equilibrio.', 'Exogenous: set outside the model (policies, parameters). Endogenous: solved by the equilibrium.')],
      content: {
        data: [],
        questions: [
          {
            id: 'endo',
            kind: 'choice',
            prompt: L('¿Cuáles son endógenas?', 'Which are endogenous?'),
            options: [
              { id: 'yi', label: L('El producto Y y la tasa de interés i', 'Output Y and the interest rate i') },
              { id: 'mg', label: L('La oferta monetaria M y el gasto G', 'Money supply M and spending G') },
              { id: 'ci', label: L('El consumo autónomo C₀ y la inversión autónoma I₀', 'Autonomous consumption C₀ and investment I₀') },
              { id: 'im', label: L('La tasa i y la oferta monetaria M', 'The rate i and the money supply M') },
            ],
            answer: 'yi',
          },
          {
            id: 'target',
            kind: 'choice',
            prompt: L('Si el banco central fija la tasa (régimen de objetivo de tasa), ¿qué variable pasa a ser endógena?', 'If the central bank fixes the rate (interest-target regime), which variable becomes endogenous?'),
            options: [
              { id: 'm', label: L('La cantidad de dinero M', 'The quantity of money M') },
              { id: 'g', label: L('El gasto público G', 'Government spending G') },
              { id: 'c', label: L('La propensión a consumir c', 'The propensity to consume c') },
            ],
            answer: 'm',
          },
        ],
        steps: [L('Y e i resuelven simultáneamente IS y LM; M, G, T y los parámetros son datos.', 'Y and i jointly solve IS and LM; M, G, T and the parameters are given.'), L('Con tasa fija, la LM es horizontal e i es dato: M se ajusta para que M/P = kY − h·ī.', 'With a fixed rate the LM is horizontal and i is given: M adjusts so that M/P = kY − h·ī.')],
        interpretation: L('El régimen monetario define qué es instrumento y qué es resultado.', 'The monetary regime defines what is an instrument and what is an outcome.'),
      },
    },
    {
      id: 'ini-impuestos',
      level: 'inicial',
      types: ['prediction', 'policy'],
      topic: 'closed',
      title: L('Rebaja de impuestos frente a más gasto', 'Tax cut versus more spending'),
      statement: L('Se compara una rebaja de impuestos de 50 mil M (T de 200 a 150) con un aumento del gasto de la misma magnitud.', 'A 50 bn tax cut (T from 200 to 150) is compared with a spending increase of the same size.'),
      objective: L('Comparar multiplicadores de política fiscal.', 'Compare fiscal-policy multipliers.'),
      hints: [L('Una parte de la rebaja impositiva se ahorra: el consumo aumenta c·ΔT.', 'Part of the tax cut is saved: consumption rises by c·ΔT.')],
      content: {
        data: [DATA_A],
        questions: [
          dirQ('Y', L('Con la rebaja de impuestos, el producto…', 'With the tax cut, output…'), dir(t50.equilibrium.Y - q0.Y)),
          {
            id: 'cmp',
            kind: 'choice',
            prompt: L('¿Qué medida aumenta más el producto?', 'Which measure raises output more?'),
            options: [
              { id: 'g', label: L('El aumento del gasto', 'The spending increase') },
              { id: 't', label: L('La rebaja de impuestos', 'The tax cut') },
              { id: 'eq', label: L('Ambas por igual', 'Both equally') },
            ],
            answer: g50.equilibrium.Y > t50.equilibrium.Y + 1e-9 ? 'g' : t50.equilibrium.Y > g50.equilibrium.Y + 1e-9 ? 't' : 'eq',
          },
        ],
        steps: [T((n) => `ΔY con ΔG = +50: ${n(g50.equilibrium.Y - q0.Y, 'sn1')}; ΔY con ΔT = −50: ${n(t50.equilibrium.Y - q0.Y, 'sn1')}.`, (n) => `ΔY with ΔG = +50: ${n(g50.equilibrium.Y - q0.Y, 'sn1')}; ΔY with ΔT = −50: ${n(t50.equilibrium.Y - q0.Y, 'sn1')}.`)],
        interpretation: L('El gasto entra completo en la demanda; la rebaja de impuestos solo en la fracción c que se consume.', 'Spending enters demand in full; a tax cut only in the fraction c that is consumed.'),
      },
      config: basicConfig({ T: 150 }),
    },
    {
      id: 'ini-grafico',
      level: 'inicial',
      types: ['graph'],
      topic: 'closed',
      title: L('Interpretar un gráfico IS-LM', 'Reading an IS-LM chart'),
      statement: L('El gráfico muestra las curvas iniciales (discontinuas) y finales (continuas) tras una perturbación.', 'The chart shows initial (dashed) and final (solid) curves after a shock.'),
      objective: L('Deducir la perturbación a partir del desplazamiento de las curvas.', 'Infer the shock from the shift of the curves.'),
      hints: [L('Observá qué curva cambió y hacia dónde.', 'Look at which curve changed and where.')],
      graph: true,
      content: {
        data: [DATA_A],
        questions: [
          {
            id: 'shock',
            kind: 'choice',
            prompt: L('¿Qué perturbación produjo el cambio?', 'Which shock produced the change?'),
            options: [
              { id: 'm_up', label: L('Aumento de la oferta monetaria', 'Higher money supply') },
              { id: 'm_down', label: L('Reducción de la oferta monetaria', 'Lower money supply') },
              { id: 'g_up', label: L('Aumento del gasto público', 'Higher government spending') },
              { id: 'i_down', label: L('Caída de la inversión autónoma', 'Fall in autonomous investment') },
            ],
            answer: 'i_down',
          },
          dirQ('i', L('¿Qué ocurrió con la tasa de interés?', 'What happened to the interest rate?'), dir(i0Down.equilibrium.i - q0.i)),
        ],
        steps: [T((n) => `La IS se desplazó a la izquierda: I₀ cayó de ${n(300, 'n0')} a ${n(250, 'n0')}. Y pasa de ${n(q0.Y, 'n1')} a ${n(i0Down.equilibrium.Y, 'n1')} e i de ${n(q0.i, 'n2')}% a ${n(i0Down.equilibrium.i, 'n2')}%.`, (n) => `The IS shifted left: I₀ fell from ${n(300, 'n0')} to ${n(250, 'n0')}. Y goes from ${n(q0.Y, 'n1')} to ${n(i0Down.equilibrium.Y, 'n1')} and i from ${n(q0.i, 'n2')}% to ${n(i0Down.equilibrium.i, 'n2')}%.`)],
        interpretation: L('La menor demanda reduce el producto y la demanda de dinero; la tasa baja y amortigua parte de la caída.', 'Lower demand reduces output and money demand; the rate falls and cushions part of the drop.'),
      },
      config: basicConfig({ I0: 250 }),
    },
    {
      id: 'ini-identidad-comercial',
      level: 'inicial',
      types: ['numeric', 'concept'],
      topic: 'open',
      title: L('Balanza comercial: identidades', 'Trade balance: identities'),
      statement: L('Un país exporta bienes por 8.000 e importa por 6.500 (millones de dólares) en un mes.', 'A country exports goods worth 8,000 and imports 6,500 (US$ millions) in a month.'),
      objective: L('Aplicar BC = X − M e IC = X + M.', 'Apply BC = X − M and IC = X + M.'),
      hints: [L('El saldo resta; el intercambio suma.', 'The balance subtracts; turnover adds.')],
      content: {
        data: [L('X = 8.000; M = 6.500 (millones de US$).', 'X = 8,000; M = 6,500 (US$ millions).')],
        questions: [
          num('bc', L('Saldo comercial BC', 'Trade balance BC'), 1500, L('millones de US$', 'US$ millions'), 0.5),
          num('ic', L('Intercambio comercial IC', 'Trade turnover IC'), 14500, L('millones de US$', 'US$ millions'), 0.5),
          {
            id: 'welfare',
            kind: 'choice',
            prompt: L('¿Un superávit implica necesariamente que la economía crece?', 'Does a surplus necessarily mean the economy is growing?'),
            options: [
              { id: 'no', label: L('No: puede reflejar menores importaciones por recesión', 'No: it may reflect lower imports due to recession') },
              { id: 'yes', label: L('Sí: siempre indica crecimiento', 'Yes: it always signals growth') },
            ],
            answer: 'no',
          },
        ],
        steps: [L('BC = 8.000 − 6.500 = 1.500; IC = 8.000 + 6.500 = 14.500.', 'BC = 8,000 − 6,500 = 1,500; IC = 8,000 + 6,500 = 14,500.')],
        interpretation: L('El saldo resume dos flujos con determinantes distintos.', 'The balance summarises two flows with different drivers.'),
      },
    },
    // ── Intermedio ─────────────────────────────────────────────────────────
    {
      id: 'int-fiscal-numerico',
      level: 'intermedio',
      types: ['numeric', 'equilibrium'],
      topic: 'closed',
      title: L('Nuevo equilibrio tras una expansión fiscal', 'New equilibrium after a fiscal expansion'),
      statement: L('El gasto público aumenta de 250 a 290 mil M con oferta monetaria constante.', 'Government spending rises from 250 to 290 bn with a constant money supply.'),
      objective: L('Calcular el nuevo equilibrio, el multiplicador y el desplazamiento de la inversión.', 'Compute the new equilibrium, the multiplier and crowding out.'),
      hints: [L('Y* = (h·A + b·m)/D, i* = (k·A − (1 − c)·m)/D, con D = h(1 − c) + b·k.', 'Y* = (h·A + b·m)/D, i* = (k·A − (1 − c)·m)/D, with D = h(1 − c) + b·k.'), L('El multiplicador fiscal con M fija es h/D.', 'The fiscal multiplier with fixed M is h/D.')],
      content: {
        data: [DATA_A, L('Perturbación: G = 290.', 'Shock: G = 290.')],
        questions: [
          num('Y1', L('Producto de equilibrio Y₁', 'Equilibrium output Y₁'), g40.equilibrium.Y, BN),
          num('dY', L('Variación del producto ΔY', 'Change in output ΔY'), g40.equilibrium.Y - q0.Y, BN),
          num('di', L('Variación de la tasa Δi', 'Change in the rate Δi'), g40.equilibrium.i - q0.i, PP, 0.01),
          num('mult', L('Multiplicador fiscal dY/dG', 'Fiscal multiplier dY/dG'), g40.multipliers.dY_dG, L('', ''), 0.01),
          num('dI', L('Variación de la inversión privada ΔI', 'Change in private investment ΔI'), g40.equilibrium.I - q0.I, BN),
        ],
        steps: [
          T((n) => `A₁ = C₀ − cT + I₀ + G = ${n(g40.equilibrium.A, 'n1')}; D = 50 × 0,25 + 25 × 0,5 = ${n(25, 'n1')}.`, (n) => `A₁ = C₀ − cT + I₀ + G = ${n(g40.equilibrium.A, 'n1')}; D = 50 × 0.25 + 25 × 0.5 = ${n(25, 'n1')}.`),
          T((n) => `Y₁ = (50 × ${n(g40.equilibrium.A, 'n1')} + 25 × 700)/25 = ${n(g40.equilibrium.Y, 'n1')}; i₁ = (0,5 × ${n(g40.equilibrium.A, 'n1')} − 0,25 × 700)/25 = ${n(g40.equilibrium.i, 'n2')}%.`, (n) => `Y₁ = (50 × ${n(g40.equilibrium.A, 'n1')} + 25 × 700)/25 = ${n(g40.equilibrium.Y, 'n1')}; i₁ = (0.5 × ${n(g40.equilibrium.A, 'n1')} − 0.25 × 700)/25 = ${n(g40.equilibrium.i, 'n2')}%.`),
          T((n) => `dY/dG = h/D = 50/25 = ${n(g40.multipliers.dY_dG, 'n2')}; ΔI = −b·Δi = ${n(g40.equilibrium.I - q0.I, 'sn1')}.`, (n) => `dY/dG = h/D = 50/25 = ${n(g40.multipliers.dY_dG, 'n2')}; ΔI = −b·Δi = ${n(g40.equilibrium.I - q0.I, 'sn1')}.`),
        ],
        interpretation: T((n) => `Sin desplazamiento el producto subiría 4 × 40 = 160; sube ${n(g40.equilibrium.Y - q0.Y, 'n1')}: la mitad se pierde por la suba de la tasa.`, (n) => `Without crowding out output would rise 4 × 40 = 160; it rises ${n(g40.equilibrium.Y - q0.Y, 'n1')}: half is lost through the higher rate.`),
      },
      config: basicConfig({ G: 290 }),
    },
    {
      id: 'int-monetario-numerico',
      level: 'intermedio',
      types: ['numeric', 'equilibrium'],
      topic: 'closed',
      title: L('Expansión monetaria del 20%', 'A 20% monetary expansion'),
      statement: L('La oferta monetaria pasa de 700 a 840 mil M.', 'The money supply rises from 700 to 840 bn.'),
      objective: L('Calcular el nuevo equilibrio.', 'Compute the new equilibrium.'),
      hints: [L('dY/d(M/P) = b/D y di/d(M/P) = −(1 − c)/D.', 'dY/d(M/P) = b/D and di/d(M/P) = −(1 − c)/D.')],
      content: {
        data: [DATA_A, L('Perturbación: M = 840.', 'Shock: M = 840.')],
        questions: [num('Y1', L('Producto Y₁', 'Output Y₁'), m20.equilibrium.Y, BN), num('i1', L('Tasa de interés i₁', 'Interest rate i₁'), m20.equilibrium.i, PCT, 0.01), num('dI', L('ΔI', 'ΔI'), m20.equilibrium.I - q0.I, BN)],
        steps: [T((n) => `Δm = 140: ΔY = (25/25) × 140 = ${n(m20.equilibrium.Y - q0.Y, 'n1')}; Δi = −(0,25/25) × 140 = ${n(m20.equilibrium.i - q0.i, 'sn2')} pp.`, (n) => `Δm = 140: ΔY = (25/25) × 140 = ${n(m20.equilibrium.Y - q0.Y, 'n1')}; Δi = −(0.25/25) × 140 = ${n(m20.equilibrium.i - q0.i, 'sn2')} pp.`)],
        interpretation: L('La tasa baja y la inversión responde según b; el producto aumenta por el multiplicador.', 'The rate falls and investment responds through b; output rises through the multiplier.'),
      },
      config: basicConfig({ M: 840 }),
    },
    {
      id: 'int-regimen-tasa',
      level: 'intermedio',
      types: ['policy', 'numeric'],
      topic: 'closed',
      title: L('Política fiscal con tasa fija', 'Fiscal policy with a fixed rate'),
      statement: L('El banco central mantiene la tasa en 5% y el gasto público sube de 250 a 300.', 'The central bank holds the rate at 5% and spending rises from 250 to 300.'),
      objective: L('Comparar regímenes monetarios.', 'Compare monetary regimes.'),
      hints: [L('Con tasa fija no hay efecto desplazamiento: la LM es horizontal.', 'With a fixed rate there is no crowding out: the LM is horizontal.')],
      content: {
        data: [DATA_A, L('Régimen: objetivo de tasa ī = 5%.', 'Regime: interest-rate target ī = 5%.')],
        questions: [
          num('dY', L('Variación del producto ΔY', 'Change in output ΔY'), gTarget.equilibrium.Y - q0.Y, BN),
          num('M', L('Cantidad de dinero que debe proveer el banco central M₁', 'Money the central bank must supply M₁'), gTarget.equilibrium.M, BN),
          {
            id: 'cmp',
            kind: 'choice',
            prompt: L('¿El multiplicador fiscal es mayor con tasa fija o con oferta monetaria fija?', 'Is the fiscal multiplier larger with a fixed rate or a fixed money supply?'),
            options: [
              { id: 'rate', label: L('Con tasa fija', 'With a fixed rate') },
              { id: 'money', label: L('Con oferta monetaria fija', 'With a fixed money supply') },
            ],
            answer: gTarget.multipliers.dY_dG > g50.multipliers.dY_dG ? 'rate' : 'money',
          },
        ],
        steps: [T((n) => `Y₁ = α(A − b·ī) = 4 × (650 − 125) = ${n(gTarget.equilibrium.Y, 'n1')}; M₁ = P(kY₁ − h·ī) = ${n(gTarget.equilibrium.M, 'n1')}.`, (n) => `Y₁ = α(A − b·ī) = 4 × (650 − 125) = ${n(gTarget.equilibrium.Y, 'n1')}; M₁ = P(kY₁ − h·ī) = ${n(gTarget.equilibrium.M, 'n1')}.`)],
        interpretation: L('El banco central acomoda la expansión fiscal: la política monetaria pasa a ser endógena.', 'The central bank accommodates the fiscal expansion: monetary policy becomes endogenous.'),
      },
      config: basicConfig({ G: 300 }, 'interest-target'),
    },
    {
      id: 'int-mf-flexible-fiscal',
      level: 'intermedio',
      types: ['prediction', 'numeric'],
      topic: 'open',
      title: L('Mundell-Fleming: política fiscal con tipo de cambio flexible', 'Mundell-Fleming: fiscal policy under a float'),
      statement: L('Economía pequeña y abierta con movilidad perfecta de capitales y tipo de cambio flexible. El gasto público sube 50.', 'Small open economy with perfect capital mobility and a floating exchange rate. Government spending rises by 50.'),
      objective: L('Analizar el efecto sobre producto, tipo de cambio real y exportaciones netas.', 'Analyse output, the real exchange rate and net exports.'),
      hints: [L('Con i = i* y M fija, la LM* determina Y.', 'With i = i* and fixed M, the LM* pins down Y.'), L('Un aumento de q es una depreciación real.', 'A rise in q is a real depreciation.')],
      content: {
        data: [L('Módulo E, calibración por defecto (i* = 4%, régimen flexible).', 'Module E, default calibration (i* = 4%, flexible regime).')],
        questions: [
          dirQ('Y', L('El producto…', 'Output…'), dir(OFG.Y - OF0.Y)),
          dirQ('q', L('El tipo de cambio real q…', 'The real exchange rate q…'), dir(OFG.q - OF0.q)),
          num('nx', L('Variación de las exportaciones netas ΔNX', 'Change in net exports ΔNX'), OFG.NX - OF0.NX, BN, 0.5),
        ],
        steps: [T((n) => `LM*: Y = (M/P + h·i*)/k no cambia: Y = ${n(OFG.Y, 'n1')}. La IS* se cumple con q = ${n(OFG.q, 'n3')} (apreciación); ΔNX = ${n(OFG.NX - OF0.NX, 'sn1')}.`, (n) => `LM*: Y = (M/P + h·i*)/k is unchanged: Y = ${n(OFG.Y, 'n1')}. IS* holds with q = ${n(OFG.q, 'n3')} (appreciation); ΔNX = ${n(OFG.NX - OF0.NX, 'sn1')}.`)],
        interpretation: L('La apreciación desplaza exportaciones netas por el mismo monto que el gasto: desplazamiento completo vía tipo de cambio.', 'The appreciation crowds out net exports by the same amount as the spending: full crowding out through the exchange rate.'),
      },
      config: openConfig({ G: OPEN_DEFAULTS.G + 50 }, 'flexible'),
    },
    {
      id: 'int-mf-fijo-monetaria',
      level: 'intermedio',
      types: ['prediction', 'numeric'],
      topic: 'open',
      title: L('Mundell-Fleming: política monetaria con tipo de cambio fijo', 'Mundell-Fleming: monetary policy under a peg'),
      statement: L('Con tipo de cambio fijo, el banco central aumenta el crédito interno en 100.', 'Under a peg, the central bank raises domestic credit by 100.'),
      objective: L('Analizar el efecto sobre el producto y las reservas.', 'Analyse output and reserves.'),
      hints: [L('Con tipo fijo la cantidad de dinero es endógena: M = D + R.', 'Under a peg money is endogenous: M = D + R.')],
      content: {
        data: [L('Módulo E, calibración por defecto, régimen fijo.', 'Module E, default calibration, fixed regime.')],
        questions: [dirQ('Y', L('El producto…', 'Output…'), dir(OXD.Y - OX0.Y)), num('dR', L('Variación de reservas ΔR', 'Change in reserves ΔR'), OXD.R - OX0.R, BN, 0.5)],
        steps: [T((n) => `La IS* con q fijo determina Y = ${n(OXD.Y, 'n1')}; la LM* exige la misma M, de modo que R = M − D cae ${n(OX0.R - OXD.R, 'n1')}.`, (n) => `The IS* with fixed q gives Y = ${n(OXD.Y, 'n1')}; the LM* requires the same M, so R = M − D falls by ${n(OX0.R - OXD.R, 'n1')}.`)],
        interpretation: L('Con tipo fijo y movilidad perfecta la política monetaria es ineficaz: la expansión se pierde en reservas.', 'With a peg and perfect mobility monetary policy is ineffective: the expansion leaks out through reserves.'),
      },
      config: openConfig({ D: OPEN_DEFAULTS.D + 100 }, 'fixed'),
    },
    {
      id: 'int-mf-tasa-internacional',
      level: 'intermedio',
      types: ['prediction'],
      topic: 'open',
      title: L('Suba de la tasa internacional', 'A higher world interest rate'),
      statement: L('La tasa internacional sube de 4% a 5% en una economía con tipo de cambio flexible y movilidad perfecta de capitales.', 'The world interest rate rises from 4% to 5% in an economy with a floating rate and perfect capital mobility.'),
      objective: L('Predecir los efectos sobre el tipo de cambio real y el producto.', 'Predict the effects on the real exchange rate and output.'),
      hints: [L('Una tasa más alta reduce la demanda de dinero: con M fija, ¿qué Y equilibra la LM*?', 'A higher rate lowers money demand: with fixed M, which Y clears the LM*?')],
      content: {
        data: [L('Módulo E, calibración por defecto, régimen flexible.', 'Module E, default calibration, flexible regime.')],
        questions: [dirQ('q', L('El tipo de cambio real q…', 'The real exchange rate q…'), dir(OFI.q - OF0.q)), dirQ('Y', L('El producto…', 'Output…'), dir(OFI.Y - OF0.Y)), dirQ('I', L('La inversión…', 'Investment…'), dir(OFI.I - OF0.I))],
        steps: [T((n) => `LM*: Y = (M/P + h·i*)/k = ${n(OFI.Y, 'n1')}; la IS* exige q = ${n(OFI.q, 'n3')} (depreciación). La inversión cae por la tasa más alta.`, (n) => `LM*: Y = (M/P + h·i*)/k = ${n(OFI.Y, 'n1')}; IS* requires q = ${n(OFI.q, 'n3')} (depreciation). Investment falls with the higher rate.`)],
        interpretation: L('En este modelo la depreciación más que compensa la caída de la inversión. El resultado depende de supuestos (movilidad perfecta, sin efectos de balance) que en economías con deuda en dólares pueden no cumplirse.', 'In this model the depreciation more than offsets the fall in investment. The result depends on assumptions (perfect mobility, no balance-sheet effects) that may fail in economies with dollar debt.'),
      },
      config: openConfig({ iStar: OPEN_DEFAULTS.iStar + 1 }, 'flexible'),
    },
    {
      id: 'int-oada-monetaria',
      level: 'intermedio',
      types: ['prediction', 'numeric'],
      topic: 'prices',
      title: L('OA-DA: expansión monetaria en el corto y el mediano plazo', 'AD-AS: monetary expansion in the short and medium run'),
      statement: L('La oferta monetaria aumenta de 1.100 a 1.200 con expectativas de precios dadas en el corto plazo.', 'The money supply rises from 1,100 to 1,200 with given price expectations in the short run.'),
      objective: L('Distinguir efectos de corto y mediano plazo.', 'Distinguish short- and medium-run effects.'),
      hints: [L('En el mediano plazo Pᵉ = P y el producto vuelve a Yₙ.', 'In the medium run Pᵉ = P and output returns to Yₙ.')],
      content: {
        data: [L('Módulo F, calibración por defecto (Yₙ = 2.000, Pᵉ = 1).', 'Module F, default calibration (Yₙ = 2,000, Pᵉ = 1).')],
        questions: [
          dirQ('Ysr', L('En el corto plazo, el producto…', 'In the short run, output…'), dir(adM.value.equilibrium.Y - ad0.value.equilibrium.Y)),
          num('Pmr', L('Nivel de precios de mediano plazo', 'Medium-run price level'), adM.value.mediumRun?.P ?? 0, L('índice', 'index'), 0.002),
          {
            id: 'neutral',
            kind: 'choice',
            prompt: L('¿Qué afirmación describe el mediano plazo?', 'Which statement describes the medium run?'),
            options: [
              { id: 'neutral', label: L('El producto vuelve a Yₙ y los precios suben en la misma proporción que M', 'Output returns to Yₙ and prices rise in the same proportion as M') },
              { id: 'real', label: L('El producto queda permanentemente más alto', 'Output stays permanently higher') },
            ],
            answer: 'neutral',
          },
        ],
        steps: [T((n) => `Corto plazo: P = ${n(adM.value.equilibrium.P, 'n4')}, Y = ${n(adM.value.equilibrium.Y, 'n1')}. Mediano plazo: Y = Yₙ = ${n(adM.value.mediumRun?.Y ?? 0, 'n1')}, P = ${n(adM.value.mediumRun?.P ?? 0, 'n4')} = 1.200/1.100.`, (n) => `Short run: P = ${n(adM.value.equilibrium.P, 'n4')}, Y = ${n(adM.value.equilibrium.Y, 'n1')}. Medium run: Y = Yₙ = ${n(adM.value.mediumRun?.Y ?? 0, 'n1')}, P = ${n(adM.value.mediumRun?.P ?? 0, 'n4')} = 1,200/1,100.`)],
        interpretation: L('El dinero es neutral en el mediano plazo del modelo: solo cambia el nivel de precios.', 'Money is neutral in the model’s medium run: only the price level changes.'),
      },
      config: { model: 'adas', baseline: { ...ADAS_DEFAULTS }, shocked: { ...ADAS_DEFAULTS, M: ADAS_DEFAULTS.M + 100 } },
    },
    {
      id: 'int-datos-comercio',
      level: 'intermedio',
      types: ['data', 'numeric'],
      topic: 'data',
      title: L('Balanza comercial argentina con datos del INDEC', 'Argentina’s trade balance with INDEC data'),
      statement: L('Con los datos del último mes publicado del Intercambio Comercial Argentino, calculá el saldo y el intercambio.', 'Using the latest month published in the Argentine Trade Exchange, compute the balance and turnover.'),
      objective: L('Aplicar identidades a datos oficiales.', 'Apply identities to official data.'),
      hints: [L('BC = X − M; IC = X + M. Los valores están en millones de dólares.', 'BC = X − M; IC = X + M. Values are in US$ millions.')],
      dataSeries: ['ar_x', 'ar_m', 'ar_saldo'],
      build: (files) => {
        const x = files.ar_x;
        const m = files.ar_m;
        if (!x || !m) return null;
        const rows = tradeRows(x.data, m.data, files.ar_saldo?.data ?? []);
        const r = rows[rows.length - 1];
        if (!r) return null;
        return {
          data: [T((n) => `${r.date.slice(0, 7)}: X = ${n(r.x, 'n1')}; M = ${n(r.m, 'n1')} (millones de US$, INDEC).`, (n) => `${r.date.slice(0, 7)}: X = ${n(r.x, 'n1')}; M = ${n(r.m, 'n1')} (US$ millions, INDEC).`)],
          questions: [num('bc', L('Saldo comercial BC', 'Trade balance BC'), r.balance, L('millones de US$', 'US$ millions'), 0.6), num('ic', L('Intercambio comercial IC', 'Turnover IC'), r.turnover, L('millones de US$', 'US$ millions'), 0.6)],
          steps: [T((n) => `BC = ${n(r.x, 'n1')} − ${n(r.m, 'n1')} = ${n(r.balance, 'n1')}; IC = ${n(r.turnover, 'n1')}.${r.published !== null ? ` Saldo publicado por INDEC: ${n(r.published, 'n1')}.` : ''}`, (n) => `BC = ${n(r.x, 'n1')} − ${n(r.m, 'n1')} = ${n(r.balance, 'n1')}; IC = ${n(r.turnover, 'n1')}.${r.published !== null ? ` Balance published by INDEC: ${n(r.published, 'n1')}.` : ''}`)],
          interpretation: L('Las diferencias con el saldo publicado reflejan redondeos de los cuadros oficiales.', 'Differences from the published balance reflect rounding in the official tables.'),
        };
      },
      observatory: { date: '2024-12-01' },
    },
    // ── Avanzado ───────────────────────────────────────────────────────────
    {
      id: 'av-trampa-liquidez',
      level: 'avanzado',
      types: ['numeric', 'policy'],
      topic: 'closed',
      title: L('Trampa de liquidez: eficacia de la política monetaria', 'Liquidity trap: effectiveness of monetary policy'),
      statement: L('En el IS-LM avanzado con LM no lineal, la economía parte de M = 1.600 y el banco central aumenta la oferta monetaria a 1.800.', 'In the advanced IS-LM with a non-linear LM, the economy starts at M = 1,600 and the central bank raises money to 1,800.'),
      objective: L('Cuantificar el efecto de una expansión monetaria en la zona de trampa.', 'Quantify a monetary expansion in the trap region.'),
      hints: [L('La pendiente de la LM es a·k/(m − kY)²: con mucha liquidez es casi horizontal.', 'The LM slope is a·k/(m − kY)²: with ample liquidity it is almost flat.')],
      content: {
        data: [L('Módulo B, LM no lineal (a = 400, i_min = 1), calibración por defecto con M = 1.600.', 'Module B, non-linear LM (a = 400, i_min = 1), default calibration with M = 1,600.')],
        questions: [
          num('dY', L('Variación del producto ΔY', 'Change in output ΔY'), trap1.value.equilibrium.Y - trap0.value.equilibrium.Y, BN, 0.2),
          {
            id: 'zone',
            kind: 'choice',
            prompt: L('¿En qué zona de la LM está la economía?', 'Which LM region is the economy in?'),
            options: [
              { id: 'trap', label: L('Trampa de liquidez', 'Liquidity trap') },
              { id: 'intermediate', label: L('Intermedia', 'Intermediate') },
              { id: 'classical', label: L('Clásica', 'Classical') },
            ],
            answer: trap0.value.zone,
          },
        ],
        steps: [T((n) => `Brent resuelve E₀: Y = ${n(trap0.value.equilibrium.Y, 'n2')}, i = ${n(trap0.value.equilibrium.i, 'n3')}%; E₁: Y = ${n(trap1.value.equilibrium.Y, 'n2')}, i = ${n(trap1.value.equilibrium.i, 'n3')}%.`, (n) => `Brent solves E₀: Y = ${n(trap0.value.equilibrium.Y, 'n2')}, i = ${n(trap0.value.equilibrium.i, 'n3')}%; E₁: Y = ${n(trap1.value.equilibrium.Y, 'n2')}, i = ${n(trap1.value.equilibrium.i, 'n3')}%.`)],
        interpretation: L('Con la tasa cerca de su mínimo, el dinero adicional se mantiene ocioso y la tasa casi no baja: la política monetaria pierde eficacia.', 'With the rate near its floor, extra money is held idle and the rate barely falls: monetary policy loses effectiveness.'),
      },
      config: { model: 'advanced', baseline: { ...ADV_DEFAULTS, M: 1600 }, shocked: { ...ADV_DEFAULTS, M: 1800 }, lm: 'nonlinear', regime: 'money', target0: 5, target1: 5 },
    },
    {
      id: 'av-ismp-demanda',
      level: 'avanzado',
      types: ['numeric', 'equilibrium'],
      topic: 'prices',
      title: L('IS-MP: shock de demanda con regla de Taylor', 'IS-MP: demand shock under a Taylor rule'),
      statement: L('Un shock de demanda d = +2 pp afecta a una economía cuyo banco central sigue una regla de Taylor.', 'A demand shock d = +2 pp hits an economy whose central bank follows a Taylor rule.'),
      objective: L('Calcular brecha, inflación y tasa de equilibrio.', 'Compute the gap, inflation and the policy rate.'),
      hints: [L('x* = d/Δ con Δ = 1 + σκ(1 + φπ) + σφy cuando no hay otros shocks.', 'x* = d/Δ with Δ = 1 + σκ(1 + φπ) + σφy when there are no other shocks.')],
      content: {
        data: [L('Módulo G: σ = 1, κ = 0,3, φπ = φy = 0,5, πᵉ = π* = 2, r̂* = rₙ = 2.', 'Module G: σ = 1, κ = 0.3, φπ = φy = 0.5, πᵉ = π* = 2, r̂* = rₙ = 2.')],
        questions: [num('x', L('Brecha del producto x', 'Output gap x'), sD.equilibrium.x, PP, 0.01), num('pi', L('Inflación π', 'Inflation π'), sD.equilibrium.pi, PCT, 0.01), num('i', L('Tasa de política i', 'Policy rate i'), sD.equilibrium.i, PCT, 0.01)],
        steps: [T((n) => `Δ = 1 + 1 × 0,3 × 1,5 + 1 × 0,5 = 1,95; x = 2/1,95 = ${n(sD.equilibrium.x, 'n4')}; π = 2 + 0,3x = ${n(sD.equilibrium.pi, 'n4')}; i = 2 + π + 0,5(π − 2) + 0,5x = ${n(sD.equilibrium.i, 'n4')}.`, (n) => `Δ = 1 + 1 × 0.3 × 1.5 + 1 × 0.5 = 1.95; x = 2/1.95 = ${n(sD.equilibrium.x, 'n4')}; π = 2 + 0.3x = ${n(sD.equilibrium.pi, 'n4')}; i = 2 + π + 0.5(π − 2) + 0.5x = ${n(sD.equilibrium.i, 'n4')}.`)],
        interpretation: L('La regla sube la tasa real y amortigua el shock: con tasa fija la brecha sería 2.', 'The rule raises the real rate and dampens the shock: with a fixed rate the gap would be 2.'),
      },
      config: { model: 'ismp', baseline: { ...ISMP_DEFAULTS }, shocked: { ...ISMP_DEFAULTS, d: 2 }, regime: 'rule' },
    },
    {
      id: 'av-ismp-oferta',
      level: 'avanzado',
      types: ['policy', 'numeric'],
      topic: 'prices',
      title: L('Shock de oferta: regla de Taylor frente a tasa fija', 'Supply shock: Taylor rule versus a fixed rate'),
      statement: L('Un shock de costos u = +1 pp afecta a la economía. Se comparan la regla de Taylor y una tasa fija en 4%.', 'A cost shock u = +1 pp hits the economy. A Taylor rule is compared with a rate fixed at 4%.'),
      objective: L('Analizar el dilema entre inflación y actividad.', 'Analyse the inflation–activity trade-off.'),
      hints: [L('La curva de Phillips se desplaza hacia arriba: π = πᵉ + κx + u.', 'The Phillips curve shifts up: π = πᵉ + κx + u.')],
      content: {
        data: [L('Módulo G, calibración por defecto.', 'Module G, default calibration.')],
        questions: [num('piRule', L('Inflación con regla de Taylor', 'Inflation under the Taylor rule'), sURule.equilibrium.pi, PCT, 0.01), num('piPeg', L('Inflación con tasa fija', 'Inflation with a fixed rate'), sUPeg.equilibrium.pi, PCT, 0.01), dirQ('x', L('Con la regla, la brecha del producto…', 'Under the rule, the output gap…'), dir(sURule.equilibrium.x))],
        steps: [T((n) => `Regla: x = −σ(1 + φπ)u/Δ = ${n(sURule.equilibrium.x, 'n4')}, π = ${n(sURule.equilibrium.pi, 'n4')}. Tasa fija: x = ${n(sUPeg.equilibrium.x, 'n4')}, π = ${n(sUPeg.equilibrium.pi, 'n4')}.`, (n) => `Rule: x = −σ(1 + φπ)u/Δ = ${n(sURule.equilibrium.x, 'n4')}, π = ${n(sURule.equilibrium.pi, 'n4')}. Fixed rate: x = ${n(sUPeg.equilibrium.x, 'n4')}, π = ${n(sUPeg.equilibrium.pi, 'n4')}.`)],
        interpretation: L('La regla reduce la inflación a costa de una brecha negativa: ante un shock de oferta no hay una política que estabilice ambas variables a la vez.', 'The rule lowers inflation at the cost of a negative gap: after a supply shock no policy stabilises both at once.'),
      },
      config: { model: 'ismp', baseline: { ...ISMP_DEFAULTS }, shocked: { ...ISMP_DEFAULTS, u: 1 }, regime: 'rule' },
    },
    {
      id: 'av-cota-inferior',
      level: 'avanzado',
      types: ['equilibrium', 'prediction'],
      topic: 'prices',
      title: L('Cota inferior de la tasa de interés', 'The lower bound on the interest rate'),
      statement: L('Un shock de demanda muy negativo (d = −10 pp) obliga a la regla a prescribir una tasa nominal negativa, con cota inferior en 0%.', 'A very negative demand shock (d = −10 pp) makes the rule prescribe a negative nominal rate, with a lower bound at 0%.'),
      objective: L('Analizar el equilibrio con la cota vinculante.', 'Analyse the equilibrium with a binding bound.'),
      hints: [L('Si la cota vincula: i = 0 y x = d − σ(0 − πᵉ − rₙ).', 'If the bound binds: i = 0 and x = d − σ(0 − πᵉ − rₙ).')],
      content: {
        data: [L('Módulo G, calibración por defecto con d = −10.', 'Module G, default calibration with d = −10.')],
        questions: [
          {
            id: 'binds',
            kind: 'choice',
            prompt: L('¿La cota inferior vincula?', 'Does the lower bound bind?'),
            options: [
              { id: 'yes', label: L('Sí', 'Yes') },
              { id: 'no', label: L('No', 'No') },
            ],
            answer: sElb.elbBinding ? 'yes' : 'no',
          },
          num('x', L('Brecha del producto x', 'Output gap x'), sElb.equilibrium.x, PP, 0.01),
          num('pi', L('Inflación π', 'Inflation π'), sElb.equilibrium.pi, PCT, 0.01),
        ],
        steps: [T((n) => `La regla pediría i = ${n(sElb.equilibrium.iRule, 'n3')}% < 0: vincula la cota. x = −10 − (0 − 2 − 2) = ${n(sElb.equilibrium.x, 'n2')}; π = 2 + 0,3x = ${n(sElb.equilibrium.pi, 'n2')}.`, (n) => `The rule would ask for i = ${n(sElb.equilibrium.iRule, 'n3')}% < 0: the bound binds. x = −10 − (0 − 2 − 2) = ${n(sElb.equilibrium.x, 'n2')}; π = 2 + 0.3x = ${n(sElb.equilibrium.pi, 'n2')}.`)],
        interpretation: L('Con la cota vinculante la política monetaria convencional deja de responder y el shock se transmite completo a la actividad.', 'With the bound binding conventional monetary policy stops responding and the shock passes fully to activity.'),
      },
      config: { model: 'ismp', baseline: { ...ISMP_DEFAULTS }, shocked: { ...ISMP_DEFAULTS, d: -10 }, regime: 'rule' },
    },
    {
      id: 'av-historia-2018',
      level: 'avanzado',
      types: ['history', 'data'],
      topic: 'data',
      title: L('Argentina, agosto de 2018: tasa de 60%', 'Argentina, August 2018: a 60% rate'),
      statement: L('El 30 de agosto de 2018 el BCRA elevó la tasa de política de 45% a 60%. Analizá qué muestran los datos oficiales en los 30 días siguientes.', 'On 30 August 2018 the BCRA raised the policy rate from 45% to 60%. Analyse what official data show in the following 30 days.'),
      objective: L('Distinguir observaciones, hipótesis e interpretaciones.', 'Distinguish observations, hypotheses and interpretations.'),
      hints: [L('Las observaciones se verifican en las series; las hipótesis proponen mecanismos; las interpretaciones relacionan con la teoría.', 'Observations are checked in the series; hypotheses propose mechanisms; interpretations relate to theory.')],
      dataSeries: ['ar_tc_mayorista', 'ar_reservas'],
      build: (files) => {
        const tc = files.ar_tc_mayorista;
        const res = files.ar_reservas;
        if (!tc || !res) return null;
        const a = beforeAfter(tc.data, '2018-08-30', 30);
        const b = beforeAfter(res.data, '2018-08-30', 30);
        if (a.pct === null || b.abs === null || !a.before || !a.after || !b.before || !b.after || !a.complete || !b.complete) return null;
        return {
          data: [
            T((n) => `Tipo de cambio mayorista (BCRA): ${n(a.before![1], 'n2')} el ${a.before![0]} y ${n(a.after![1], 'n2')} el ${a.after![0]}.`, (n) => `Wholesale exchange rate (BCRA): ${n(a.before![1], 'n2')} on ${a.before![0]} and ${n(a.after![1], 'n2')} on ${a.after![0]}.`),
            T((n) => `Reservas internacionales (BCRA): ${n(b.before![1], 'n0')} y ${n(b.after![1], 'n0')} millones de US$ en las mismas fechas.`, (n) => `International reserves (BCRA): ${n(b.before![1], 'n0')} and ${n(b.after![1], 'n0')} US$ millions on the same dates.`),
          ],
          questions: [
            num('tc', L('Variación porcentual del tipo de cambio entre ambas fechas', 'Percentage change of the exchange rate between both dates'), a.pct, PCT, 0.5),
            dirQ('res', L('Las reservas en ese período…', 'Reserves over that period…'), dir(b.abs, 1)),
            {
              id: 'classify',
              kind: 'classify',
              prompt: L('Clasificá cada afirmación.', 'Classify each statement.'),
              statements: [
                { id: 's1', text: L('El tipo de cambio mayorista fue más alto 30 días después de la suba de tasas que el día previo.', 'The wholesale rate was higher 30 days after the hike than the day before.'), answer: 'obs' },
                { id: 's2', text: L('La suba de la tasa no alcanzó a compensar la devaluación esperada y la prima de riesgo percibidas por los inversores.', 'The hike did not offset the expected depreciation and risk premium perceived by investors.'), answer: 'hyp' },
                { id: 's3', text: L('Según la paridad de tasas, una tasa doméstica más alta solo atrae capitales si supera la tasa externa más la devaluación esperada y la prima de riesgo.', 'Under interest parity, a higher domestic rate attracts capital only if it exceeds the foreign rate plus expected depreciation and the risk premium.'), answer: 'int' },
              ],
            },
          ],
          steps: [T((n) => `Variación del tipo de cambio: ${n(a.pct!, 'sn1')}%. Variación de reservas: ${n(b.abs!, 'sn0')} millones de US$.`, (n) => `Exchange-rate change: ${n(a.pct!, 'sn1')}%. Reserves change: ${n(b.abs!, 'sn0')} US$ millions.`)],
          interpretation: L('Los datos describen lo ocurrido; atribuir el movimiento a la tasa exige considerar expectativas, riesgo y el acuerdo con el FMI vigente.', 'The data describe what happened; attributing the move to the rate requires considering expectations, risk and the ongoing IMF programme.'),
        };
      },
      observatory: { date: '2018-08-30', episode: '2018-08-tasa-60' },
    },
    {
      id: 'av-historia-2023',
      level: 'avanzado',
      types: ['history', 'data'],
      topic: 'data',
      title: L('Argentina, agosto de 2023: devaluación e inflación', 'Argentina, August 2023: devaluation and inflation'),
      statement: L('El 14 de agosto de 2023 el tipo de cambio oficial se devaluó y la tasa de política subió a 118%. Analizá la inflación mensual de los meses siguientes.', 'On 14 August 2023 the official exchange rate was devalued and the policy rate raised to 118%. Analyse monthly inflation in the following months.'),
      objective: L('Usar datos oficiales para discutir el traslado a precios.', 'Use official data to discuss pass-through.'),
      hints: [L('Compará la inflación mensual de julio de 2023 con la de agosto y septiembre.', 'Compare monthly inflation in July 2023 with August and September.')],
      dataSeries: ['ar_inflacion_mensual', 'ar_tc_mayorista'],
      build: (files) => {
        const inf = files.ar_inflacion_mensual;
        const tc = files.ar_tc_mayorista;
        if (!inf || !tc) return null;
        const at = (d: string) => inf.data.find(([k]) => k === d)?.[1];
        const jul = at('2023-07-01');
        const aug = at('2023-08-01');
        const sep = at('2023-09-01');
        const jump = beforeAfter(tc.data, '2023-08-14', 1);
        if (jul === undefined || aug === undefined || sep === undefined || jump.pct === null) return null;
        return {
          data: [T((n) => `Inflación mensual (IPC, INDEC vía BCRA): julio ${n(jul, 'n1')}%, agosto ${n(aug, 'n1')}%, septiembre ${n(sep, 'n1')}%.`, (n) => `Monthly inflation (CPI, INDEC via BCRA): July ${n(jul, 'n1')}%, August ${n(aug, 'n1')}%, September ${n(sep, 'n1')}%.`)],
          questions: [
            num('jump', L('Variación del tipo de cambio mayorista el 14/08/2023 respecto del día hábil anterior', 'Change of the wholesale rate on 14/08/2023 vs the previous business day'), jump.pct, PCT, 0.5),
            num('acc', L('Aumento de la inflación mensual entre julio y agosto', 'Rise in monthly inflation from July to August'), aug - jul, PP, 0.05),
            {
              id: 'classify',
              kind: 'classify',
              prompt: L('Clasificá cada afirmación.', 'Classify each statement.'),
              statements: [
                { id: 's1', text: L('La inflación mensual de agosto de 2023 fue mayor que la de julio.', 'Monthly inflation in August 2023 was higher than in July.'), answer: aug > jul ? 'obs' : 'hyp' },
                { id: 's2', text: L('Parte de la aceleración refleja el traslado de la devaluación a los precios.', 'Part of the acceleration reflects the pass-through of the devaluation to prices.'), answer: 'hyp' },
                { id: 's3', text: L('Con expectativas de inflación altas, una devaluación discreta tiende a trasladarse más rápido a precios.', 'With high inflation expectations, a discrete devaluation tends to pass through to prices faster.'), answer: 'int' },
              ],
            },
          ],
          steps: [T((n) => `Salto del tipo de cambio: ${n(jump.pct!, 'sn1')}%. Inflación: ${n(jul, 'n1')}% → ${n(aug, 'n1')}% → ${n(sep, 'n1')}%.`, (n) => `Exchange-rate jump: ${n(jump.pct!, 'sn1')}%. Inflation: ${n(jul, 'n1')}% → ${n(aug, 'n1')}% → ${n(sep, 'n1')}%.`)],
          interpretation: L('La coincidencia temporal es compatible con el traslado a precios, pero no lo prueba por sí sola: otros precios regulados y expectativas cambiaron al mismo tiempo.', 'The timing is consistent with pass-through but does not prove it alone: regulated prices and expectations changed at the same time.'),
        };
      },
      observatory: { date: '2023-08-14', episode: '2023-08-devaluacion' },
    },
  ];
}

let cached: Exercise[] | null = null;
export function exercises(): Exercise[] {
  if (!cached) cached = buildBank();
  return cached;
}

/** Grades an answer: numeric within tolerance, exact option, or every statement classified correctly. */
export function isCorrect(q: Question, answer: unknown): boolean {
  if (q.kind === 'choice') return answer === q.answer;
  if (q.kind === 'number') {
    const v = typeof answer === 'number' ? answer : parseAnswer(String(answer ?? ''));
    return v !== null && Math.abs(v - q.answer) <= q.tolerance;
  }
  const a = (answer ?? {}) as Record<string, string>;
  return q.statements.every((s) => a[s.id] === s.answer);
}

/**
 * Reads a typed number in either convention: "1234,5", "1234.5", "1.234,5" or
 * "1,234.5". With a single separator it is taken as the decimal mark.
 */
export function parseAnswer(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(/%$/, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const thousands = lastComma > lastDot ? '.' : ',';
    s = s.split(thousands).join('').replace(',', '.');
  } else s = s.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
