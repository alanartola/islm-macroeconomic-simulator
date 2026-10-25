import { Suspense, lazy, useState, type Dispatch } from 'react';
import { useI18n } from '../../i18n';
import { Sidebar } from '../../components/Sidebar';
import { SimulatorView } from '../../components/SimulatorView';
import { TransmissionView } from '../../components/TransmissionView';
import { SensitivityView } from '../../components/SensitivityView';
import { ScenariosView } from '../../components/ScenariosView';
import { IssuesPanel } from '../../components/Results';
import type { SavedOverlay } from '../../components/charts/ISLMChart';
import type { Action, SimState } from '../../state/store';
import type { Simulation } from '../../state/simulation';
import { BASIC_TABS, type BasicTab } from './tabs';

const ModelView = lazy(() => import('../../components/ModelView'));


interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
  sim: Simulation;
  savedSims: { id: string; name: string; sim: Simulation; color: string }[];
  overlays: SavedOverlay[];
  initialTab: BasicTab;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

/** Module A — the original linear IS-LM simulator, preserved unchanged. */
export function BasicModule({ state, dispatch, sim, savedSims, overlays, initialTab, sidebarOpen, onCloseSidebar }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<BasicTab>(initialTab);
  return (
    <div className="layout">
      {sidebarOpen && <div className="scrim mobile-only" onClick={onCloseSidebar} />}
      <Sidebar state={state} dispatch={dispatch} sim={sim} open={sidebarOpen} onClose={onCloseSidebar} />
      <main className="main">
        <nav className="tabs" role="tablist">
          {BASIC_TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {t(`nav.${k}`)}
            </button>
          ))}
        </nav>
        <IssuesPanel sim={sim} />
        {tab === 'model' ? (
          <Suspense fallback={<div className="card" style={{ padding: 20 }}>…</div>}>
            <ModelView e1={sim.e1} />
          </Suspense>
        ) : tab === 'scenarios' ? (
          <ScenariosView state={state} dispatch={dispatch} current={sim} savedSims={savedSims} />
        ) : sim.ok ? (
          tab === 'simulator' ? (
            <SimulatorView sim={sim} state={state} dispatch={dispatch} overlays={overlays} />
          ) : tab === 'transmission' ? (
            <TransmissionView sim={sim} />
          ) : (
            <SensitivityView sim={sim} />
          )
        ) : null}
      </main>
    </div>
  );
}
