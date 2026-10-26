import type { Lang2, Topic } from '../data/core';

/**
 * Documented economic episodes of Argentina (2018–2026). Each fact in
 * "context" and "decision" comes from the listed sources (official notices,
 * IMF press releases, the Official Gazette and reputable press); headlines and
 * dates of news items were checked against the articles. "Hypotheses" are
 * explicitly hypotheses; the "evidence" section is computed in the
 * application from official series and is descriptive, not causal.
 */
export type SourceKind = 'official' | 'multilateral' | 'news' | 'analysis';

export interface SourceRef {
  title: string;
  publisher: string;
  /** Publication date, only when verified on the source page. */
  date: string | null;
  url: string;
  kind: SourceKind;
}

export type EpisodeKind = 'rates' | 'fx' | 'imf' | 'controls' | 'shock' | 'debt' | 'markets' | 'trade';

export interface Episode {
  id: string;
  date: string;
  kind: EpisodeKind;
  topics: Topic[];
  title: Lang2;
  context: Lang2;
  decision: Lang2;
  hypotheses: Lang2[];
  interpretation: Lang2;
  /** Series shown as evidence around the date. */
  evidence: string[];
  sources: SourceRef[];
}

const L = (es: string, en: string): Lang2 => ({ es, en });
const RATES_FX = ['ar_tasa_politica', 'ar_badlar', 'ar_tc_mayorista', 'ar_reservas', 'ar_inflacion_mensual', 'us_t2y'];

export const EPISODES: Episode[] = [
  {
    id: '2018-05-tasa-40',
    date: '2018-05-04',
    kind: 'rates',
    topics: ['monetary', 'fx'],
    title: L('Suba de la tasa de política al 40%', 'Policy rate raised to 40%'),
    context: L(
      'Entre fines de abril y comienzos de mayo de 2018 el peso se depreció con rapidez. En su comunicado, el BCRA señaló que la depreciación había sido mayor que la de otras monedas emergentes y que buscaba evitar movimientos disruptivos que afectaran el proceso de desinflación.',
      'Between late April and early May 2018 the peso depreciated quickly. In its notice the BCRA said the depreciation had been larger than that of other emerging-market currencies and that it sought to avoid disruptive moves affecting disinflation.',
    ),
    decision: L(
      'El 4 de mayo de 2018 el BCRA elevó 675 puntos básicos su tasa de política, hasta 40%, amplió el corredor de pases y limitó la posición global neta en moneda extranjera de los bancos (Comunicación A 6501).',
      'On 4 May 2018 the BCRA raised its policy rate by 675 basis points to 40%, widened the repo corridor and capped banks’ net foreign-currency position (Communication A 6501).',
    ),
    hypotheses: [
      L('Una tasa más alta en pesos puede frenar la demanda de dólares si el rendimiento esperado en pesos supera la devaluación esperada más la prima de riesgo.', 'A higher peso rate may curb demand for dollars if the expected peso return exceeds expected depreciation plus the risk premium.'),
      L('Si el mercado interpreta la suba como señal de fragilidad, la salida de capitales puede continuar pese a la tasa.', 'If the market reads the hike as a sign of fragility, capital outflows may continue despite the rate.'),
    ],
    interpretation: L(
      'En una economía abierta con movilidad de capitales, la tasa doméstica compite con la tasa internacional más la devaluación esperada y la prima de riesgo. La evolución posterior del tipo de cambio no aísla el efecto de la tasa: en las semanas siguientes se negoció un acuerdo con el FMI y la sequía reducía las exportaciones.',
      'In an open economy with capital mobility, the domestic rate competes with the world rate plus expected depreciation and the risk premium. The later path of the exchange rate does not isolate the effect of the rate: an IMF agreement was negotiated in the following weeks and the drought was cutting exports.',
    ),
    evidence: RATES_FX,
    sources: [
      { title: 'Medidas del BCRA ante la situación del mercado', publisher: 'BCRA', date: '2018-05-04', url: 'https://www.bcra.gob.ar/noticias/medidas-del-bcra-ante-la-situacion-del-mercado/', kind: 'official' },
      { title: 'El Banco Central subió la tasa de política monetaria a 40%', publisher: 'La Capital (Mar del Plata)', date: '2018-05-04', url: 'https://www.lacapitalmdp.com/el-banco-central-subio-la-tasa-de-politica-monetaria-a-40/', kind: 'news' },
    ],
  },
  {
    id: '2018-06-fmi-sba',
    date: '2018-06-20',
    kind: 'imf',
    topics: ['external', 'fiscal'],
    title: L('Acuerdo stand-by con el FMI por US$50.000 millones', 'US$50 billion IMF Stand-By Arrangement'),
    context: L('Tras la turbulencia cambiaria de mayo, el gobierno solicitó asistencia al FMI.', 'After the May exchange-rate turmoil the government requested IMF assistance.'),
    decision: L(
      'El 20 de junio de 2018 el Directorio del FMI aprobó un acuerdo stand-by a tres años por US$50.000 millones, con US$15.000 millones disponibles de inmediato (comunicado de prensa 18/245).',
      'On 20 June 2018 the IMF Executive Board approved a three-year US$50 billion Stand-By Arrangement, with US$15 billion available immediately (Press Release 18/245).',
    ),
    hypotheses: [
      L('El financiamiento del FMI puede reducir el riesgo de liquidez y, con él, la prima de riesgo exigida a los activos argentinos.', 'IMF financing can reduce liquidity risk and, with it, the risk premium demanded on Argentine assets.'),
    ],
    interpretation: L(
      'Un préstamo multilateral aumenta las reservas disponibles y condiciona la política fiscal y monetaria a metas acordadas. En el modelo, actúa sobre la prima de riesgo y las expectativas, no sobre la tasa internacional.',
      'A multilateral loan raises available reserves and ties fiscal and monetary policy to agreed targets. In the model it works through the risk premium and expectations, not the world interest rate.',
    ),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_tasa_politica', 'us_t10y'],
    sources: [
      { title: 'Argentina: IMF Executive Board Approves US$50 Billion Stand-By Arrangement (Press Release No. 18/245)', publisher: 'Fondo Monetario Internacional', date: '2018-06-20', url: 'https://www.imf.org/en/News/Articles/2018/06/20/pr18245-argentina-imf-executive-board-approves-us50-billion-stand-by-arrangement', kind: 'multilateral' },
      { title: "IMF Board Approves Argentina's $50 Billion Stand-By Accord", publisher: 'Bloomberg', date: '2018-06-20', url: 'https://www.bloomberg.com/news/articles/2018-06-20/imf-board-approves-argentina-s-50-billion-stand-by-arrangement', kind: 'news' },
    ],
  },
  {
    id: '2018-08-tasa-60',
    date: '2018-08-30',
    kind: 'rates',
    topics: ['monetary', 'fx'],
    title: L('Tasa de política al 60%', 'Policy rate at 60%'),
    context: L('A fines de agosto de 2018 el peso volvió a depreciarse con fuerza; la inflación interanual rondaba el 31% en julio, según Reuters.', 'In late August 2018 the peso again depreciated sharply; year-on-year inflation was about 31% in July, according to Reuters.'),
    decision: L(
      'El 30 de agosto de 2018 el BCRA elevó la tasa de política de 45% a 60% en una reunión extraordinaria y subió 5 puntos los encajes de los bancos más grandes. Ese día el peso cayó 15,8%, según Reuters.',
      'On 30 August 2018 the BCRA raised the policy rate from 45% to 60% at an extraordinary meeting and raised reserve requirements of the largest banks by 5 points. The peso fell 15.8% that day, according to Reuters.',
    ),
    hypotheses: [
      L('Con expectativas de devaluación muy altas, incluso una tasa de 60% puede no compensar el riesgo percibido de mantener pesos.', 'With very high expected depreciation, even a 60% rate may not compensate the perceived risk of holding pesos.'),
    ],
    interpretation: L(
      'El episodio ilustra que la eficacia de la tasa depende de la credibilidad y de las expectativas: la paridad de tasas se cumple en términos esperados, no observados.',
      'The episode shows that the effectiveness of the rate depends on credibility and expectations: interest parity holds in expected terms, not observed ones.',
    ),
    evidence: RATES_FX,
    sources: [
      { title: 'Ante una nueva alza del dólar, suben la tasa de referencia al 60 por ciento', publisher: 'La Capital (Rosario)', date: '2018-08-30', url: 'https://www.lacapital.com.ar/economia/ante-una-nueva-alza-del-dolar-suben-la-tasa-referencia-al-60-ciento-n1667204.html', kind: 'news' },
      { title: 'Argentine central bank hikes rate to eye-popping 60 percent, peso plunges', publisher: 'Reuters (vía Business Standard)', date: '2018-08-30', url: 'https://www.business-standard.com/amp/article/reuters/argentine-central-bank-hikes-rate-to-eye-popping-60-percent-peso-plunges-118083001397_1.html', kind: 'news' },
    ],
  },
  {
    id: '2018-10-agregados',
    date: '2018-10-01',
    kind: 'rates',
    topics: ['monetary', 'fx'],
    title: L('Esquema de control de agregados y zona de no intervención', 'Monetary-aggregate targeting and a non-intervention zone'),
    context: L('Tras el acuerdo con el FMI, el BCRA abandonó el esquema de metas de inflación con tasa de interés como instrumento.', 'After the IMF agreement the BCRA abandoned inflation targeting with the interest rate as its instrument.'),
    decision: L(
      'Desde el 1 de octubre de 2018 el BCRA se comprometió a no aumentar la base monetaria hasta junio de 2019, con subastas diarias de LELIQ, y fijó una zona de no intervención cambiaria entre 34 y 44 pesos por dólar, ajustada 3% por mes. La tasa de LELIQ subió a 65% en la puesta en marcha.',
      'From 1 October 2018 the BCRA committed to zero growth of the monetary base until June 2019, implemented through daily LELIQ auctions, and set an exchange-rate non-intervention zone between 34 and 44 pesos per dollar, adjusted 3% per month. The LELIQ rate rose to 65% at launch.',
    ),
    hypotheses: [L('Fijar la cantidad de dinero deja que la tasa de interés se determine en el mercado, como en el IS-LM con oferta monetaria exógena.', 'Fixing the quantity of money lets the interest rate be determined by the market, as in IS-LM with an exogenous money supply.')],
    interpretation: L(
      'El cambio de instrumento corresponde, en el laboratorio, al paso del régimen de tasa fija al de oferta monetaria exógena (Módulo A): la tasa pasa a ser endógena.',
      'The change of instrument corresponds, in the lab, to moving from the interest-rate regime to the exogenous money-supply regime (Module A): the rate becomes endogenous.',
    ),
    evidence: ['ar_tasa_politica', 'ar_base_monetaria', 'ar_tc_mayorista', 'ar_inflacion_mensual'],
    sources: [
      { title: 'Informe de Política Monetaria – octubre 2018', publisher: 'BCRA', date: null, url: 'https://www.bcra.gob.ar/publicaciones/informe-de-politica-monetaria-octubre-2018/', kind: 'official' },
      { title: 'Empezó a regir el nuevo esquema monetario y la tasa de Leliq subió al 65%', publisher: 'El Economista', date: '2018-09-28', url: 'https://eleconomista.com.ar/economia/empezo-regir-nuevo-esquema-monetario-tasa-leliq-subio-65-n20845', kind: 'news' },
    ],
  },
  {
    id: '2019-08-paso',
    date: '2019-08-12',
    kind: 'markets',
    topics: ['fx', 'monetary'],
    title: L('Caída del peso tras las elecciones primarias', 'Peso slump after the primary elections'),
    context: L('Las elecciones primarias del 11 de agosto de 2019 dieron un resultado que los mercados no esperaban.', 'The 11 August 2019 primary elections produced a result markets did not expect.'),
    decision: L(
      'El lunes 12 de agosto el peso se desplomó y las acciones cayeron fuertemente; el BCRA elevó la tasa de LELIQ más de 10 puntos, a alrededor de 74%, y vendió reservas.',
      'On Monday 12 August the peso collapsed and stocks fell sharply; the BCRA raised the LELIQ rate by more than 10 points, to about 74%, and sold reserves.',
    ),
    hypotheses: [L('El shock fue de expectativas políticas y de riesgo soberano, no un cambio en los fundamentos de un día para el otro.', 'The shock was to political expectations and sovereign risk, not an overnight change in fundamentals.')],
    interpretation: L('Un aumento de la prima de riesgo desplaza la condición de paridad: a igual tasa doméstica, el tipo de cambio debe depreciarse.', 'A higher risk premium shifts the parity condition: at the same domestic rate, the exchange rate must depreciate.'),
    evidence: RATES_FX,
    sources: [
      { title: 'Black Monday: Peso slumps to 60 per dollar in some banks, MERVAL collapses', publisher: 'Buenos Aires Times', date: '2019-08-12', url: 'https://batimes.com.ar/news/economy/black-monday-dollar-at-record-58-pesos.phtml', kind: 'news' },
    ],
  },
  {
    id: '2019-09-controles',
    date: '2019-09-01',
    kind: 'controls',
    topics: ['fx', 'external'],
    title: L('Restablecimiento de controles cambiarios', 'Exchange controls reinstated'),
    context: L('Después de las primarias continuó la caída de reservas.', 'After the primaries reserves kept falling.'),
    decision: L(
      'El Decreto 609/2019 y la Comunicación A 6770 del BCRA, vigentes desde el 1 de septiembre de 2019, obligaron a liquidar exportaciones en el mercado local y exigieron autorización para ciertas operaciones, como el giro de utilidades al exterior.',
      'Decree 609/2019 and BCRA Communication A 6770, effective 1 September 2019, required export proceeds to be sold locally and prior authorisation for some operations, such as remitting profits abroad.',
    ),
    hypotheses: [L('Con controles, la movilidad de capitales deja de ser perfecta y el tipo de cambio oficial puede diferir de otras cotizaciones.', 'Under controls capital mobility is no longer perfect and the official rate can diverge from other quotes.')],
    interpretation: L('Los controles rompen el supuesto de movilidad perfecta de capitales del Mundell-Fleming del laboratorio; la tasa doméstica deja de estar atada a la internacional.', 'Controls break the lab’s Mundell-Fleming assumption of perfect capital mobility; the domestic rate is no longer tied to the world rate.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_tasa_politica', 'ar_inflacion_mensual'],
    sources: [
      { title: 'Comunicación "A" 6770', publisher: 'BCRA', date: '2019-09-01', url: 'https://www.bcra.gob.ar/Pdfs/comytexord/A6770.pdf', kind: 'official' },
    ],
  },
  {
    id: '2019-10-cupo-200',
    date: '2019-10-28',
    kind: 'controls',
    topics: ['fx'],
    title: L('Cupo de US$200 mensuales para personas', 'US$200 monthly limit for individuals'),
    context: L('Tras las elecciones generales continuó la demanda de dólares para atesoramiento.', 'After the general election demand for dollars for saving continued.'),
    decision: L('La Comunicación A 6815 redujo desde el 28 de octubre de 2019 el límite de compra de moneda extranjera para personas de US$10.000 a US$200 por mes.', 'Communication A 6815 cut, from 28 October 2019, the foreign-currency purchase limit for individuals from US$10,000 to US$200 a month.'),
    hypotheses: [L('Restringir la compra en el mercado oficial traslada la demanda a mercados alternativos, donde la cotización puede separarse de la oficial.', 'Restricting purchases in the official market shifts demand to alternative markets, where quotes can diverge from the official rate.')],
    interpretation: L('El tipo de cambio oficial pasa a reflejar un mercado racionado; las series oficiales no muestran la brecha con cotizaciones paralelas.', 'The official rate reflects a rationed market; official series do not show the gap with parallel quotes.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_inflacion_mensual'],
    sources: [{ title: 'Comunicación "A" 6815', publisher: 'BCRA', date: '2019-10-28', url: 'https://www.bcra.gob.ar/Pdfs/comytexord/A6815.pdf', kind: 'official' }],
  },
  {
    id: '2020-03-aspo',
    date: '2020-03-20',
    kind: 'shock',
    topics: ['activity', 'external'],
    title: L('Aislamiento obligatorio por la pandemia de COVID-19', 'Mandatory lockdown during the COVID-19 pandemic'),
    context: L('La OMS declaró la pandemia el 11 de marzo de 2020.', 'The WHO declared the pandemic on 11 March 2020.'),
    decision: L('El Decreto 297/2020, publicado en el Boletín Oficial el 20 de marzo de 2020, estableció el aislamiento social, preventivo y obligatorio, con excepciones para actividades esenciales.', 'Decree 297/2020, published in the Official Gazette on 20 March 2020, established mandatory social isolation, with exemptions for essential activities.'),
    hypotheses: [L('Es un shock de oferta y de demanda simultáneo: cae la producción posible y también el gasto.', 'It is a simultaneous supply and demand shock: potential output and spending both fall.')],
    interpretation: L('En OA-DA, el producto puede caer con presiones de precios ambiguas; el modelo estático no captura la reapertura gradual.', 'In AD-AS output can fall with ambiguous price pressures; the static model does not capture the gradual reopening.'),
    evidence: ['ar_emae', 'ar_x', 'ar_m', 'ar_inflacion_mensual', 'us_fed_upper'],
    sources: [{ title: 'Decreto 297/2020 – Aislamiento social preventivo y obligatorio', publisher: 'Boletín Oficial de la República Argentina', date: '2020-03-20', url: 'https://www.boletinoficial.gob.ar/detalleAviso/primera/227042/20200320', kind: 'official' }],
  },
  {
    id: '2020-08-canje-deuda',
    date: '2020-08-31',
    kind: 'debt',
    topics: ['fiscal', 'external'],
    title: L('Reestructuración de la deuda en moneda extranjera', 'Foreign-currency debt restructuring'),
    context: L('Argentina negociaba con acreedores privados la deuda emitida bajo ley extranjera.', 'Argentina was negotiating its foreign-law debt with private creditors.'),
    decision: L('El canje cerró el 28 de agosto de 2020 con una adhesión de 93,55% y, por las cláusulas de acción colectiva, se reestructuró el 99,01% de los bonos elegibles.', 'The exchange closed on 28 August 2020 with 93.55% participation; through collective-action clauses 99.01% of eligible bonds were restructured.'),
    hypotheses: [L('Reducir los vencimientos de corto plazo baja el riesgo de impago, aunque el acceso al crédito depende también de la política macroeconómica posterior.', 'Lowering near-term maturities reduces default risk, although market access also depends on later macro policy.')],
    interpretation: L('La reestructuración modifica la restricción presupuestaria intertemporal del gobierno, que los modelos estáticos del laboratorio no incluyen.', 'The restructuring changes the government’s intertemporal budget constraint, which the lab’s static models do not include.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_resultado_primario'],
    sources: [
      { title: 'Cierre del canje de deuda soberana bajo ley extranjera: se reestructuró el 99% de los bonos', publisher: 'Marval O’Farrell Mairal', date: '2020-09-02', url: 'https://www.marval.com/Publicacion/cierre-del-canje-de-deuda-soberana-bajo-ley-extranjera-se-reestructuro-el-99-de-los-bonos-13770?lang=es', kind: 'analysis' },
      { title: 'Argentina canjeó el 99% de su deuda externa', publisher: 'El Observador', date: '2020-08-31', url: 'https://www.elobservador.com.uy/nota/argentina-canjeo-el-99-de-su-deuda-externa-202083118021', kind: 'news' },
    ],
  },
  {
    id: '2020-09-cepo',
    date: '2020-09-15',
    kind: 'controls',
    topics: ['fx'],
    title: L('Endurecimiento de los controles: percepción del 35%', 'Tighter controls: 35% surcharge'),
    context: L('Las reservas seguían bajo presión pese a la reestructuración de deuda.', 'Reserves remained under pressure despite the debt restructuring.'),
    decision: L('Desde mediados de septiembre de 2020 las compras de moneda extranjera para atesoramiento quedaron sujetas a una percepción del 35% adicional al impuesto PAIS del 30%, y los consumos con tarjeta en moneda extranjera pasaron a descontarse del cupo mensual (Comunicación A 7106 y normas de AFIP).', 'From mid-September 2020 foreign-currency purchases for saving were subject to a 35% surcharge on top of the 30% PAIS tax, and card spending in foreign currency counted towards the monthly limit (Communication A 7106 and tax rules).'),
    hypotheses: [L('Encarecer el acceso al dólar oficial reduce la demanda registrada, pero amplía la diferencia con otras cotizaciones.', 'Making official dollars more expensive reduces recorded demand but widens the gap with other quotes.')],
    interpretation: L('Los impuestos sobre la compra de divisas generan múltiples tipos de cambio efectivos; la serie mayorista no los incluye.', 'Taxes on foreign-currency purchases create multiple effective exchange rates; the wholesale series excludes them.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_inflacion_mensual'],
    sources: [
      { title: 'Comunicación "A" 7106', publisher: 'BCRA', date: '2020-09-15', url: 'https://www.bcra.gob.ar/Pdfs/comytexord/A7106.pdf', kind: 'official' },
      { title: 'Nuevo cepo al dólar: todo lo que tenés que saber', publisher: 'Diario de Cuyo', date: '2020-09-16', url: 'https://diariodecuyo.com.ar/economia/Nuevo-cepo-al-dolar-todo-lo-que-tenes-que-saber-20200916-0020.html', kind: 'news' },
    ],
  },
  {
    id: '2023-08-devaluacion',
    date: '2023-08-14',
    kind: 'fx',
    topics: ['fx', 'monetary', 'prices'],
    title: L('Devaluación posterior a las primarias y tasa de 118%', 'Post-primary devaluation and a 118% rate'),
    context: L('Tras las elecciones primarias del 13 de agosto de 2023 el gobierno recalibró el tipo de cambio oficial.', 'After the 13 August 2023 primaries the government recalibrated the official exchange rate.'),
    decision: L('El 14 de agosto de 2023 el tipo de cambio mayorista oficial saltó alrededor de 22% y el BCRA elevó 21 puntos la tasa de LELIQ a 28 días, hasta 118% nominal anual (alrededor de 209% efectivo anual).', 'On 14 August 2023 the official wholesale exchange rate jumped about 22% and the BCRA raised the 28-day LELIQ rate by 21 points to 118% nominal (about 209% effective).'),
    hypotheses: [L('Una devaluación discreta se traslada a precios en los meses siguientes (pass-through), en especial con expectativas de inflación altas.', 'A discrete devaluation passes through to prices in the following months, especially with high inflation expectations.')],
    interpretation: L('El comunicado del BCRA vinculó la suba de tasas con anclar expectativas y limitar el traslado a precios. La inflación mensual de los meses siguientes muestra el orden de magnitud del traslado, sin aislarlo de otros factores.', 'The BCRA notice linked the hike to anchoring expectations and limiting pass-through. Monthly inflation in the following months shows the order of magnitude of pass-through, without isolating it from other factors.'),
    evidence: RATES_FX,
    sources: [
      { title: 'El BCRA incrementó la tasa de política monetaria', publisher: 'BCRA', date: '2023-08-14', url: 'https://www.bcra.gob.ar/noticias/el-bcra-incremento-la-tasa-de-politica-monetaria-2/', kind: 'official' },
      { title: 'Plazo fijo: el Banco Central sube la tasa 21 puntos hasta el 118%', publisher: 'Tiempo de San Juan', date: '2023-08-14', url: 'https://www.tiempodesanjuan.com/economia/plazo-fijo-el-banco-central-sube-la-tasa-21-puntos-el-118-n356028', kind: 'news' },
    ],
  },
  {
    id: '2023-12-devaluacion',
    date: '2023-12-13',
    kind: 'fx',
    topics: ['fx', 'fiscal', 'prices'],
    title: L('Devaluación a 800 pesos y deslizamiento de 2% mensual', 'Devaluation to 800 pesos and a 2% monthly crawl'),
    context: L('El nuevo gobierno asumió el 10 de diciembre de 2023 y anunció un programa de estabilización con ajuste fiscal.', 'The new government took office on 10 December 2023 and announced a stabilisation programme with fiscal tightening.'),
    decision: L('El 12 de diciembre el ministro de Economía anunció que el tipo de cambio oficial pasaría a 800 pesos por dólar (desde alrededor de 350) y que luego se ajustaría alrededor de 2% por mes; el paquete incluía un recorte del déficit fiscal.', 'On 12 December the economy minister announced the official rate would move to 800 pesos per dollar (from about 350) and then crawl about 2% a month; the package included a fiscal-deficit cut.'),
    hypotheses: [L('Con inflación mensual muy superior al 2%, un deslizamiento de 2% implica una apreciación real progresiva.', 'With monthly inflation far above 2%, a 2% crawl implies a progressive real appreciation.')],
    interpretation: L('Puede contrastarse con el índice de tipo de cambio real multilateral: el salto nominal eleva el tipo de cambio real y la inflación posterior lo erosiona.', 'It can be checked against the multilateral real exchange-rate index: the nominal jump raises the real rate and later inflation erodes it.'),
    evidence: ['ar_tc_mayorista', 'ar_itcrm', 'ar_inflacion_mensual', 'ar_reservas', 'ar_resultado_primario'],
    sources: [
      { title: 'Dólar: qué es el "crawling peg", cómo funciona y qué anunció el gobierno de Javier Milei', publisher: 'Chequeado', date: '2024-02-05', url: 'https://chequeado.com/el-explicador/dolar-que-es-el-crawling-peg-y-como-funciona-en-la-argentina-y-en-otros-paises/', kind: 'analysis' },
    ],
  },
  {
    id: '2023-12-pases',
    date: '2023-12-18',
    kind: 'rates',
    topics: ['monetary'],
    title: L('Nueva tasa de política: pases pasivos a 1 día', 'New policy rate: overnight reverse repos'),
    context: L('El BCRA buscaba simplificar su señal de tasas tras la devaluación.', 'The BCRA sought to simplify its interest-rate signal after the devaluation.'),
    decision: L('El 18 de diciembre de 2023 el BCRA dispuso que la tasa de política pasara a ser la de pases pasivos a 1 día (100% nominal anual) y dejó de licitar LELIQ.', 'On 18 December 2023 the BCRA made the overnight reverse-repo rate (100% nominal) its policy rate and stopped auctioning LELIQ.'),
    hypotheses: [L('Una tasa nominal inferior a la inflación implica una tasa real negativa, que reduce el peso real de los pasivos remunerados del BCRA.', 'A nominal rate below inflation implies a negative real rate, which reduces the real burden of the BCRA’s interest-bearing liabilities.')],
    interpretation: L('El instrumento de la serie de tasa de política cambia en esta fecha; comparar niveles antes y después exige tener en cuenta el cambio de instrumento.', 'The instrument behind the policy-rate series changes on this date; comparing levels before and after requires accounting for the change.'),
    evidence: ['ar_tasa_politica', 'ar_badlar', 'ar_inflacion_mensual', 'ar_base_monetaria'],
    sources: [
      { title: 'Nueva tasa de política monetaria y esquema de gestión de liquidez', publisher: 'BCRA', date: '2023-12-18', url: 'https://www.bcra.gob.ar/noticias/nueva-tasa-de-politica-monetaria-y-esquema-de-gestion-de-liquidez/', kind: 'official' },
      { title: 'El Banco Central deja de emitir Leliq y baja las tasas de interés', publisher: 'La Nación', date: '2023-12-18', url: 'https://lanacion.com.ar/economia/el-banco-central-deja-de-emitir-leliq-y-baja-las-tasas-de-interes-nid18122023', kind: 'news' },
    ],
  },
  {
    id: '2024-05-tasa-40',
    date: '2024-05-14',
    kind: 'rates',
    topics: ['monetary', 'prices'],
    title: L('Recortes de tasa con desaceleración de la inflación', 'Rate cuts as inflation slowed'),
    context: L('La inflación mensual de abril de 2024 se desaceleró a 8,8%, según INDEC.', 'Monthly inflation slowed to 8.8% in April 2024, according to INDEC.'),
    decision: L('El 14 de mayo de 2024 el BCRA redujo la tasa de pases pasivos a 1 día a 40% nominal anual; cinco semanas antes estaba en 80%.', 'On 14 May 2024 the BCRA cut the overnight reverse-repo rate to 40% nominal; five weeks earlier it had been 80%.'),
    hypotheses: [L('Si la inflación cae más rápido que la tasa nominal, la tasa real sube aunque la nominal baje.', 'If inflation falls faster than the nominal rate, the real rate rises even as the nominal rate falls.')],
    interpretation: L('El IS-MP del laboratorio muestra por qué importa la tasa real (i − πᵉ) y no la nominal para la demanda agregada.', 'The lab’s IS-MP shows why the real rate (i − πᵉ), not the nominal one, matters for aggregate demand.'),
    evidence: ['ar_tasa_politica', 'ar_inflacion_mensual', 'ar_inflacion_esperada', 'ar_emae', 'ar_tc_mayorista'],
    sources: [
      { title: 'The BCRA lowers the monetary policy rate and tightens control over monetary programming', publisher: 'BCRA', date: '2024-05-14', url: 'https://www.bcra.gob.ar/en/news/el-bcra-bajo-la-tasa-de-politica-monetaria-y-refuerza-el-control-sobre-la-programacion-monetaria', kind: 'official' },
      { title: 'BCRA volvió a bajar la tasa de política monetaria: la llevó al 40%', publisher: 'Bloomberg Línea', date: '2024-05-14', url: 'https://www.bloomberglinea.com/latinoamerica/argentina/bcra-volvio-a-bajar-la-tasa-de-politica-monetaria-y-la-llevo-al-40/', kind: 'news' },
    ],
  },
  {
    id: '2025-04-bandas',
    date: '2025-04-14',
    kind: 'imf',
    topics: ['fx', 'external', 'monetary'],
    title: L('Nuevo acuerdo con el FMI y bandas cambiarias', 'New IMF arrangement and exchange-rate bands'),
    context: L('El 11 de abril de 2025 el FMI aprobó un acuerdo de Facilidades Extendidas a 48 meses por unos US$20.000 millones, con un desembolso inmediato de unos US$12.000 millones (comunicado 25/101).', 'On 11 April 2025 the IMF approved a 48-month Extended Fund Facility of about US$20 billion, with an immediate disbursement of about US$12 billion (Press Release 25/101).'),
    decision: L('El BCRA inició la «Fase 3» del programa: el tipo de cambio pasó a flotar dentro de una banda entre 1.000 y 1.400 pesos por dólar, ampliada 1% por mes, y se eliminaron las restricciones cambiarias para personas humanas y el esquema de liquidación de exportaciones conocido como «dólar blend».', 'The BCRA started “Phase 3” of the programme: the peso floated within a band between 1,000 and 1,400 pesos per dollar, widened 1% a month, and exchange restrictions for individuals and the export-settlement scheme known as the “blend dollar” were removed.'),
    hypotheses: [L('Con mayor flexibilidad cambiaria, los shocks se absorben más por el tipo de cambio y menos por las reservas.', 'With more exchange-rate flexibility, shocks are absorbed more by the exchange rate and less by reserves.')],
    interpretation: L('En el Mundell-Fleming del laboratorio, pasar de tipo fijo a flotación cambia qué variable se ajusta ante un shock: con tipo flexible la cantidad de dinero queda bajo control del banco central y el tipo de cambio absorbe el ajuste.', 'In the lab’s Mundell-Fleming, moving from a peg to a float changes which variable adjusts to a shock: under a float the central bank controls money and the exchange rate absorbs the adjustment.'),
    evidence: ['ar_tc_mayorista', 'ar_reservas', 'ar_badlar', 'ar_inflacion_mensual', 'ar_itcrm'],
    sources: [
      { title: 'Argentina: IMF Executive Board Approves 48-Month US$20 Billion Extended Arrangement (Press Release No. 25/101)', publisher: 'Fondo Monetario Internacional', date: '2025-04-12', url: 'https://www.imf.org/en/news/articles/2025/04/12/pr25101-argentina-imf-executive-board-approves-48-month-usd20-billion-extended-arrangement', kind: 'multilateral' },
      { title: 'Inicio de la Fase 3 del Programa Económico con flexibilización cambiaria y flotación entre bandas', publisher: 'BCRA', date: '2025-04-11', url: 'https://www.bcra.gob.ar/noticias/inicio-de-la-fase-3-del-programa-economico/', kind: 'official' },
      { title: 'Nuevo plan económico: el BCRA anunció que se levanta el cepo y el dólar flotará entre $1.000 y $1.400', publisher: 'Tiempo de San Juan', date: '2025-04-11', url: 'https://www.tiempodesanjuan.com/politica/nuevo-plan-economico-el-bcra-anuncio-que-se-levanta-el-cepo-y-el-dolar-flotara-1000-y-1400-n399648', kind: 'news' },
      { title: "Argentina's US$20 billion IMF deal gets go-ahead from board", publisher: 'Buenos Aires Herald', date: '2025-04-12', url: 'https://buenosairesherald.com/economics/argentinas-us20-billion-imf-deal-gets-go-ahead-from-board', kind: 'news' },
    ],
  },
  {
    id: '2025-07-fin-lefi',
    date: '2025-07-10',
    kind: 'rates',
    topics: ['monetary'],
    title: L('Fin de las LEFI y de la tasa de política', 'End of LEFI and of the policy rate'),
    context: L('En junio de 2025 el BCRA anunció que dejaría de ofrecer las Letras Fiscales de Liquidez (LEFI) a los bancos.', 'In June 2025 the BCRA announced it would stop offering Fiscal Liquidity Notes (LEFI) to banks.'),
    decision: L('Desde el 10 de julio de 2025 el BCRA dejó de ofrecer LEFI y dejó de fijar una tasa de política; las tasas pasaron a determinarse en el mercado. La serie oficial de tasa de política del BCRA termina en esa fecha.', 'From 10 July 2025 the BCRA stopped offering LEFI and no longer set a policy rate; rates became market-determined. The BCRA’s official policy-rate series ends on that date.'),
    hypotheses: [L('El exceso de liquidez de los bancos al vencer las LEFI presionó a la baja las tasas de corto plazo en los primeros días y luego el Tesoro y el BCRA absorbieron pesos.', 'Banks’ excess liquidity when LEFI matured pushed short rates down at first; later the Treasury and the BCRA absorbed pesos.')],
    interpretation: L('Corresponde a un régimen de agregados en el que la tasa es endógena; la volatilidad de las tasas de mercado (pases entre terceros, BADLAR, TAMAR) aumenta.', 'It corresponds to an aggregates regime with an endogenous rate; market-rate volatility (third-party repos, BADLAR, TAMAR) increases.'),
    evidence: ['ar_pases_terceros', 'ar_badlar', 'ar_tamar', 'ar_base_monetaria', 'ar_tc_mayorista'],
    sources: [
      { title: 'Informe Monetario Mensual – julio de 2025', publisher: 'BCRA', date: null, url: 'https://www.bcra.gob.ar/publicaciones/informe-monetario-mensual-julio-de-2025/', kind: 'official' },
      { title: 'El BCRA deja de ofrecer LEFI y canjea por Lecaps: cómo afectará este cambio clave', publisher: 'DolarHoy', date: '2025-06-10', url: 'https://dolarhoy.com/economia/bcra-reconfigura-tasas-fin-de-lefi-y-nuevas-lecaps-2025610153814', kind: 'news' },
    ],
  },
  {
    id: '2025-10-swap-eeuu',
    date: '2025-10-20',
    kind: 'fx',
    topics: ['fx', 'external', 'international'],
    title: L('Acuerdo de estabilización cambiaria con el Tesoro de EE.UU.', 'Exchange-rate stabilisation agreement with the U.S. Treasury'),
    context: L('En octubre de 2025, antes de las elecciones legislativas, el peso estaba bajo presión. El 9 de octubre el Tesoro de EE.UU. informó que había comprado pesos y acordado el marco de un swap.', 'In October 2025, ahead of the midterm elections, the peso was under pressure. On 9 October the U.S. Treasury said it had bought pesos and agreed the framework of a swap.'),
    decision: L('El 20 de octubre de 2025 el BCRA informó la firma de un acuerdo con el Departamento del Tesoro de EE.UU. por hasta US$20.000 millones para operaciones de swap de monedas.', 'On 20 October 2025 the BCRA announced it had signed an agreement with the U.S. Department of the Treasury for up to US$20 billion in currency-swap operations.'),
    hypotheses: [L('Una línea de financiamiento externo puede reducir la percepción de riesgo cambiario aunque no se utilice.', 'An external credit line can lower perceived exchange-rate risk even if unused.')],
    interpretation: L('Las reservas brutas pueden no reflejar una línea de swap no utilizada; la serie oficial es de reservas brutas.', 'Gross reserves may not reflect an unused swap line; the official series is gross reserves.'),
    evidence: ['ar_tc_mayorista', 'ar_reservas', 'ar_badlar', 'us_t2y'],
    sources: [
      { title: 'The BCRA and the U.S. Department of the Treasury sign a USD20 billion agreement for exchange rate stabilization', publisher: 'BCRA', date: '2025-10-20', url: 'https://www.bcra.gob.ar/en/news/el-bcra-y-el-departamento-del-tesoro-de-los-estados-unidos-firman-un-acuerdo-de-estabilizacion-cambiaria-por-usd-20-000-millones/', kind: 'official' },
      { title: 'Argentina’s central bank says it signed $20bn currency swap deal with US', publisher: 'Al Jazeera', date: '2025-10-20', url: 'https://www.aljazeera.com/economy/2025/10/20/argentinas-central-bank-says-it-signed-20bn-currency-swap-deal-with-us', kind: 'news' },
    ],
  },
  {
    id: '2025-10-elecciones',
    date: '2025-10-27',
    kind: 'markets',
    topics: ['fx', 'monetary'],
    title: L('Reacción de los mercados tras las elecciones legislativas', 'Market reaction after the midterm elections'),
    context: L('El oficialismo ganó las elecciones legislativas del 26 de octubre de 2025.', 'The governing party won the 26 October 2025 midterm elections.'),
    decision: L('El lunes 27 de octubre subieron con fuerza los bonos y las acciones argentinas y el peso se apreció, según la cobertura de prensa.', 'On Monday 27 October Argentine bonds and stocks rallied strongly and the peso appreciated, according to press coverage.'),
    hypotheses: [L('Una caída del riesgo político reduce la prima de riesgo y la devaluación esperada.', 'Lower political risk reduces the risk premium and expected depreciation.')],
    interpretation: L('En términos de paridad de tasas, una menor prima de riesgo permite un tipo de cambio más apreciado a igual tasa doméstica.', 'In interest-parity terms, a lower risk premium allows a stronger exchange rate at the same domestic rate.'),
    evidence: ['ar_tc_mayorista', 'ar_badlar', 'ar_reservas'],
    sources: [
      { title: "Argentina's Markets Surge as Milei Win Eases Fear of a Crisis", publisher: 'Bloomberg Law', date: '2025-10-27', url: 'https://news.bloomberglaw.com/bankruptcy-law/argentina-investors-brace-for-rally-after-milei-landslide-win', kind: 'news' },
      { title: 'La bolsa, el peso y los bonos de Argentina se disparan tras la victoria electoral de Javier Milei', publisher: 'Valora Analitik', date: '2025-10-27', url: 'https://www.valoraanalitik.com/la-bolsa-el-peso-y-los-bonos-de-argentina-se-disparan-tras-la-victoria-electoral-de-javier-milei/', kind: 'news' },
    ],
  },
  {
    id: '2026-01-bandas-inflacion',
    date: '2026-01-01',
    kind: 'fx',
    topics: ['fx', 'monetary', 'external'],
    title: L('Bandas indexadas por inflación y programa de compra de reservas', 'Inflation-indexed bands and a reserve-purchase programme'),
    context: L('En diciembre de 2025 el BCRA anunció una nueva etapa del programa monetario.', 'In December 2025 the BCRA announced a new stage of its monetary programme.'),
    decision: L('Desde el 1 de enero de 2026 los límites de la banda cambiaria se ajustan cada mes según el último dato de inflación mensual del INDEC (con dos meses de rezago), en lugar de 1% fijo, y el BCRA inició un programa de acumulación de reservas.', 'From 1 January 2026 the band limits move each month with the latest INDEC monthly inflation figure (two-month lag) instead of a fixed 1%, and the BCRA began a reserve-accumulation programme.'),
    hypotheses: [L('Indexar la banda evita que su techo se aprecie en términos reales cuando la inflación supera el ritmo fijo de ajuste.', 'Indexing the band prevents its ceiling from appreciating in real terms when inflation exceeds the fixed crawl.')],
    interpretation: L('Las compras de divisas del banco central expanden la base monetaria salvo que se esterilicen; la serie de reservas permite seguir su evolución.', 'Central-bank FX purchases expand the monetary base unless sterilised; the reserves series tracks their evolution.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_base_monetaria', 'ar_inflacion_mensual'],
    sources: [
      { title: 'Profundización del esquema de agregados monetarios: fase de re-monetización 2026', publisher: 'BCRA', date: '2025-12-15', url: 'https://www.bcra.gob.ar/politica-monetaria/profundizacion-del-esquema-de-agregados-monetarios-fase-de-re-monetizacion-2026/', kind: 'official' },
      { title: 'BCRA anuncia cambios en el ritmo al que ajustan las bandas y un programa de acumulación de reservas', publisher: 'Bloomberg Línea', date: '2025-12-15', url: 'https://www.bloomberglinea.com/latinoamerica/argentina/bcra-anuncia-cambios-en-el-ritmo-al-que-ajustan-las-bandas-y-un-programa-de-acumulacion-de-reservas/', kind: 'news' },
      { title: 'El Banco Central modificará las bandas de flotación del dólar a partir de enero: se actualizarán por inflación', publisher: 'Infobae', date: '2025-12-15', url: 'https://www.infobae.com/economia/2025/12/15/el-banco-central-modificara-las-bandas-de-flotacion-del-dolar-a-partir-de-enero-se-actualizaran-por-inflacion/', kind: 'news' },
    ],
  },
  {
    id: '2026-05-fmi-revision',
    date: '2026-05-21',
    kind: 'imf',
    topics: ['external', 'fiscal'],
    title: L('Segunda revisión del acuerdo con el FMI', 'Second review of the IMF arrangement'),
    context: L('El 15 de abril de 2026 el FMI anunció un acuerdo técnico sobre la segunda revisión.', 'On 15 April 2026 the IMF announced a staff-level agreement on the second review.'),
    decision: L('El 21 de mayo de 2026 el Directorio del FMI completó la segunda revisión del acuerdo de Facilidades Extendidas, con un desembolso de alrededor de US$1.000 millones, y concluyó la consulta del Artículo IV de 2026 (comunicado 26/165). La meta de reservas netas de fin de diciembre no se había cumplido.', 'On 21 May 2026 the IMF Board completed the second review of the Extended Arrangement, disbursing about US$1 billion, and concluded the 2026 Article IV consultation (Press Release 26/165). The end-December net-reserves target had been missed.'),
    hypotheses: [L('El cumplimiento de metas fiscales y de reservas condiciona los desembolsos y la percepción de riesgo.', 'Meeting fiscal and reserve targets conditions disbursements and risk perception.')],
    interpretation: L('El laboratorio no modela restricciones de financiamiento externo; el episodio sirve para discutir por qué las reservas importan más allá del modelo.', 'The lab does not model external financing constraints; the episode helps discuss why reserves matter beyond the model.'),
    evidence: ['ar_reservas', 'ar_tc_mayorista', 'ar_resultado_primario'],
    sources: [
      { title: 'IMF Executive Board Completes Second Review of the Extended Arrangement Under the Extended Fund Facility and Concludes 2026 Article IV Consultation with Argentina (Press Release No. 26/165)', publisher: 'Fondo Monetario Internacional', date: '2026-05-21', url: 'https://www.imf.org/en/news/articles/2026/05/21/pr26165-argentina-imf-completes-2nd-rev-of-extended-arr-under-eff-concludes-2026-aiv-consultation', kind: 'multilateral' },
      { title: 'IMF approves second review of Argentina program, unlocking US$1 billion disbursement', publisher: 'MercoPress', date: '2026-04-15', url: 'https://en.mercopress.com/2026/04/15/imf-approves-second-review-of-argentina-program-unlocking-us-1-billion-disbursement', kind: 'news' },
    ],
  },
  {
    id: '2026-10-riesgo',
    date: '2026-10-20',
    kind: 'markets',
    topics: ['international', 'fx'],
    title: L('Suba del riesgo país por encima de 700 puntos', 'Sovereign spread above 700 basis points'),
    context: L('Desde fines de septiembre de 2026 los bonos argentinos en dólares venían cayendo; la prensa atribuyó la baja a factores externos y locales.', 'From late September 2026 Argentine dollar bonds had been falling; the press attributed the decline to external and local factors.'),
    decision: L('El 20 de octubre de 2026 el riesgo país llegó a superar los 700 puntos básicos, su máximo del año, según Infobae.', 'On 20 October 2026 the sovereign spread rose above 700 basis points, its highest of the year, according to Infobae.'),
    hypotheses: [L('Un aumento de la prima de riesgo puede presionar al tipo de cambio y encarecer el financiamiento, aun sin cambios en la política monetaria local.', 'A higher risk premium can pressure the exchange rate and raise financing costs even without changes in local monetary policy.')],
    interpretation: L('El riesgo país (diferencial de rendimiento de bonos en dólares) no es una serie oficial del BCRA ni del INDEC y no se incluye en el observatorio; no debe confundirse con la diferencia entre tasas en pesos y rendimientos del Tesoro de EE.UU.', 'The sovereign spread (yield differential of dollar bonds) is not an official BCRA or INDEC series and is not included in the observatory; it must not be confused with the gap between peso rates and U.S. Treasury yields.'),
    evidence: ['ar_tc_mayorista', 'ar_reservas', 'us_t10y', 'ar_badlar'],
    sources: [
      { title: 'El riesgo país llegó a superar la línea de los 700 puntos básicos tras una nueva caída de los bonos argentinos', publisher: 'Infobae', date: '2026-10-20', url: 'https://www.infobae.com/economia/2026/10/20/el-riesgo-pais-supero-la-linea-de-los-700-puntos-basicos-tras-una-nueva-caida-de-los-bonos-argentinos/', kind: 'news' },
      { title: 'Riesgo país arriba de 600 puntos: dos factores externos y tres locales detrás de la caída de los bonos argentinos', publisher: 'Infobae', date: '2026-09-27', url: 'https://www.infobae.com/economia/2026/09/27/riesgo-pais-arriba-de-600-puntos-dos-factores-externos-y-tres-locales-detras-de-la-caida-de-los-bonos-argentinos/', kind: 'news' },
    ],
  },
];

/** Trade milestones (sector externo). */
export const TRADE_EVENTS: Episode[] = [
  {
    id: 'trade-2018-sequia',
    date: '2018-07-05',
    kind: 'trade',
    topics: ['external', 'activity'],
    title: L('Sequía de la campaña 2017/18', '2017/18 drought'),
    context: L('Una sequía severa afectó la cosecha gruesa de 2017/18.', 'A severe drought hit the 2017/18 main harvest.'),
    decision: L('La Bolsa de Cereales de Buenos Aires informó que la cosecha de soja cerró en 36 millones de toneladas, con pérdidas de alrededor de US$4.200 millones en la campaña, según Ámbito.', 'The Buenos Aires Grain Exchange reported the soybean harvest closed at 36 million tonnes, with losses of about US$4.2 billion, according to Ámbito.'),
    hypotheses: [L('Una caída de la oferta exportable reduce las exportaciones y el ingreso de divisas, con efectos sobre el tipo de cambio y la actividad.', 'Lower exportable supply reduces exports and FX inflows, affecting the exchange rate and activity.')],
    interpretation: L('Es un shock de oferta que, en el Mundell-Fleming, actúa como una caída de las exportaciones autónomas.', 'It is a supply shock that, in Mundell-Fleming, acts like a fall in autonomous exports.'),
    evidence: ['ar_x', 'ar_x_pp', 'ar_x_moa', 'ar_saldo'],
    sources: [{ title: 'Por la sequía, se perdieron u$s 4.200 millones en la cosecha de soja', publisher: 'Ámbito', date: '2018-07-05', url: 'https://www.ambito.com/campo/por-la-sequia-se-perdieron-us-4200-millones-la-cosecha-soja-n4026682/amp', kind: 'news' }],
  },
  {
    id: 'trade-2020-pandemia',
    date: '2020-12-01',
    kind: 'trade',
    topics: ['external'],
    title: L('Comercio exterior durante la pandemia', 'Foreign trade during the pandemic'),
    context: L('En 2020 cayeron tanto las exportaciones como las importaciones.', 'In 2020 both exports and imports fell.'),
    decision: L('En diciembre de 2020 se registró el primer déficit comercial mensual en 27 meses, según El Economista con datos de INDEC.', 'December 2020 showed the first monthly trade deficit in 27 months, according to El Economista with INDEC data.'),
    hypotheses: [L('Un superávit comercial puede surgir de una caída de importaciones por recesión, no de mayor competitividad.', 'A trade surplus can arise from recession-driven import falls rather than greater competitiveness.')],
    interpretation: L('El saldo comercial resume dos flujos con determinantes distintos: la demanda externa y los precios para X; el ingreso doméstico y el tipo de cambio real para M.', 'The trade balance combines two flows with different drivers: foreign demand and prices for X; domestic income and the real exchange rate for M.'),
    evidence: ['ar_x', 'ar_m', 'ar_saldo', 'ar_emae'],
    sources: [{ title: 'Balanza comercial: hubo un déficit de US$ 364 M en diciembre (el primero en 27 meses)', publisher: 'El Economista', date: '2021-01-26', url: 'https://eleconomista.com.ar/economia/balanza-comercial-hubo-deficit-us-364-m-diciembre-el-primero-27-meses-n40850', kind: 'news' }],
  },
  {
    id: 'trade-2023-sequia',
    date: '2023-06-01',
    kind: 'trade',
    topics: ['external', 'activity'],
    title: L('Sequía de 2023 y déficit comercial', '2023 drought and trade deficit'),
    context: L('La sequía de la campaña 2022/23 redujo fuertemente la producción agrícola.', 'The 2022/23 drought sharply reduced agricultural output.'),
    decision: L('El déficit comercial de junio de 2023 fue el más alto desde 2013, según Bloomberg Línea con datos de INDEC.', 'The June 2023 trade deficit was the largest since 2013, according to Bloomberg Línea with INDEC data.'),
    hypotheses: [L('La caída de exportaciones primarias y de manufacturas agropecuarias explica la mayor parte del deterioro del saldo.', 'Lower primary and agricultural-manufacture exports explain most of the deterioration.')],
    interpretation: L('Puede verse en la composición por rubros: productos primarios y MOA caen con la cosecha.', 'Visible in the composition by group: primary products and agricultural manufactures fall with the harvest.'),
    evidence: ['ar_x', 'ar_x_pp', 'ar_x_moa', 'ar_saldo', 'ar_reservas'],
    sources: [{ title: 'Argentina reporta peor déficit comercial mensual desde 2013 y enciende alarmas', publisher: 'Bloomberg Línea', date: '2023-07-19', url: 'https://www.bloomberglinea.com/latinoamerica/argentina/deficit-comercial-de-argentina-en-junio-fue-el-mas-alto-desde-2013-y-enciende-alarmas/', kind: 'news' }],
  },
  {
    id: 'trade-2024-superavit',
    date: '2024-12-01',
    kind: 'trade',
    topics: ['external', 'activity'],
    title: L('Superávit comercial récord de 2024', 'Record 2024 trade surplus'),
    context: L('Tras la sequía se recuperaron las exportaciones agropecuarias y energéticas, mientras las importaciones caían con la recesión.', 'After the drought agricultural and energy exports recovered while imports fell with the recession.'),
    decision: L('Argentina cerró 2024 con un superávit comercial récord, según Bloomberg Línea con datos de INDEC.', 'Argentina closed 2024 with a record trade surplus, according to Bloomberg Línea with INDEC data.'),
    hypotheses: [L('Parte del superávit refleja menores importaciones por la caída de la actividad: no implica por sí mismo mayor bienestar.', 'Part of the surplus reflects lower imports due to weaker activity: it does not by itself imply higher welfare.')],
    interpretation: L('La identidad BC = X − M permite separar cuánto del cambio del saldo vino de exportaciones y cuánto de importaciones.', 'The identity BC = X − M separates how much of the change came from exports and how much from imports.'),
    evidence: ['ar_x', 'ar_m', 'ar_saldo', 'ar_x_cye', 'ar_m_cyl', 'ar_emae'],
    sources: [{ title: 'Argentina cerró el 2024 con superávit comercial récord', publisher: 'Bloomberg Línea', date: '2025-01-20', url: 'https://www.bloomberglinea.com/latinoamerica/argentina/argentina-cerro-el-2024-con-un-superavit-comercial-de-casi-us19-mil-millones/', kind: 'news' }],
  },
  {
    id: 'trade-2025-importaciones',
    date: '2025-12-01',
    kind: 'trade',
    topics: ['external'],
    title: L('Repunte de importaciones y menor superávit en 2025', 'Import rebound and a smaller surplus in 2025'),
    context: L('En 2025 se flexibilizaron restricciones cambiarias y comerciales y la actividad se recuperó.', 'In 2025 exchange and trade restrictions were eased and activity recovered.'),
    decision: L('El superávit comercial de 2025 fue menor que el de 2024 por el aumento de las importaciones, aunque diciembre sorprendió al alza, según Bloomberg Línea con datos de INDEC.', 'The 2025 trade surplus was smaller than 2024’s because imports rose, although December surprised upwards, according to Bloomberg Línea with INDEC data.'),
    hypotheses: [L('La recuperación del ingreso y la apertura elevan la demanda de importaciones (propensión marginal a importar).', 'Recovering income and opening raise import demand (marginal propensity to import).')],
    interpretation: L('En el modelo de economía abierta, un mayor m reduce el multiplicador y el saldo comercial para un mismo nivel de producto.', 'In the open-economy model, a higher m lowers the multiplier and the trade balance for a given output.'),
    evidence: ['ar_x', 'ar_m', 'ar_saldo', 'ar_m_bc', 'ar_m_bk'],
    sources: [{ title: 'Diciembre sorprende al alza pero el superávit comercial se achicó en 2025: ICA del Indec', publisher: 'Bloomberg Línea', date: '2026-01-20', url: 'https://www.bloomberglinea.com/latinoamerica/argentina/diciembre-sorprende-al-alza-pero-el-superavit-comercial-se-achico-en-2025-ica-del-indec/', kind: 'news' }],
  },
];
