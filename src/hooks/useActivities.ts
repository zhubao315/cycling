import { locationForRun, titleForRun } from '@/utils/utils';
import activitiesJson from '@/static/activities.json';
import type { Activity } from '@/utils/utils';

const MIN_DISTANCE_M = 3000;

const activities = (activitiesJson as Activity[]).filter(
  (run) => /^cycling$/i.test(run.type || '') && (run.distance || 0) >= MIN_DISTANCE_M
);

const build = () => {
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

const cache = build();

const useActivities = () => cache;

export default useActivities;
