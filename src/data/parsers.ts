/**
 * Pure parsers of the official sources' payloads and the assembly of a
 * validated series file. The download script (scripts/data/fetch.ts) does the
 * network work; everything that decides WHAT is stored lives here so that it
 * can be tested without network access. Each parser returns raw [date, value]
 * pairs (null for a missing value); validation happens in assembleSeries.
 */
import { countRevisions, isStale, validateObservations, type Frequency, type SeriesFile, type SeriesMeta } from './core.ts';

export type RawRow = [string, number | null];

export function csvRows(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
}

/** BCRA Estadísticas Monetarias v4.0: results[0].detalle[{fecha, valor}]. */
export function parseBcra(payload: unknown, frequency: Frequency): { rows: RawRow[]; count: number } {
  const j = payload as { results?: { detalle?: { fecha: string; valor: number | null }[] }[]; metadata?: { resultset?: { count?: number } } };
  if (!j || !Array.isArray(j.results)) throw new Error('UNEXPECTED_PAYLOAD');
  const detail = j.results[0]?.detalle ?? [];
  // Monthly BCRA series are dated on the last day of the month; they are normalised to the
  // first day so that they align with INDEC series (documented in the series methodology).
  const rows: RawRow[] = detail.map((r) => [frequency === 'M' ? `${r.fecha.slice(0, 7)}-01` : r.fecha, r.valor]);
  return { rows, count: j.metadata?.resultset?.count ?? 0 };
}

/** Series de Tiempo de Argentina (datos.gob.ar): {data: [[date, value], ...]}. */
export function parseDatos(payload: unknown): RawRow[] {
  const j = payload as { data?: [string, number | null][] };
  if (!j || !Array.isArray(j.data)) throw new Error('UNEXPECTED_PAYLOAD');
  return j.data;
}

/** U.S. Treasury daily par yield curve CSV (dates MM/DD/YYYY, one column per maturity). */
export function parseTreasuryCsv(text: string, column: string): RawRow[] {
  const rows = csvRows(text);
  const col = (rows[0] ?? []).indexOf(column);
  if (col < 0) throw new Error(`COLUMN_NOT_FOUND:${column}`);
  const out: RawRow[] = [];
  for (const r of rows.slice(1)) {
    const [mm, dd, yyyy] = (r[0] ?? '').split('/');
    if (!yyyy || !mm || !dd) continue;
    const v = r[col];
    out.push([`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`, v === undefined || v === '' || v === 'N/A' ? null : Number(v)]);
  }
  return out;
}

/** FRED graph CSV: header "observation_date,<ID>", "." marks a missing value. */
export function parseFredCsv(text: string, seriesId: string): RawRow[] {
  const rows = csvRows(text);
  if (!rows[0]?.[1]?.includes(seriesId)) throw new Error('UNEXPECTED_HEADER');
  return rows.slice(1).map(([d, v]) => [d ?? '', v === '.' || v === '' || v === undefined ? null : Number(v)]);
}

/** World Bank API v2: [paging, [{date: "2024", value}]]; annual values dated 1 January. */
export function parseWorldBank(payload: unknown): RawRow[] {
  const rows = Array.isArray(payload) ? (payload[1] as { date: string; value: number | null }[] | null) : null;
  if (!Array.isArray(rows)) throw new Error('UNEXPECTED_PAYLOAD');
  return rows.map((r) => [`${r.date}-01-01`, r.value]);
}

/**
 * Builds the stored file from a download attempt. When the download failed or
 * did not validate, the previous validated version is kept and marked
 * "fallback" with the error; without a previous version nothing is stored.
 */
export function assembleSeries(args: {
  meta: SeriesMeta;
  raw: unknown[] | Error;
  previous: SeriesFile | null;
  today: string;
  now: string;
}): { file: SeriesFile | null; error: string | null } {
  const { meta, raw, previous, today, now } = args;
  let error: string;
  if (raw instanceof Error) error = raw.message;
  else {
    const v = validateObservations(raw, meta.unitKind, meta.frequency === 'A' ? 3 : 6);
    if (v.ok) {
      const data = v.data;
      const last = data[data.length - 1]![0];
      return {
        file: {
          meta,
          status: {
            fetchedAt: now,
            firstObservation: data[0]![0],
            lastObservation: last,
            count: data.length,
            state: isStale(last, meta.frequency, today) ? 'stale' : 'fresh',
            revisions: previous ? countRevisions(previous.data, data) : 0,
            duplicatesRemoved: v.duplicatesRemoved,
            missingDropped: v.missingDropped,
          },
          data,
        },
        error: null,
      };
    }
    error = `VALIDATION: ${v.errors.join(', ')}`;
  }
  if (!previous) return { file: null, error };
  return { file: { meta, status: { ...previous.status, state: 'fallback', error }, data: previous.data }, error };
}
