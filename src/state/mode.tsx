import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { readPref, writePref } from './persistence';

/**
 * Navigation level. Both modes run on exactly the same engine; the advanced
 * mode only reveals more parameters, derivatives, diagnostics and tools.
 */
export type Mode = 'edu' | 'adv';

interface ModeCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
  isAdvanced: boolean;
}

const Ctx = createContext<ModeCtx>({ mode: 'edu', setMode: () => {}, isAdvanced: false });

function initialMode(): Mode {
  try {
    const q = new URLSearchParams(window.location.search).get('mode');
    if (q === 'edu' || q === 'adv') return q;
  } catch {
    /* ignore */
  }
  const stored = readPref('islm.mode');
  return stored === 'adv' ? 'adv' : 'edu';
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const value = useMemo(
    () => ({
      mode,
      isAdvanced: mode === 'adv',
      setMode: (m: Mode) => {
        setModeState(m);
        writePref('islm.mode', m);
      },
    }),
    [mode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMode(): ModeCtx {
  return useContext(Ctx);
}
