import { useMemo } from 'react';
import { useI18n } from '../../i18n';
import { DEFAULT_PARAMS, solve } from '../../engine';
import { ISLMChart } from '../../components/charts/ISLMChart';
import { LegendLine } from '../../components/charts/common';
import { GROUPS, LETTER } from '../catalog';

const DOCS_URL = 'https://github.com/alanartola/islm-macroeconomic-simulator/blob/main/docs/modelos/README.md';
/** The cover figure: a fiscal expansion of ΔG = +50 in Module A, solved by the engine. */
const COVER_SHOCK = { G: DEFAULT_PARAMS.G + 50 };

/**
 * Cover of the laboratory: what it is, one representative result computed by
 * the model, a thematic table of contents of the eight modules and the chart
 * conventions shared by every module.
 */
export function HomeModule({ onOpen }: { onOpen: (m: string) => void }) {
  const { t, f } = useI18n();
  const cover = useMemo(() => {
    const r0 = solve({ params: DEFAULT_PARAMS, regime: 'money-supply', targetRate: 5 });
    const r1 = solve({ params: { ...DEFAULT_PARAMS, ...COVER_SHOCK }, regime: 'money-supply', targetRate: 5 });
    return r0.ok && r1.ok ? { e0: r0.value, e1: r1.value } : null;
  }, []);

  return (
    <main className="main home">
      <section className="cover">
        <div className="cover-text">
          <span className="kicker">{t('home.kicker')}</span>
          <h2>{t('home.title')}</h2>
          <p className="lede">{t('home.lead')}</p>
          <p className="scope">{t('home.scope')}</p>
          <div className="cover-actions">
            <button className="btn primary" onClick={() => onOpen('basic')}>
              {t('home.start')}
            </button>
            <a className="btn link" href={DOCS_URL} target="_blank" rel="noreferrer">
              {t('home.docs')}
            </a>
          </div>
        </div>

        {cover && (
          <figure className="cover-figure">
            <div className="chart-legend">
              <LegendLine color="var(--series-is)" dashed label="IS₀" />
              <LegendLine color="var(--series-is)" label="IS₁" />
              <LegendLine color="var(--series-lm)" label="LM" />
            </div>
            <ISLMChart e0={cover.e0} e1={cover.e1} showInitial showShifted showGuides saved={[]} />
            <dl className="ledger-mini">
              <div>
                <dt>{t('home.fig.Y')}</dt>
                <dd>
                  {f(cover.e0.equilibrium.Y, 'n0')} → {f(cover.e1.equilibrium.Y, 'n0')}
                </dd>
              </div>
              <div>
                <dt>{t('home.fig.i')}</dt>
                <dd>
                  {f(cover.e0.equilibrium.i, 'rate')} → {f(cover.e1.equilibrium.i, 'rate')}
                </dd>
              </div>
              <div>
                <dt>{t('home.fig.I')}</dt>
                <dd>
                  {f(cover.e0.equilibrium.I, 'n0')} → {f(cover.e1.equilibrium.I, 'n0')}
                </dd>
              </div>
              <div>
                <dt>{t('home.fig.mult')}</dt>
                <dd>{f(cover.e1.multipliers.dY_dG, 'n2')}</dd>
              </div>
            </dl>
            <figcaption>
              <b>{t('home.figure.label')}</b>
              {t('home.figure.caption', {
                g0: cover.e0.spec.params.G,
                g1: cover.e1.spec.params.G,
                y0: cover.e0.equilibrium.Y,
                y1: cover.e1.equilibrium.Y,
                i0: cover.e0.equilibrium.i,
                i1: cover.e1.equilibrium.i,
                crowd: cover.e1.multipliers.crowdingOutShare * 100,
              })}
            </figcaption>
          </figure>
        )}
      </section>

      <section aria-labelledby="home-modules">
        <h3 id="home-modules" className="home-h">
          {t('home.modules')}
        </h3>
        <div className="toc">
          {GROUPS.map((g) => (
            <div className="toc-group" key={g.id}>
              <header>
                <h4>{t(`group.${g.id}`)}</h4>
              </header>
              <ul className="toc-list">
                {g.modules.map((m) => (
                  <li key={m}>
                    <button className="toc-entry" onClick={() => onOpen(m)}>
                      <span className="mod-letter">{LETTER[m]}</span>
                      <span className="toc-name">{t(`mod.${m}`)}</span>
                      <span className="toc-open" aria-hidden="true">
                        {t('home.open')} →
                      </span>
                      <span className="toc-desc">{t(`mod.${m}.desc`)}</span>
                      <span className="toc-vars">{t(`home.vars.${m}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="home-notes">
        <div className="home-how" aria-labelledby="home-how">
          <h3 id="home-how" className="home-h">
            {t('home.how.title')}
          </h3>
          <ol>
            <li>{t('home.how.1')}</li>
            <li>{t('home.how.2')}</li>
            <li>{t('home.how.3')}</li>
          </ol>
          <p className="modes">{t('home.modes')}</p>
        </div>
        <div aria-labelledby="home-conv">
          <h3 id="home-conv" className="home-h">
            {t('conv.title')}
          </h3>
          <dl className="conventions">
            <dt>
              <span className="conv-line" style={{ color: 'var(--series-is)' }} />
            </dt>
            <dd>{t('conv.is')}</dd>
            <dt>
              <span className="conv-line" style={{ color: 'var(--series-lm)' }} />
            </dt>
            <dd>{t('conv.lm')}</dd>
            <dt>
              <span className="conv-line" style={{ color: 'var(--series-supply)' }} />
            </dt>
            <dd>{t('conv.supply')}</dd>
            <dt>
              <span className="conv-line" style={{ color: 'var(--series-ext)', borderTopStyle: 'dashed' }} />
            </dt>
            <dd>{t('conv.ext')}</dd>
            <dt>
              <span className="conv-line" style={{ color: 'var(--series-ref)', borderTopStyle: 'dotted' }} />
            </dt>
            <dd>{t('conv.ref')}</dd>
            <dt>
              <span className="conv-ring" />
            </dt>
            <dd>{t('conv.e0')}</dd>
            <dt>
              <span className="conv-dot" />
            </dt>
            <dd>{t('conv.e1')}</dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
