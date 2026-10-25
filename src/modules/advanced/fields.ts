import type { AdvParamKey, LMSpec } from '../../engine/advanced';
import type { FieldMeta } from '../../components/ui/ParamPanel';

type F = FieldMeta<AdvParamKey>;

const name = (k: AdvParamKey) => (['C0', 'c', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'].includes(k) ? `param.${k}.name` : `adv.param.${k}.name`);
const desc = (k: AdvParamKey) => (['C0', 'c', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'].includes(k) ? `param.${k}.desc` : `adv.param.${k}.desc`);

function field(key: AdvParamKey, sym: string, group: string, min: number, max: number, step: number, digits: number, unit: string, level: 'edu' | 'adv', tag?: string): F {
  return { key, sym, name: name(key), desc: desc(key), unit, group, min, max, step, digits, level, tag };
}

const GOODS = 'adv.group.goods';
const FISCAL = 'adv.group.fiscal';
const MONEY = 'adv.group.money';

/** Parameter controls of Module B; money-demand fields depend on the LM specification. */
export function advFields(lm: LMSpec, regime: 'money' | 'rate'): F[] {
  const out: F[] = [
    field('G', 'G', FISCAL, 0, 800, 5, 0, 'unit.bn', 'edu', 'tag.fiscal'),
    field('T0', 'T₀', FISCAL, -200, 400, 5, 0, 'unit.bn', 'adv', 'tag.fiscal'),
    field('t', 't', FISCAL, 0, 0.6, 0.01, 2, 'unit.ratio', 'edu', 'tag.fiscal'),
    field('TR', 'TR', FISCAL, 0, 600, 5, 0, 'unit.bn', 'edu', 'tag.fiscal'),
    field('C0', 'C₀', GOODS, 0, 600, 5, 0, 'unit.bn', 'adv'),
    field('c', 'c', GOODS, 0, 0.95, 0.01, 2, 'unit.ratio', 'edu'),
    field('I0', 'I₀', GOODS, 0, 800, 5, 0, 'unit.bn', 'edu'),
    field('b', 'b', GOODS, 0, 100, 0.5, 1, 'unit.bnPerPp', 'edu'),
  ];
  if (regime === 'money') out.push(field('M', 'M', MONEY, 50, 3000, 10, 0, 'unit.bn', 'edu', 'tag.monetary'));
  out.push(field('P', 'P', MONEY, 0.2, 3, 0.01, 2, 'unit.index', 'adv'), field('k', 'k', MONEY, 0.05, 2, 0.01, 2, 'unit.ratio', 'edu'));
  if (lm === 'nonlinear') {
    out.push(field('a', 'a', MONEY, 1, 2000, 5, 0, 'unit.bnPp', 'edu'), field('iMin', 'i_min', MONEY, -1, 4, 0.05, 2, 'unit.pct', 'adv'));
  } else {
    out.push(field('h', 'h', MONEY, 0, 300, 1, 0, 'unit.bnPerPp', 'edu'), field('L0', 'L₀', MONEY, 0, 1000, 5, 0, 'unit.bn', 'adv'));
    if (lm === 'floor') out.push(field('iFloor', 'i_piso', MONEY, -1, 3, 0.05, 2, 'unit.pct', 'edu'));
  }
  return out;
}
