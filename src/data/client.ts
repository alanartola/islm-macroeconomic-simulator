import { useEffect, useState } from 'react';
import type { SeriesFile, SeriesState, Frequency, Lang2, Topic, Country } from './core';

/**
 * Loads the validated data files published with the site (public/data). The
 * loader is replaceable so the tests can read the committed snapshot from disk.
 */
export interface ManifestEntry {
  id: string;
  topic: Topic;
  country: Country;
  name: Lang2;
  frequency: Frequency;
  state: SeriesState | 'missing';
  count: number;
  fetchedAt?: string;
  firstObservation?: string | null;
  lastObservation?: string | null;
  error?: string;
  derived?: boolean;
}

export interface Manifest {
  generatedAt: string;
  series: ManifestEntry[];
  checks: string[];
}

export interface NewsItem {
  title: string;
  url: string;
  domain: string;
  date: string;
  topic: string;
  country: string;
  language: string;
  source: 'GDELT';
}

export interface NewsFile {
  fetchedAt: string;
  items: NewsItem[];
  errors: string[];
}

type Loader = (path: string) => Promise<unknown>;

const defaultLoader: Loader = async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

let loader: Loader = defaultLoader;
const cache = new Map<string, Promise<unknown>>();

/** Replaces the loader (tests) and clears the cache. */
export function setDataLoader(next: Loader | null): void {
  loader = next ?? defaultLoader;
  cache.clear();
}

function load<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = loader(path).catch((e) => {
      cache.delete(path);
      throw e;
    });
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const loadSeries = (id: string) => load<SeriesFile>(`series/${id}.json`);
export const loadManifest = () => load<Manifest>('manifest.json');
export const loadNews = () => load<NewsFile>('news-auto.json');

export interface SeriesState2 {
  files: Record<string, SeriesFile>;
  errors: Record<string, string>;
  loading: boolean;
}

/** Loads several series; missing ones are reported, never replaced by placeholders. */
export function useSeries(ids: string[]): SeriesState2 {
  const key = [...new Set(ids)].sort().join(',');
  const [state, setState] = useState<SeriesState2>({ files: {}, errors: {}, loading: true });
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    setState((s) => ({ ...s, loading: true }));
    Promise.allSettled(list.map((id) => loadSeries(id))).then((results) => {
      if (!alive) return;
      const files: Record<string, SeriesFile> = {};
      const errors: Record<string, string> = {};
      results.forEach((r, k) => {
        const id = list[k]!;
        if (r.status === 'fulfilled') files[id] = r.value;
        else errors[id] = (r.reason as Error)?.message ?? 'error';
      });
      setState({ files, errors, loading: false });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

export function useResource<T>(fn: () => Promise<T>, dep = ''): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: Error) => alive && setState({ data: null, error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return state;
}
