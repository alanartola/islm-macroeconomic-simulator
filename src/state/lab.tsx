import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MAX_COMPARE, MAX_STORED, loadLab, newScenarioId, storeLab, type LabConfig, type LabScenario } from '../lab/scenario';

interface LabCtx {
  scenarios: LabScenario[];
  selected: string[];
  save: (config: LabConfig, name: string) => LabScenario;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  addMany: (list: LabScenario[]) => void;
  toggleSelected: (id: string) => void;
}

const Ctx = createContext<LabCtx | null>(null);

/** Saved experiments, persisted in localStorage (inputs only; results are always recomputed). */
export function LabProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<LabScenario[]>(() => loadLab());
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => storeLab(scenarios), [scenarios]);

  const save = useCallback((config: LabConfig, name: string) => {
    const s: LabScenario = { id: newScenarioId(), name: name.slice(0, 80), createdAt: new Date().toISOString(), config };
    setScenarios((l) => [...l, s].slice(-MAX_STORED));
    setSelected((sel) => (sel.length < MAX_COMPARE ? [...sel, s.id] : sel));
    return s;
  }, []);
  const remove = useCallback((id: string) => {
    setScenarios((l) => l.filter((s) => s.id !== id));
    setSelected((sel) => sel.filter((x) => x !== id));
  }, []);
  const rename = useCallback((id: string, name: string) => setScenarios((l) => l.map((s) => (s.id === id ? { ...s, name: name.slice(0, 80) } : s))), []);
  const addMany = useCallback((list: LabScenario[]) => setScenarios((l) => [...l, ...list].slice(-MAX_STORED)), []);
  const toggleSelected = useCallback(
    (id: string) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < MAX_COMPARE ? [...sel, id] : sel)),
    [],
  );
  const value = useMemo(() => ({ scenarios, selected, save, remove, rename, addMany, toggleSelected }), [scenarios, selected, save, remove, rename, addMany, toggleSelected]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLab(): LabCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLab outside LabProvider');
  return c;
}
