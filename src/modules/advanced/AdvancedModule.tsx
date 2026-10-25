import type { Dispatch } from 'react';
import { useI18n } from '../../i18n';
import { issueGroups, type AdvAction, type AdvSim, type AdvState } from '../../state/advancedState';
import { IssueList } from '../../components/ui/Explanation';
import { ModuleLayout } from '../../components/ui/ModuleLayout';
import { AdvSidebar } from './AdvSidebar';
import { AdvancedView } from './AdvancedView';

interface Props {
  state: AdvState;
  dispatch: Dispatch<AdvAction>;
  sim: AdvSim;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

/** Module B — advanced IS-LM. */
export function AdvancedModule({ state, dispatch, sim, sidebarOpen, onCloseSidebar }: Props) {
  const { t } = useI18n();
  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={<AdvSidebar state={state} dispatch={dispatch} sim={sim} onPick={onCloseSidebar} />}>
      <div className="module-intro">
        <h2>{t('mod.advanced')}</h2>
        <p>{t('mod.advanced.desc')}</p>
      </div>
      <IssueList groups={issueGroups(sim)} prefix="adv.issue." />
      {sim.ok && <AdvancedView sim={sim} />}
    </ModuleLayout>
  );
}
