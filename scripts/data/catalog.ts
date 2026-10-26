/**
 * Catalogue of the official series used by the observatory. Every identifier
 * below was checked against the publishing API (BCRA Estadísticas v4.0,
 * datos.gob.ar series API, U.S. Treasury daily yield-curve CSV, FRED and the
 * World Bank API). Nothing here contains observations: they are downloaded,
 * validated and stored by fetch.ts.
 */
import type { Country, Frequency, Lang2, SeriesMeta, Topic, UnitKind } from '../../src/data/core.ts';

export type Adapter = 'bcra' | 'datos' | 'treasury' | 'fred' | 'worldbank';

export interface CatalogEntry extends SeriesMeta {
  adapter: Adapter;
  /** Treasury: column of the CSV; World Bank: ISO3 country code. */
  field?: string;
}

const START = '2016-01-01';
const BCRA_DOC = 'https://www.bcra.gob.ar/apis-banco-central/';
const TREASURY_DOC = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve';
const ICA_DOC = 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-2-40';
const datosDoc = (id: string) => `https://apis.datos.gob.ar/series/api/series/?ids=${id}&format=json`;

const L = (es: string, en: string): Lang2 => ({ es, en });

function entry(
  id: string,
  country: Country,
  topic: Topic,
  adapter: Adapter,
  seriesId: string,
  frequency: Frequency,
  unitKind: UnitKind,
  name: Lang2,
  definition: Lang2,
  unit: Lang2,
  org: string,
  channel: string,
  docUrl: string,
  methodology: Lang2,
  extra: Partial<CatalogEntry> = {},
): CatalogEntry {
  return { id, country, topic, adapter, frequency, unitKind, name, definition, unit, methodology, original: true, start: START, source: { org, channel, seriesId, docUrl }, ...extra };
}

const BCRA = 'Banco Central de la República Argentina (BCRA)';
const BCRA_CH = 'API Estadísticas BCRA v4.0';
const INDEC = 'Instituto Nacional de Estadística y Censos (INDEC)';
const DATOS = 'API de Series de Tiempo de datos.gob.ar';
const TNA = L('% nominal anual (TNA)', '% nominal per year');

const bcra = (id: string, topic: Topic, num: string, freq: Frequency, kind: UnitKind, name: Lang2, def: Lang2, unit: Lang2, meth: Lang2, extra: Partial<CatalogEntry> = {}) =>
  entry(id, 'AR', topic, 'bcra', num, freq, kind, name, def, unit, BCRA, BCRA_CH, BCRA_DOC, meth, extra);

const indec = (id: string, topic: Topic, sid: string, freq: Frequency, kind: UnitKind, name: Lang2, def: Lang2, unit: Lang2, meth: Lang2, extra: Partial<CatalogEntry> = {}) =>
  entry(id, 'AR', topic, 'datos', sid, freq, kind, name, def, unit, INDEC, DATOS, extra.source?.docUrl ?? datosDoc(sid), meth, extra);

const tradeMeth = L(
  'Intercambio Comercial Argentino (ICA) de INDEC: exportaciones FOB e importaciones CIF registradas por la Dirección General de Aduanas. Cifras provisorias sujetas a revisión; los totales oficiales pueden diferir de la suma de componentes por redondeo.',
  'INDEC Argentine Trade Exchange (ICA): FOB exports and CIF imports recorded by Customs. Provisional figures subject to revision; official totals may differ from the sum of components because of rounding.',
);
const MUSD = L('millones de US$', 'US$ millions');
const partnerMeth = L(
  'Series del ICA por país (exportaciones FOB, importaciones CIF). La API las rotula «en dólares», pero su magnitud —comparada con los totales del ICA— corresponde a millones de dólares, que es la unidad que se informa aquí.',
  'ICA series by country (FOB exports, CIF imports). The API labels them “in dollars”, but their magnitude —compared with ICA totals— corresponds to US$ millions, the unit reported here.',
);

export const CATALOG: CatalogEntry[] = [
  // ── Argentina: monetary policy and interest rates ────────────────────────
  bcra('ar_tasa_politica', 'monetary', '160', 'D', 'rate_tna', L('Tasa de política monetaria (BCRA)', 'Monetary-policy rate (BCRA)'),
    L('Tasa de interés de referencia fijada por el BCRA según el instrumento vigente en cada período (pases pasivos, LEBAC, LELIQ, pases y LEFI).', 'Reference rate set by the BCRA through the instrument in force in each period (reverse repos, LEBAC, LELIQ, repos and LEFI).'),
    TNA, L('Serie «Tasas de interés de política monetaria» del BCRA. El instrumento de referencia cambió varias veces; la serie se discontinúa el 10/07/2025, cuando el BCRA dejó de fijar una tasa de política.', 'BCRA series “monetary-policy interest rates”. The reference instrument changed several times; the series ends on 10 July 2025, when the BCRA stopped setting a policy rate.')),
  bcra('ar_badlar', 'monetary', '7', 'D', 'rate_tna', L('Tasa BADLAR, bancos privados', 'BADLAR rate, private banks'),
    L('Tasa promedio pagada por bancos privados por depósitos a plazo fijo de más de un millón de pesos, de 30 a 35 días.', 'Average rate paid by private banks on time deposits above one million pesos, 30–35 days.'), TNA,
    L('Promedio de entidades privadas informado diariamente por el BCRA.', 'Private-bank average reported daily by the BCRA.')),
  bcra('ar_tamar', 'monetary', '44', 'D', 'rate_tna', L('Tasa TAMAR, bancos privados', 'TAMAR rate, private banks'),
    L('Tasa por depósitos a plazo fijo mayoristas (más de mil millones de pesos) de 30 a 35 días en bancos privados.', 'Rate on wholesale time deposits (above one billion pesos), 30–35 days, private banks.'), TNA,
    L('Publicada por el BCRA desde octubre de 2024.', 'Published by the BCRA since October 2024.')),
  bcra('ar_pases_terceros', 'monetary', '150', 'D', 'rate_tna', L('Tasa de pases entre terceros a 1 día', 'Overnight third-party repo rate'),
    L('Tasa de interés de las operaciones de pase a 1 día entre entidades y otros participantes (mercado de liquidez de corto plazo).', 'Interest rate on 1-day repo operations between institutions and other participants (short-term liquidity market).'), TNA,
    L('Promedio diario informado por el BCRA.', 'Daily average reported by the BCRA.')),
  // ── Exchange rate ────────────────────────────────────────────────────────
  bcra('ar_tc_mayorista', 'fx', '5', 'D', 'ars_per_usd', L('Tipo de cambio mayorista de referencia (Com. A 3500)', 'Wholesale reference exchange rate (Com. A 3500)'),
    L('Pesos por dólar estadounidense en el mercado mayorista oficial, según la Comunicación A 3500 del BCRA.', 'Pesos per US dollar in the official wholesale market, BCRA Communication A 3500.'),
    L('pesos por US$', 'pesos per US$'), L('Tipo de cambio nominal oficial. No incluye cotizaciones paralelas ni financieras, que pueden diferir mucho en períodos con restricciones cambiarias.', 'Official nominal rate. It excludes parallel or financial quotes, which may differ widely under exchange controls.')),
  indec('ar_itcrm', 'fx', '116.4_TCRZE_2015_D_36_4', 'D', 'index', L('Índice de tipo de cambio real multilateral (ITCRM)', 'Multilateral real exchange-rate index (ITCRM)'),
    L('Precio relativo de los bienes de Argentina respecto de sus socios comerciales, ponderado por comercio. Un aumento es una depreciación real.', 'Trade-weighted relative price of Argentine goods versus its trading partners. An increase is a real depreciation.'),
    L('índice 17-dic-2015 = 100', 'index 17-Dec-2015 = 100'), L('Elaborado por el BCRA y publicado en datos.gob.ar. Su actualización en esa fuente puede demorarse respecto de otras series.', 'Compiled by the BCRA and published on datos.gob.ar. Updates there can lag other series.'),
    { source: { org: BCRA, channel: DATOS, seriesId: '116.4_TCRZE_2015_D_36_4', docUrl: datosDoc('116.4_TCRZE_2015_D_36_4') } }),
  // ── Reserves and money ───────────────────────────────────────────────────
  bcra('ar_reservas', 'external', '1', 'D', 'musd', L('Reservas internacionales del BCRA', 'BCRA international reserves'),
    L('Stock de reservas internacionales brutas del BCRA.', 'Stock of gross international reserves of the BCRA.'), MUSD,
    L('Cifras brutas provisorias. Las reservas netas (descontando pasivos de corto plazo, swaps y encajes) no son una serie oficial publicada en esta API.', 'Provisional gross figures. Net reserves (excluding short-term liabilities, swaps and reserve requirements) are not an official series in this API.')),
  bcra('ar_base_monetaria', 'monetary', '15', 'D', 'mars', L('Base monetaria', 'Monetary base'),
    L('Circulación monetaria más depósitos de las entidades financieras en cuenta corriente en el BCRA.', 'Currency in circulation plus banks’ current-account deposits at the BCRA.'), L('millones de $', 'ARS millions'),
    L('Saldo diario nominal.', 'Nominal daily balance.')),
  bcra('ar_m2', 'monetary', '109', 'D', 'mars', L('Agregado monetario M2', 'Monetary aggregate M2'),
    L('Billetes y monedas en poder del público más depósitos a la vista (cuentas corrientes y cajas de ahorro) en pesos.', 'Currency held by the public plus peso sight deposits (current and savings accounts).'), L('millones de $', 'ARS millions'),
    L('Saldo diario nominal (serie de agregados monetarios del BCRA).', 'Nominal daily balance (BCRA monetary-aggregates series).')),
  // ── Prices ───────────────────────────────────────────────────────────────
  bcra('ar_inflacion_mensual', 'prices', '27', 'M', 'pct', L('Inflación mensual (IPC)', 'Monthly inflation (CPI)'),
    L('Variación porcentual mensual del índice de precios al consumidor.', 'Monthly percentage change of the consumer price index.'), L('% mensual', '% per month'),
    L('Serie compilada por el BCRA a partir del IPC de INDEC. Hasta mayo de 2017 sus valores coinciden con el IPC del Gran Buenos Aires; desde junio de 2017, con el IPC de cobertura nacional (base diciembre 2016 = 100).', 'Series compiled by the BCRA from the INDEC CPI. Up to May 2017 its values match the Greater Buenos Aires CPI; from June 2017, the national CPI (base December 2016 = 100).')),
  bcra('ar_inflacion_interanual', 'prices', '28', 'M', 'pct', L('Inflación interanual (IPC)', 'Year-on-year inflation (CPI)'),
    L('Variación porcentual del IPC respecto del mismo mes del año anterior.', 'Percentage change of the CPI over the same month a year earlier.'), L('% interanual', '% year on year'),
    L('Serie compilada por el BCRA a partir del IPC de INDEC.', 'Series compiled by the BCRA from the INDEC CPI.')),
  bcra('ar_inflacion_esperada', 'prices', '29', 'M', 'pct', L('Inflación esperada a 12 meses (REM)', 'Expected inflation, next 12 months (REM)'),
    L('Mediana de la inflación interanual esperada para los próximos 12 meses en el Relevamiento de Expectativas de Mercado.', 'Median expected year-on-year inflation for the next 12 months in the Market Expectations Survey.'), L('% interanual esperado', '% expected, year on year'),
    L('Encuesta mensual del BCRA a analistas; es una expectativa, no una medición de precios.', 'BCRA monthly survey of analysts; an expectation, not a price measurement.')),
  indec('ar_ipc', 'prices', '148.3_INIVELNAL_DICI_M_26', 'M', 'index', L('Índice de precios al consumidor, nivel general nacional', 'Consumer price index, national headline'),
    L('Índice de precios al consumidor de cobertura nacional.', 'Consumer price index, national coverage.'), L('índice dic-2016 = 100', 'index Dec-2016 = 100'),
    L('IPC de INDEC, base diciembre 2016 = 100.', 'INDEC CPI, base December 2016 = 100.')),
  // ── Activity, labour and fiscal ──────────────────────────────────────────
  indec('ar_emae', 'activity', '143.3_NO_PR_2004_A_31', 'M', 'index', L('Actividad económica (EMAE, desestacionalizado)', 'Economic activity (EMAE, seasonally adjusted)'),
    L('Estimador Mensual de Actividad Económica, serie sin estacionalidad.', 'Monthly Economic Activity Estimator, seasonally adjusted.'), L('índice 2004 = 100', 'index 2004 = 100'),
    L('Indicador provisorio del nivel de actividad; INDEC revisa la serie desestacionalizada con cada publicación.', 'Provisional indicator of activity; INDEC revises the seasonally adjusted series with each release.')),
  indec('ar_emae_original', 'activity', '143.3_NO_PR_2004_A_21', 'M', 'index', L('Actividad económica (EMAE, serie original)', 'Economic activity (EMAE, original series)'),
    L('Estimador Mensual de Actividad Económica, serie original (con estacionalidad).', 'Monthly Economic Activity Estimator, original series (not seasonally adjusted).'), L('índice 2004 = 100', 'index 2004 = 100'),
    L('Para variaciones interanuales usar esta serie, no la desestacionalizada.', 'Use this series, not the adjusted one, for year-on-year changes.')),
  indec('ar_desocupacion', 'labour', '42.3_EPH_PUNTUATAL_0_M_30', 'Q', 'pct_labour', L('Tasa de desocupación (EPH)', 'Unemployment rate (EPH)'),
    L('Desocupados como porcentaje de la población económicamente activa, total de aglomerados urbanos.', 'Unemployed as a percentage of the labour force, total urban areas.'), L('% de la PEA', '% of labour force'),
    L('Encuesta Permanente de Hogares, trimestral.', 'Permanent Household Survey, quarterly.')),
  entry('ar_resultado_primario', 'AR', 'fiscal', 'datos', '452.3_RESULTADO_RIO_0_M_18_54', 'M', 'mars', L('Resultado primario del Sector Público Nacional (IMIG)', 'Primary balance of the national public sector (IMIG)'),
    L('Ingresos menos gastos primarios (sin intereses) del Sector Público Nacional no financiero, base caja.', 'Revenue minus primary spending (excluding interest) of the national non-financial public sector, cash basis.'), L('millones de $ corrientes', 'current ARS millions'),
    'Secretaría de Hacienda, Ministerio de Economía', DATOS, datosDoc('452.3_RESULTADO_RIO_0_M_18_54'),
    L('Valores nominales mensuales: comparar años distintos exige deflactar.', 'Monthly nominal values: comparing years requires deflating.')),
  entry('ar_pib_crecimiento', 'AR', 'activity', 'worldbank', 'NY.GDP.MKTP.KD.ZG', 'A', 'pct', L('Crecimiento del PIB real', 'Real GDP growth'),
    L('Variación anual del producto interno bruto a precios constantes.', 'Annual change of gross domestic product at constant prices.'), L('% anual', '% per year'),
    'Banco Mundial (sobre la base de INDEC)', 'API del Banco Mundial', 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=AR',
    L('Indicador WDI NY.GDP.MKTP.KD.ZG.', 'WDI indicator NY.GDP.MKTP.KD.ZG.'), { field: 'ARG', start: '2000-01-01' }),
  // ── Trade (INDEC ICA) ────────────────────────────────────────────────────
  ...([
    ['ar_x', '74.3_IET_0_M_16', L('Exportaciones totales', 'Total exports'), L('Valor FOB de las exportaciones de bienes.', 'FOB value of goods exports.')],
    ['ar_m', '74.3_IIT_0_M_25', L('Importaciones totales', 'Total imports'), L('Valor CIF de las importaciones de bienes.', 'CIF value of goods imports.')],
    ['ar_saldo', '74.3_ISC_0_M_19', L('Saldo comercial (publicado)', 'Trade balance (published)'), L('Exportaciones menos importaciones publicado por INDEC.', 'Exports minus imports as published by INDEC.')],
    ['ar_x_pp', '74.3_IEPP_0_M_35', L('Exportaciones: productos primarios', 'Exports: primary products'), L('Gran rubro de exportación.', 'Export product group.')],
    ['ar_x_moa', '74.3_IEMOA_0_M_48', L('Exportaciones: manufacturas de origen agropecuario', 'Exports: agricultural manufactures'), L('Gran rubro de exportación.', 'Export product group.')],
    ['ar_m_bk', '74.3_IIBCA_0_M_32', L('Importaciones: bienes de capital', 'Imports: capital goods'), L('Uso económico de la importación.', 'Economic use of imports.')],
    ['ar_m_bi', '74.3_IIBI_0_M_36', L('Importaciones: bienes intermedios', 'Imports: intermediate goods'), L('Uso económico de la importación.', 'Economic use of imports.')],
    ['ar_m_bc', '74.3_IIBCO_0_M_32', L('Importaciones: bienes de consumo', 'Imports: consumer goods'), L('Uso económico de la importación.', 'Economic use of imports.')],
    ['ar_m_vap', '74.3_IIVAP_0_M_49', L('Importaciones: vehículos automotores de pasajeros', 'Imports: passenger vehicles'), L('Uso económico de la importación.', 'Economic use of imports.')],
    ['ar_m_resto', '74.3_IIR_0_M_23', L('Importaciones: resto', 'Imports: other'), L('Uso económico de la importación.', 'Economic use of imports.')],
    ['ar_m_bk_pya', '74.3_IBCPP_0_M_32', L('Importaciones: bienes de capital más piezas y accesorios', 'Imports: capital goods plus parts'), L('Agregado publicado de dos usos económicos (insumo para derivar piezas y accesorios).', 'Published aggregate of two economic uses (input to derive parts).')],
    ['ar_x_moi', '75.3_ITM_0_M_13', L('Exportaciones: manufacturas de origen industrial', 'Exports: industrial manufactures'), L('Gran rubro de exportación (cuadro de exportaciones por rubro de INDEC).', 'Export product group (INDEC exports-by-group table).')],
  ] as const).map(([id, sid, name, def]) =>
    indec(id, 'external', sid, 'M', 'musd', name, def, MUSD, tradeMeth, { source: { org: INDEC, channel: DATOS, seriesId: sid, docUrl: ICA_DOC } }),
  ),
  ...([
    ['ar_x_brasil', '77.3_IEB_0_A_24', L('Exportaciones a Brasil', 'Exports to Brazil')],
    ['ar_x_china', '77.3_IEC_0_A_23', L('Exportaciones a China', 'Exports to China')],
    ['ar_x_eeuu', '77.3_IEEU_0_A_32', L('Exportaciones a Estados Unidos', 'Exports to the United States')],
    ['ar_x_chile', '77.3_IECH_0_A_23', L('Exportaciones a Chile', 'Exports to Chile')],
    ['ar_x_india', '77.3_IEI_0_A_23', L('Exportaciones a India', 'Exports to India')],
    ['ar_m_brasil', '78.3_IIB_0_A_24', L('Importaciones desde Brasil', 'Imports from Brazil')],
    ['ar_m_india', '78.3_III_0_A_23', L('Importaciones desde India', 'Imports from India')],
    ['ar_saldo_eeuu', '79.3_ISCEU_0_A_34', L('Saldo comercial con Estados Unidos', 'Trade balance with the United States')],
  ] as const).map(([id, sid, name]) =>
    indec(id, 'external', sid, 'M', 'musd', name, L('Comercio de bienes con el país socio, según el ICA.', 'Goods trade with the partner country, per the ICA.'), MUSD, partnerMeth, {
      source: { org: INDEC, channel: DATOS, seriesId: sid, docUrl: ICA_DOC },
    }),
  ),
  // ── United States (reference) ────────────────────────────────────────────
  ...([
    ['us_t3m', '3 Mo', L('Bono del Tesoro de EE.UU. a 3 meses (rendimiento)', 'U.S. Treasury 3-month yield')],
    ['us_t2y', '2 Yr', L('Bono del Tesoro de EE.UU. a 2 años (rendimiento)', 'U.S. Treasury 2-year yield')],
    ['us_t10y', '10 Yr', L('Bono del Tesoro de EE.UU. a 10 años (rendimiento)', 'U.S. Treasury 10-year yield')],
  ] as const).map(([id, col, name]) =>
    entry(id, 'US', 'international', 'treasury', 'daily_treasury_yield_curve', 'D', 'rate_pct', name,
      L('Rendimiento de la curva par de bonos del Tesoro de EE.UU. al plazo indicado (cierre diario).', 'Par yield-curve rate of U.S. Treasury securities at the given maturity (daily close).'),
      L('% anual', '% per year'), 'U.S. Department of the Treasury', 'Daily Treasury Par Yield Curve Rates (CSV)', TREASURY_DOC,
      L('Rendimiento de mercado de un título en dólares, no la tasa fijada por la Reserva Federal.', 'Market yield of a dollar security, not the rate set by the Federal Reserve.'), { field: col })),
  entry('us_fed_upper', 'US', 'international', 'fred', 'DFEDTARU', 'D', 'rate_pct', L('Rango objetivo de la tasa de fondos federales: límite superior', 'Federal funds target range: upper limit'),
    L('Límite superior del rango objetivo fijado por el FOMC de la Reserva Federal.', 'Upper limit of the target range set by the Federal Reserve FOMC.'), L('% anual', '% per year'),
    'Board of Governors of the Federal Reserve System', 'FRED (Federal Reserve Bank of St. Louis)', 'https://fred.stlouisfed.org/series/DFEDTARU',
    L('Decisión de política monetaria (no es un rendimiento de mercado).', 'A policy decision (not a market yield).')),
  entry('us_fed_lower', 'US', 'international', 'fred', 'DFEDTARL', 'D', 'rate_pct', L('Rango objetivo de la tasa de fondos federales: límite inferior', 'Federal funds target range: lower limit'),
    L('Límite inferior del rango objetivo fijado por el FOMC de la Reserva Federal.', 'Lower limit of the target range set by the Federal Reserve FOMC.'), L('% anual', '% per year'),
    'Board of Governors of the Federal Reserve System', 'FRED (Federal Reserve Bank of St. Louis)', 'https://fred.stlouisfed.org/series/DFEDTARL',
    L('Decisión de política monetaria (no es un rendimiento de mercado).', 'A policy decision (not a market yield).')),
  entry('us_ipc', 'US', 'international', 'fred', 'CPIAUCSL', 'M', 'index', L('Índice de precios al consumidor de EE.UU. (CPI-U)', 'U.S. consumer price index (CPI-U)'),
    L('Índice de precios al consumidor urbano, desestacionalizado.', 'Consumer price index for all urban consumers, seasonally adjusted.'), L('índice 1982-84 = 100', 'index 1982-84 = 100'),
    'U.S. Bureau of Labor Statistics', 'FRED (Federal Reserve Bank of St. Louis)', 'https://fred.stlouisfed.org/series/CPIAUCSL',
    L('La inflación interanual se deriva en la aplicación a partir del índice.', 'Year-on-year inflation is derived in the application from the index.')),
  entry('us_desempleo', 'US', 'international', 'fred', 'UNRATE', 'M', 'pct_labour', L('Tasa de desempleo de EE.UU.', 'U.S. unemployment rate'),
    L('Desempleados como porcentaje de la fuerza laboral civil.', 'Unemployed as a percentage of the civilian labour force.'), L('% de la fuerza laboral', '% of labour force'),
    'U.S. Bureau of Labor Statistics', 'FRED (Federal Reserve Bank of St. Louis)', 'https://fred.stlouisfed.org/series/UNRATE', L('Encuesta mensual de hogares (CPS).', 'Monthly household survey (CPS).')),
  entry('us_pib_crecimiento', 'US', 'international', 'worldbank', 'NY.GDP.MKTP.KD.ZG', 'A', 'pct', L('Crecimiento del PIB real de EE.UU.', 'U.S. real GDP growth'),
    L('Variación anual del producto interno bruto a precios constantes.', 'Annual change of gross domestic product at constant prices.'), L('% anual', '% per year'),
    'Banco Mundial (sobre la base de BEA)', 'API del Banco Mundial', 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=US',
    L('Indicador WDI NY.GDP.MKTP.KD.ZG.', 'WDI indicator NY.GDP.MKTP.KD.ZG.'), { field: 'USA', start: '2000-01-01' }),
];

/** Queries of the automatic news feed (GDELT DOC 2.0 API), each tied to an economic topic. */
export const NEWS_QUERIES: { topic: Topic; query: string }[] = [
  { topic: 'monetary', query: 'BCRA sourcelang:spanish' },
  { topic: 'fx', query: '"tipo de cambio" Argentina sourcelang:spanish' },
  { topic: 'prices', query: 'inflación INDEC sourcelang:spanish' },
  { topic: 'external', query: 'exportaciones Argentina sourcelang:spanish' },
  { topic: 'fiscal', query: '"superávit fiscal" Argentina sourcelang:spanish' },
  { topic: 'international', query: '"Reserva Federal" tasas sourcelang:spanish' },
];

/**
 * Series derived here from published ones, because the corresponding official
 * identifiers return no observations. Each value is computed only for months
 * in which every input exists; the formula is shown to the user.
 */
export interface DerivedEntry {
  id: string;
  inputs: string[];
  /** Computes the value from the inputs of one month (same order as inputs). */
  formula: (v: number[]) => number;
  meta: SeriesMeta;
}

const derivedMeta = (id: string, name: Lang2, definition: Lang2, derivation: Lang2, extraMeth?: Lang2): SeriesMeta => ({
  id,
  country: 'AR',
  topic: 'external',
  name,
  definition,
  unit: MUSD,
  unitKind: 'musd',
  frequency: 'M',
  original: false,
  derivation,
  methodology: extraMeth ?? tradeMeth,
  start: START,
  source: { org: INDEC, channel: 'Derivado de series de datos.gob.ar', seriesId: 'derivada', docUrl: ICA_DOC },
});

export const DERIVED: DerivedEntry[] = [
  {
    id: 'ar_x_cye',
    inputs: ['ar_x', 'ar_x_pp', 'ar_x_moa', 'ar_x_moi'],
    formula: ([x, pp, moa, moi]) => x! - pp! - moa! - moi!,
    meta: derivedMeta('ar_x_cye', L('Exportaciones: combustibles y energía (derivado)', 'Exports: fuels and energy (derived)'),
      L('Cuarto gran rubro de exportación.', 'Fourth export product group.'),
      L('Exportaciones totales − productos primarios − MOA − MOI. La serie oficial del rubro no devuelve datos en la API.', 'Total exports − primary products − agricultural manufactures − industrial manufactures. The official series of this group returns no data in the API.'),
      L('La MOI proviene de un cuadro de INDEC distinto del resto de los rubros; diferencias de revisión entre cuadros se trasladan a este residuo.', 'Industrial manufactures come from a different INDEC table; revision differences between tables pass into this residual.')),
  },
  {
    id: 'ar_m_pya',
    inputs: ['ar_m_bk_pya', 'ar_m_bk'],
    formula: ([both, bk]) => both! - bk!,
    meta: derivedMeta('ar_m_pya', L('Importaciones: piezas y accesorios para bienes de capital (derivado)', 'Imports: parts for capital goods (derived)'),
      L('Uso económico de la importación.', 'Economic use of imports.'),
      L('(Bienes de capital + piezas y accesorios) − bienes de capital, ambos publicados por INDEC.', '(Capital goods + parts) − capital goods, both published by INDEC.')),
  },
  {
    id: 'ar_m_cyl',
    inputs: ['ar_m', 'ar_m_bi', 'ar_m_bk_pya', 'ar_m_bc', 'ar_m_vap', 'ar_m_resto'],
    formula: ([m, bi, both, bc, vap, resto]) => m! - bi! - both! - bc! - vap! - resto!,
    meta: derivedMeta('ar_m_cyl', L('Importaciones: combustibles y lubricantes (derivado)', 'Imports: fuels and lubricants (derived)'),
      L('Uso económico de la importación.', 'Economic use of imports.'),
      L('Importaciones totales − (bienes de capital + piezas) − intermedios − consumo − vehículos − resto. La serie oficial del uso no devuelve datos en la API.', 'Total imports − (capital goods + parts) − intermediate − consumer − vehicles − other. The official series of this use returns no data in the API.')),
  },
  {
    id: 'ar_m_eeuu',
    inputs: ['ar_x_eeuu', 'ar_saldo_eeuu'],
    formula: ([x, bal]) => x! - bal!,
    meta: derivedMeta('ar_m_eeuu', L('Importaciones desde Estados Unidos (derivado)', 'Imports from the United States (derived)'),
      L('Comercio de bienes con el país socio, según el ICA.', 'Goods trade with the partner country, per the ICA.'),
      L('Exportaciones a EE.UU. − saldo comercial con EE.UU. (FOB − CIF). La serie oficial de importaciones por país no devuelve datos en la API.', 'Exports to the U.S. − trade balance with the U.S. (FOB − CIF). The official imports-by-country series returns no data in the API.'),
      partnerMeth),
  },
];
