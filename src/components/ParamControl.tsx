import { useEffect, useId, useState } from 'react';
import { useI18n } from '../i18n';

interface Props {
  sym: string;
  name: string;
  description: string;
  unit: string;
  value: number;
  /** Reference value (E₀) shown as a marker when editing E₁. */
  reference: number | null;
  min: number;
  max: number;
  step: number;
  digits: number;
  tag?: string;
  onChange: (v: number) => void;
}

/** Slider + numeric input. The numeric input accepts values outside the slider range; the engine validates them. */
export function ParamControl({ sym, name, description, unit, value, reference, min, max, step, digits, tag, onChange }: Props) {
  const { f, t } = useI18n();
  const id = useId();
  const [text, setText] = useState(() => value.toFixed(digits));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText((prev) => (Number(prev.replace(',', '.')) === value ? prev : value.toFixed(digits)));
    setInvalid(false);
  }, [value, digits]);

  const commit = (s: string) => {
    setText(s);
    const v = Number(s.replace(',', '.'));
    if (s.trim() === '' || !Number.isFinite(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(v);
  };

  const pct = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  const delta = reference === null ? 0 : value - reference;
  const hasDelta = reference !== null && Math.abs(delta) > 1e-9;

  return (
    <div className="param">
      <label className="param-label" htmlFor={`${id}-num`} title={description}>
        <span className="sym">{sym}</span>
        <span className="name">{name}</span>
        {tag && <span className="tag">{tag}</span>}
      </label>
      <div className="param-input">
        <input
          id={`${id}-num`}
          type="text"
          inputMode="decimal"
          value={text}
          aria-invalid={invalid}
          aria-describedby={`${id}-desc`}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            if (invalid) {
              setText(value.toFixed(digits));
              setInvalid(false);
            }
          }}
        />
        <span className="unit">{unit}</span>
      </div>
      <div className="param-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          aria-label={`${sym} — ${name}`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {reference !== null && (
          <span
            className="marker"
            style={{ left: `calc(${pct(reference)}% + ${(0.5 - pct(reference) / 100) * 14}px)` }}
            title={t('param.baselineMarker', { v: f(reference, `n${Math.min(digits, 4)}`) })}
          />
        )}
      </div>
      <span id={`${id}-desc`} className="sr-only">{description}</span>
      {hasDelta && (
        <span className="param-delta">
          {t('param.delta')}: {f(delta, 'sn2')} ({f(reference ?? 0, `n${Math.min(digits, 4)}`)} → {f(value, `n${Math.min(digits, 4)}`)})
        </span>
      )}
    </div>
  );
}
