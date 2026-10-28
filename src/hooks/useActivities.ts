import { locationForRun, titleForRun } from '@/utils/utils';
import activities from '@/static/activities.json';

const MIN_DISTANCE_M = 3000;

const useActivities = () => {
  const cities: Record<string, number> = {};
  const runPeriod: Record<string, number> = {};
  const provinces: Set<string> = new Set();
  const countries: Set<string> = new Set();
  let years: Set<string> = new Set();
  let thisYear = '';

  const visibleActivities = activities.filter(
    (run) => (run.distance || 0) >= MIN_DISTANCE_M
  );

  visibleActivities.forEach((run) => {
    const location = locationForRun(run);

    const periodName = titleForRun(run);
    if (periodName) {
      runPeriod[periodName] = runPeriod[periodName]
        ? runPeriod[periodName] + 1
        : 1;
    }

    const { city, province, country } = location;
    // drop only one char city
    if (city.length > 1) {
      cities[city] = cities[city] ? cities[city] + run.distance : run.distance;
    }
    if (province) provinces.add(province);
    if (country) countries.add(country);
    const year = run.start_date_local.slice(0, 4);
    years.add(year);
  });

  let yearsArray = [...years].sort().reverse();
  if (years) [thisYear] = yearsArray; // set current year as first one of years array

  return {
    activities: visibleActivities,
    years: yearsArray,
    countries: [...countries],
    provinces: [...provinces],
    cities,
    runPeriod,
    thisYear,
  };
};

export default useActivities;
