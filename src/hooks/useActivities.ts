import { useSyncExternalStore } from 'react';
import { locationForRun, titleForRun } from '@/utils/utils';
import activitiesJson from '@/static/activities.json';
import type { Activity } from '@/utils/utils';

export const MIN_DISTANCE_M = 3000;

export type ActivityScope = 'standard' | 'all';

export const ACTIVITY_SCOPES = [
  { key: 'standard', label: '标准骑行', hint: `≥ ${MIN_DISTANCE_M / 1000} km` },
  { key: 'all', label: '全部活动', hint: '不限距离' },
] as const;

// The raw dataset is the single source of truth. The ≥3 km rule is a VIEW,
// not a different dataset: both scopes are built from the same records.
const allActivities = (activitiesJson as Activity[]).filter((run) =>
  /^cycling$/i.test(run.type || '')
);
const standardActivities = allActivities.filter(
  (run) => (run.distance || 0) >= MIN_DISTANCE_M
);

const build = (activities: Activity[]) => {
  const cities: Record<string, number> = {};
  const runPeriod: Record<string, number> = {};
  const provinces: Set<string> = new Set();
  const countries: Set<string> = new Set();
  const years: Set<string> = new Set();

  activities.forEach((run) => {
    const location = locationForRun(run);

    const periodName = titleForRun(run);
    if (periodName) {
      runPeriod[periodName] = runPeriod[periodName]
        ? runPeriod[periodName] + 1
        : 1;
    }

    const { city, province, country } = location;
    if (city.length > 1) {
      cities[city] = cities[city] ? cities[city] + run.distance : run.distance;
    }
    if (province) provinces.add(province);
    if (country) countries.add(country);
    years.add(run.start_date_local.slice(0, 4));
  });

  const yearsArray = [...years].sort().reverse();
  const thisYear = yearsArray[0] ?? '';

  return {
    activities,
    years: yearsArray,
    countries: [...countries],
    provinces: [...provinces],
    cities,
    runPeriod,
    thisYear,
  };
};

// Both views are aggregated once at module load, so switching scopes does not
// re-fold the 20 MB dataset on the client.
const cache = {
  standard: build(standardActivities),
  all: build(allActivities),
};

const readScope = (): ActivityScope => {
  if (typeof window === 'undefined') return 'standard';
  return new URLSearchParams(window.location.search).get('scope') === 'all'
    ? 'all'
    : 'standard';
};

let scope: ActivityScope = readScope();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => scope;

export const getActivityScope = () => scope;
export const subscribeActivityScope = subscribe;

export const setActivityScope = (next: ActivityScope) => {
  if (next === scope) return;
  scope = next;
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.set('scope', 'all');
    else url.searchParams.delete('scope');
    window.history.replaceState({}, '', url);
  }
  listeners.forEach((listener) => listener());
};

// Every consumer (KPIs, trends, calendar, map, table) reads the same scope,
// so the whole page never mixes the two statistical universes.
const useActivities = () => {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return cache[current];
};

export default useActivities;
