/**
 * Core types of the IS-LM engine.
 *
 * Dimensional conventions (see docs/MODEL.md §2):
 *  - Flow quantities (Y, C, I, G, T, C0, I0) and money stocks (M, M/P) are
 *    measured in billions of currency units ("bn"), flows per period.
 *  - P is a dimensionless price index (base = 1).
 *  - The interest rate i is expressed in PERCENTAGE POINTS (i = 5 means 5%).
 *  - c and k are dimensionless (bn per bn).
 *  - b and h are measured in bn per percentage point of interest.
 *    Therefore b·i and h·i are in bn, consistent with every equation.
 */

/** Structural and policy parameters of the closed, fixed-price economy. */
export interface ModelParams {
  /** Autonomous consumption, C₀ (bn). */
  C0: number;
  /** Marginal propensity to consume, c (dimensionless, 0 ≤ c < 1). */
  c: number;
  /** Lump-sum net taxes, T (bn). */
  T: number;
  /** Autonomous investment, I₀ (bn). */
  I0: number;
  /** Interest sensitivity of investment, b (bn per percentage point). */
  b: number;
  /** Government purchases, G (bn). */
  G: number;
  /** Nominal money supply, M (bn). Exogenous only under the money-supply regime. */
  M: number;
  /** Price level, P (index, fixed in the short run). */
  P: number;
  /** Income sensitivity of real money demand, k (dimensionless). */
  k: number;
  /** Interest sensitivity of real money demand, h (bn per percentage point). */
  h: number;
}

export type ParamKey = keyof ModelParams;

/**
 * Monetary policy regime.
 *  - `money-supply`: the central bank fixes M; i is endogenous (traditional IS-LM).
 *  - `interest-target`: the central bank fixes i = ī and supplies whatever M
 *    is demanded at that rate; M is endogenous and the LM curve is horizontal.
 */
export type PolicyRegime = 'money-supply' | 'interest-target';

/** A complete specification of one economy (one equilibrium to be solved). */
export interface EconomySpec {
  params: ModelParams;
  regime: PolicyRegime;
  /** Policy rate target ī in percentage points. Used only under `interest-target`. */
  targetRate: number;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

/** Machine-readable validation issue; the UI translates `code` with `values`. */
export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Parameter or variable the issue refers to, when applicable. */
  field?: ParamKey | 'targetRate' | EndogenousKey;
  values?: Record<string, number>;
}

export type IssueCode =
  | 'NON_FINITE'
  | 'MPC_OUT_OF_RANGE'
  | 'NEGATIVE_SENSITIVITY'
  | 'NON_POSITIVE_K'
  | 'NON_POSITIVE_PRICE'
  | 'NON_POSITIVE_MONEY'
  | 'NEGATIVE_AUTONOMOUS'
  | 'NEGATIVE_GOVERNMENT'
  | 'NEGATIVE_TAXES'
  | 'DEGENERATE_SYSTEM'
  | 'NON_POSITIVE_OUTPUT'
  | 'INFEASIBLE_TARGET'
  | 'NEGATIVE_RATE'
  | 'NEGATIVE_INVESTMENT'
  | 'NEGATIVE_CONSUMPTION'
  | 'NEGATIVE_DISPOSABLE_INCOME'
  | 'HIGH_MPC'
  | 'VERTICAL_IS'
  | 'VERTICAL_LM'
  | 'NEAR_LIQUIDITY_TRAP';

/** Endogenous variables reported for each equilibrium. */
export interface Equilibrium {
  /** Output / income Y (bn). */
  Y: number;
  /** Interest rate i (percentage points). */
  i: number;
  /** Aggregate consumption C (bn). */
  C: number;
  /** Private investment I (bn). */
  I: number;
  /** Government purchases G (bn) — exogenous, reported for completeness. */
  G: number;
  /** Tax revenue T (bn) — lump sum, equal to the parameter. */
  T: number;
  /** Disposable income Y − T (bn). */
  Yd: number;
  /** Private saving S_p = Y − T − C (bn). */
  Sp: number;
  /** Public saving S_g = T − G (bn); the budget balance. */
  Sg: number;
  /** National saving S = S_p + S_g (bn). */
  S: number;
  /** Real money supply M/P (bn, real). */
  realMoney: number;
  /** Real money demand L = kY − h·i (bn, real). Equals M/P in equilibrium. */
  moneyDemand: number;
  /** Nominal money supply M (bn). Endogenous under the interest-target regime. */
  M: number;
  /** Autonomous spending A = C₀ − cT + I₀ + G (bn). */
  A: number;
}

/** Residuals of the accounting identities; all should be ~0. */
export interface IdentityResiduals {
  /** Y − (C + I + G). */
  goodsMarket: number;
  /** M/P − (kY − h·i). */
  moneyMarket: number;
  /** S − I (closed economy: national saving equals investment). */
  savingInvestment: number;
  /** (Y − T) − (C + S_p). */
  disposableIncome: number;
}

/** Comparative-statics multipliers evaluated at the given parameters. */
export interface Multipliers {
  /** Simple Keynesian multiplier 1/(1−c): effect of ΔA with i held constant. */
  keynesian: number;
  /** dY/dG. */
  dY_dG: number;
  /** dY/dT. */
  dY_dT: number;
  /** dY/dG with dT = dG (balanced-budget multiplier). */
  dY_dBalancedBudget: number;
  /** dY/dI₀ (equal to dY/dC₀ and dY/dG). */
  dY_dI0: number;
  /** dY/d(M/P). Zero under the interest-target regime (M is endogenous). */
  dY_dRealMoney: number;
  /** di/dG (pp per bn). Zero under the interest-target regime. */
  di_dG: number;
  /** di/dT (pp per bn). */
  di_dT: number;
  /** di/d(M/P) (pp per bn). */
  di_dRealMoney: number;
  /** dY/dī (bn per pp). Only meaningful under the interest-target regime. */
  dY_dTargetRate: number;
  /** Share of the Keynesian fiscal effect offset by higher rates: 1 − (dY/dG)/(1/(1−c)). */
  crowdingOutShare: number;
}

/** Slopes of the curves in (Y, i) space, di/dY (pp per bn). */
export interface CurveSlopes {
  /** IS slope −(1−c)/b; −Infinity when b = 0 (vertical IS). */
  is: number;
  /** LM slope k/h; +Infinity when h = 0 (vertical LM); 0 under interest targeting. */
  lm: number;
}

export interface SolvedEconomy {
  spec: EconomySpec;
  equilibrium: Equilibrium;
  residuals: IdentityResiduals;
  multipliers: Multipliers;
  slopes: CurveSlopes;
  /** Warnings and informational notes (errors prevent a SolvedEconomy). */
  issues: ValidationIssue[];
}

export type SolveResult =
  | { ok: true; value: SolvedEconomy }
  | { ok: false; issues: ValidationIssue[] };

export type EndogenousKey = keyof Equilibrium;
