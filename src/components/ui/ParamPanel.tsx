import { useI18n } from '../../i18n';
import { useMode } from '../../state/mode';
import { ParamControl } from '../ParamControl';

export interface FieldMeta<K extends string> {
  key: K;
  /** Symbol shown next to the name (mathematical notation). */
  sym: string;
  /** Translation key of the parameter name. */
  name: string;
  /** Translation key of the description (tooltip / screen readers). */
  desc: string;
  /** Translation key of the unit. */
  unit: string;
  /** Translation key of the group heading. */
  group: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  /** 'edu' fields are always visible; 'adv' fields only in advanced mode. */
  level: 'edu' | 'adv';
  /** Optional instrument tag (translation key). */
  tag?: string;
}

interface Props<K extends string> {
  fields: FieldMeta<K>[];
  values: Record<K, number>;
  reference: Record<K, number> | null;
  onChange: (key: K, value: number) => void;
}

/** Grouped parameter controls; hides advanced parameters in educational mode. */
export function ParamPanel<K extends string>({ fields, values, reference, onChange }: Props<K>) {
  const { t } = useI18n();
  const { isAdvanced } = useMode();
  const visible = fields.filter((f) => isAdvanced || f.level === 'edu');
  const groups = [...new Set(visible.map((f) => f.group))];
  return (
    <>
      {groups.map((g) => (
        <div key={g} style={{ marginTop: 12 }}>
          <h3 className="section-title">{t(g)}</h3>
          {visible
            .filter((f) => f.group === g)
            .map((f) => (
              <ParamControl
                key={f.key}
                sym={f.sym}
                name={t(f.name)}
                description={t(f.desc)}
                unit={t(f.unit)}
                value={values[f.key]}
                reference={reference ? reference[f.key] : null}
                min={f.min}
                max={f.max}
                step={f.step}
                digits={f.digits}
                tag={f.tag ? t(f.tag) : undefined}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
        </div>
      ))}
    </>
  );
}

interface EditToggleProps {
  editing: 'baseline' | 'shocked';
  onChange: (side: 'baseline' | 'shocked') => void;
}

export function EditToggle({ editing, onChange }: EditToggleProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="segmented" role="group" aria-label={t('panel.params')}>
        <button aria-pressed={editing === 'shocked'} onClick={() => onChange('shocked')}>
          {t('edit.shocked')}
        </button>
        <button aria-pressed={editing === 'baseline'} onClick={() => onChange('baseline')}>
          {t('edit.baseline')}
        </button>
      </div>
      <p className="note" style={{ marginTop: 8 }}>{editing === 'shocked' ? t('edit.hint.shocked') : t('edit.hint.baseline')}</p>
    </>
  );
}
