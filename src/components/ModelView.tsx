import katex from 'katex';
import 'katex/dist/katex.min.css';
import { autonomousSpending, determinant, realMoney, type SolvedEconomy } from '../engine';
import { useI18n } from '../i18n';

/** Renders a static, author-controlled TeX string (no user input reaches KaTeX). */
function Tex({ children, inline = false }: { children: string; inline?: boolean }) {
  const html = katex.renderToString(children, { displayMode: !inline, throwOnError: false, strict: 'ignore' });
  return inline ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <div className="eq" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Verifiable academic references (no invented sources). */
const BIBLIOGRAPHY = [
  'Blanchard, O. (2021). Macroeconomics (8th ed.). Pearson. — IS-LM chapters, with the LM curve drawn as a policy-rate line.',
  'Dornbusch, R., Fischer, S., & Startz, R. (2014). Macroeconomics (12th ed.). McGraw-Hill Education.',
  'Galí, J. (2015). Monetary Policy, Inflation, and the Business Cycle: An Introduction to the New Keynesian Framework (2nd ed.). Princeton University Press.',
  'Hansen, A. H. (1953). A Guide to Keynes. McGraw-Hill.',
  'Hicks, J. R. (1937). Mr. Keynes and the "Classics"; A Suggested Interpretation. Econometrica, 5(2), 147–159. https://doi.org/10.2307/1907242',
  'Keynes, J. M. (1936). The General Theory of Employment, Interest and Money. Macmillan.',
  'Krugman, P. R. (1998). It\'s Baaack: Japan\'s Slump and the Return of the Liquidity Trap. Brookings Papers on Economic Activity, 1998(2), 137–205. https://doi.org/10.2307/2534694',
  'Mankiw, N. G. (2019). Macroeconomics (10th ed.). Worth Publishers. — Aggregate Demand I–II chapters (IS-LM model).',
  'Poole, W. (1970). Optimal Choice of Monetary Policy Instruments in a Simple Stochastic Macro Model. Quarterly Journal of Economics, 84(2), 197–216. https://doi.org/10.2307/1883009',
  'Romer, D. (2000). Keynesian Macroeconomics without the LM Curve. Journal of Economic Perspectives, 14(2), 149–169. https://doi.org/10.1257/jep.14.2.149',
  'Sargent, T. J., & Wallace, N. (1975). "Rational" Expectations, the Optimal Monetary Instrument, and the Optimal Money Supply Rule. Journal of Political Economy, 83(2), 241–254. https://doi.org/10.1086/260321',
  'Taylor, J. B. (1993). Discretion versus Policy Rules in Practice. Carnegie-Rochester Conference Series on Public Policy, 39, 195–214. https://doi.org/10.1016/0167-2231(93)90009-L',
  'Woodford, M. (2003). Interest and Prices: Foundations of a Theory of Monetary Policy. Princeton University Press.',
];

export default function ModelView({ e1 }: { e1: SolvedEconomy | null }) {
  const { t, f } = useI18n();
  const p = e1?.spec.params;
  const n = (x: number, fmt = 'n2') => f(x, fmt).replace(/\s/g, '\\,');

  return (
    <article className="doc card" style={{ padding: '20px 24px' }}>
      <h2>{t('doc.title')}</h2>
      <p>{t('doc.lead')}</p>

      <h3>{t('doc.eq.title')}</h3>
      <div className="eq-label">{t('doc.eq.goods')}</div>
      <Tex>{'Y = C + I + G'}</Tex>
      <div className="eq-label">{t('doc.eq.cons')}</div>
      <Tex>{'C = C_0 + c\\,(Y - T), \\qquad 0 \\le c < 1'}</Tex>
      <div className="eq-label">{t('doc.eq.inv')}</div>
      <Tex>{'I = I_0 - b\\,i, \\qquad b \\ge 0'}</Tex>
      <div className="eq-label">{t('doc.eq.money')}</div>
      <Tex>{'\\frac{M}{P} = kY - h\\,i, \\qquad k > 0,\\; h \\ge 0'}</Tex>

      <h3>{t('doc.units.title')}</h3>
      <p>{t('doc.units.text')}</p>
      <Tex>{'[Y],[C],[I],[G],[T],[M/P] = \\text{bn}, \\quad [i] = \\text{pp}, \\quad [b],[h] = \\tfrac{\\text{bn}}{\\text{pp}}, \\quad [c],[k] = 1'}</Tex>

      <h3>{t('doc.is.title')}</h3>
      <p>{t('doc.is.text')}</p>
      <Tex>{'Y = C_0 + c(Y - T) + I_0 - b\\,i + G \\;\\Longrightarrow\\; Y = \\underbrace{\\frac{1}{1-c}}_{\\alpha}\\,(A - b\\,i) \\;\\Longleftrightarrow\\; i = \\frac{A - (1-c)\\,Y}{b}'}</Tex>
      <p>{t('doc.is.slope')}</p>

      <h3>{t('doc.lm.title')}</h3>
      <p>{t('doc.lm.text')}</p>
      <Tex>{'m = kY - h\\,i \\;\\Longrightarrow\\; Y = \\frac{m + h\\,i}{k} \\;\\Longleftrightarrow\\; i = \\frac{kY - m}{h}'}</Tex>
      <p>{t('doc.lm.slope')}</p>

      <h3>{t('doc.eqm.title')}</h3>
      <p>{t('doc.eqm.text')}</p>
      <Tex>{'Y^* = \\frac{h\\,A + b\\,m}{h(1-c) + b\\,k}, \\qquad i^* = \\frac{k\\,A - (1-c)\\,m}{h(1-c) + b\\,k}'}</Tex>
      {p && e1 && e1.spec.regime === 'money-supply' && (
        <>
          <p>{t('doc.eqm.now')}</p>
          <Tex>{`A = ${n(autonomousSpending(p), 'n1')},\\; m = ${n(realMoney(p), 'n1')},\\; D = ${n(determinant(p), 'n3')} \\;\\Rightarrow\\; Y^* = \\frac{${n(p.h, 'n1')}\\cdot ${n(autonomousSpending(p), 'n1')} + ${n(p.b, 'n1')}\\cdot ${n(realMoney(p), 'n1')}}{${n(determinant(p), 'n3')}} = ${n(e1.equilibrium.Y, 'n2')},\\quad i^* = ${n(e1.equilibrium.i, 'n3')}\\%`}</Tex>
        </>
      )}
      {p && e1 && e1.spec.regime === 'interest-target' && (
        <Tex>{`Y^* = \\frac{A - b\\,\\bar{\\imath}}{1-c} = \\frac{${n(autonomousSpending(p), 'n1')} - ${n(p.b, 'n1')}\\cdot ${n(e1.spec.targetRate, 'n2')}}{${n(1 - p.c, 'n2')}} = ${n(e1.equilibrium.Y, 'n2')},\\quad M^* = P\\,(kY^* - h\\,\\bar{\\imath}) = ${n(e1.equilibrium.M, 'n2')}`}</Tex>
      )}

      <h3>{t('doc.mult.title')}</h3>
      <p>{t('doc.mult.text')}</p>
      <Tex>{'\\frac{\\partial Y}{\\partial G} = \\frac{h}{D}, \\quad \\frac{\\partial Y}{\\partial T} = -\\frac{c\\,h}{D}, \\quad \\frac{\\partial Y}{\\partial m} = \\frac{b}{D}, \\quad \\frac{\\partial i}{\\partial G} = \\frac{k}{D}, \\quad \\frac{\\partial i}{\\partial m} = -\\frac{1-c}{D}'}</Tex>
      <Tex>{'\\left.\\frac{dY}{dG}\\right|_{dT = dG} = \\frac{(1-c)\\,h}{D}, \\qquad \\left.\\frac{\\partial Y}{\\partial G}\\right|_{\\bar{\\imath}} = \\frac{1}{1-c}, \\qquad \\left.\\frac{\\partial Y}{\\partial \\bar{\\imath}}\\right| = -\\frac{b}{1-c}'}</Tex>
      <p>{t('doc.mult.limits')}</p>

      <h3>{t('doc.crowd.title')}</h3>
      <p>{t('doc.crowd.text')}</p>
      <Tex>{'\\Delta Y = \\underbrace{\\big[Y_{IS_1}(i_0) - Y_0\\big]}_{\\text{IS shift at } i_0} \\; \\underbrace{-\\,\\alpha_1\\, b_1\\,\\Delta i}_{\\text{interest-rate effect}}, \\qquad \\text{crowding-out share} = \\frac{b\\,k}{h(1-c) + b\\,k}'}</Tex>

      <h3>{t('doc.regime.title')}</h3>
      <p>{t('doc.regime.text1')}</p>
      <p>{t('doc.regime.text2')}</p>
      <Tex>{'i = \\bar{\\imath}, \\qquad Y^* = \\frac{A - b\\,\\bar{\\imath}}{1-c}, \\qquad M^* = P\\,\\big(kY^* - h\\,\\bar{\\imath}\\big) > 0'}</Tex>
      <p>{t('doc.regime.text3')}</p>

      <h3>{t('doc.assume.title')}</h3>
      <ul>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <li key={k}>{t(`doc.assume.${k}`)}</li>
        ))}
      </ul>

      <h3>{t('doc.restrict.title')}</h3>
      <p>{t('doc.restrict.text')}</p>

      <h3>{t('doc.limits.title')}</h3>
      <ul>
        {[1, 2, 3, 4, 5].map((k) => (
          <li key={k}>{t(`doc.limits.${k}`)}</li>
        ))}
      </ul>

      <h3>{t('doc.tests.title')}</h3>
      <p>{t('doc.tests.text')}</p>

      <h3>{t('doc.biblio.title')}</h3>
      <ol className="biblio">
        {BIBLIOGRAPHY.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ol>
    </article>
  );
}
