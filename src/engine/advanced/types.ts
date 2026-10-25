/**
 * Module B — advanced closed-economy IS-LM (see docs/modelos/islm-avanzado.md).
 *
 * Units follow Module A: flows and money in bn ("mil M"), interest rates in
 * percentage points, b and h in bn per pp, c, t and k dimensionless, P an index,
 * a (speculative-demand scale) in bn·pp.
 *
 *   T  = T₀ + tY                      tax revenue
 *   C  = C₀ + c (Y − T + TR)          consumption out of disposable income
 *   I  = I₀ − b i
 *   Y  = C + I + G
 *
 * Money demand (three explicit specifications):
 *   linear     L = kY + L₀ − h i
 *   nonlinear  L = kY + a / (i − i_min),  i > i_min
 *   floor      L = kY + L₀ − h i for i > i_floor; at i = i_floor money demand is
 *              perfectly elastic (agents absorb any excess balances), so
 *              i = max(i_floor, i_linear): a formal binding lower bound.
 */

export type LMSpec = 'linear' | 'nonlinear' | 'floor';

/** money: M exogenous, i endogenous; rate: i = ī exogenous, M endogenous (monetary accommodation). */
export type AdvRegime = 'money' | 'rate';

export interface AdvParams {
  C0: number;
  c: number;
  T0: number;
  t: number;
  TR: number;
  I0: number;
  b: number;
  G: number;
  M: number;
  P: number;
  k: number;
  /** Linear specification: interest sensitivity (bn/pp) and autonomous money demand (bn). */
  h: number;
  L0: number;
  /** Non-linear specification: speculative-demand scale a (bn·pp) and asymptotic minimum rate (pp). */
  a: number;
  iMin: number;
  /** Floor specification: lower bound of the interest rate (pp). */
  iFloor: number;
}

export type AdvParamKey = keyof AdvParams;

export interface AdvSpec {
  params: AdvParams;
  lm: LMSpec;
  regime: AdvRegime;
  /** Policy rate (pp) when regime = 'rate'. */
  targetRate: number;
}

export type AdvIssueCode =
  | 'NON_FINITE'
  | 'MPC_OUT_OF_RANGE'
  | 'TAX_RATE_OUT_OF_RANGE'
  | 'NEGATIVE_SENSITIVITY'
  | 'NON_POSITIVE_K'
  | 'NON_POSITIVE_PRICE'
  | 'NON_POSITIVE_MONEY'
  | 'NEGATIVE_AUTONOMOUS'
  | 'NEGATIVE_GOVERNMENT'
  | 'NEGATIVE_TRANSFERS'
  | 'NON_POSITIVE_A'
  | 'DEGENERATE_SYSTEM'
  | 'TARGET_BELOW_MINIMUM'
  | 'NO_EQUILIBRIUM'
  | 'SOLVER_FAILED'
  | 'NON_POSITIVE_OUTPUT'
  | 'INFEASIBLE_TARGET'
  | 'NEGATIVE_RATE'
  | 'NEGATIVE_INVESTMENT'
  | 'NEGATIVE_CONSUMPTION'
  | 'NEGATIVE_DISPOSABLE_INCOME'
  | 'NEGATIVE_AUTONOMOUS_TAX'
  | 'HIGH_MULTIPLIER'
  | 'FLOOR_BINDING';

export interface AdvIssue {
  code: AdvIssueCode;
  severity: 'error' | 'warning' | 'info';
  values?: Record<string, number>;
  field?: string;
}

/**
 * Classification of the LM region at the equilibrium, based on the share of
 * the constant-rate (Keynesian) fiscal effect that is crowded out:
 *   trap          share < 10 %  (LM almost horizontal)
 *   intermediate  10 % ≤ share ≤ 90 %
 *   classical     share > 90 %  (LM almost vertical)
 *   floor         the formal lower bound binds (strict liquidity trap)
 *   pegged        the central bank fixes the rate (regime 'rate')
 * The 10 %/90 % thresholds are pedagogical conventions, not structural parameters.
 */
export type LMZone = 'trap' | 'intermediate' | 'classical' | 'floor' | 'pegged';

export interface AdvEquilibrium {
  Y: number;
  i: number;
  C: number;
  I: number;
  G: number;
  /** Tax revenue T₀ + tY. */
  T: number;
  TR: number;
  Yd: number;
  Sp: number;
  /** Public saving = budget balance T − G − TR. */
  Sg: number;
  S: number;
  realMoney: number;
  M: number;
  /** Real money demand at (Y, i) (at the floor: demand at the floor rate, excluding idle balances). */
  moneyDemand: number;
  transactionDemand: number;
  speculativeDemand: number;
  /** Excess real balances absorbed at a binding floor (0 otherwise). */
  idleBalances: number;
  A: number;
  alpha: number;
}

export interface AdvMultipliers {
  /** Simple multiplier 1/[1 − c(1 − t)] (constant interest rate). */
  alpha: number;
  /** LM slope di/dY at the equilibrium (pp per bn); Infinity if vertical. */
  lmSlope: number;
  /** IS slope di/dY (pp per bn); −Infinity if vertical. */
  isSlope: number;
  dY_dG: number;
  dY_dTR: number;
  dY_dT0: number;
  dY_dt: number;
  dY_dRealMoney: number;
  di_dG: number;
  di_dRealMoney: number;
  dY_dTargetRate: number;
  crowdingOutShare: number;
}

export interface AdvElasticities {
  /** Interest elasticity of money demand (∂L/∂i)·(i/L). */
  moneyInterest: number | null;
  /** Income elasticity of money demand (∂L/∂Y)·(Y/L). */
  moneyIncome: number | null;
  /** Interest elasticity of investment (∂I/∂i)·(i/I). */
  investmentInterest: number | null;
  /** Elasticity of output to government purchases (dY/dG)·(G/Y). */
  outputGov: number | null;
  /** Elasticity of output to real money (dY/dm)·(m/Y). */
  outputMoney: number | null;
}

export interface SolverDiagnostics {
  method: 'closed-form' | 'brent';
  iterations: number;
  /** |Y_IS − Y_LM| at the solution (bn). */
  residual: number;
  bracket?: [number, number];
}

export interface AdvSolved {
  spec: AdvSpec;
  equilibrium: AdvEquilibrium;
  multipliers: AdvMultipliers;
  elasticities: AdvElasticities;
  zone: LMZone;
  floorBinding: boolean;
  residuals: { goods: number; money: number; saving: number; budget: number };
  diagnostics: SolverDiagnostics;
  issues: AdvIssue[];
}

export type AdvResult = { ok: true; value: AdvSolved } | { ok: false; issues: AdvIssue[] };
