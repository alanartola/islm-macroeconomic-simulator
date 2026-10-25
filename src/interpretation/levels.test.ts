import { change } from '../engine/comparative';
import { makeI18n } from '../i18n';
import { causeParam } from './levels';

describe('parameter-change items', () => {
  const { t } = makeI18n('es');

  it('report the percentage change when the initial value is not zero', () => {
    const it = causeParam('param.G.name', change(250, 300));
    expect(t(it.key, it.vars)).toBe('Gasto público: 250,00 → 300,00 (+50,00; +20,0%).');
  });

  it('never report a percentage change from a zero initial value', () => {
    const it = causeParam('ismp.param.u.name', change(0, 1));
    expect(it.key).toBe('lvl.cause.paramAbs');
    expect(t(it.key, it.vars)).not.toMatch(/0,0\s?%/);
    expect(t(it.key, it.vars)).toMatch(/no definida porque el valor inicial es cero/);
  });
});
