import { useMemo, useState } from 'react';
import useActivities from '@/hooks/useActivities';
import { Activity, convertMovingTime2Sec } from '@/utils/utils';
import { buildPeriods } from '@/utils/cyclingStats';
import SectionHeader from '@/components/CyclingDashboard/SectionHeader';
import styles from './style.module.css';

interface IJourneyStatsProps {
  changeCity: (_city: string) => void;
  changePeriod: (_periodKey: string) => void;
  onViewRun: (_runId: number) => void;
}

const PREVIEW_CITIES = 8;

interface RecordItem {
  label: string;
  value: string;
  date: string;
  run: Activity;
}

const fmtDuration = (seconds: number): string => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

const fmtKm = (meters: number) =>
  Math.round(meters / 1000).toLocaleString('en-US');

const JourneyStats = ({ changeCity, changePeriod, onViewRun }: IJourneyStatsProps) => {
  const { activities, years, countries, provinces, cities } =
    useActivities();
  const [expanded, setExpanded] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  const cityArr = useMemo(
    () => Object.entries(cities).sort((a, b) => b[1] - a[1]),
    [cities]
  );

  const validRuns = useMemo(
    () =>
      (activities as Activity[]).filter(
        (a) => a.type === 'cycling' && a.distance > 0 && a.average_speed > 0
      ),
    [activities]
  );

  let totalMeters = 0;
  let totalSeconds = 0;
  let hrSum = 0;
  let hrCount = 0;
  let streak = 0;
  activities.forEach((run) => {
    if (run.average_speed) {
      totalMeters += run.distance || 0;
      totalSeconds += (run.distance || 0) / run.average_speed;
    }
    if (run.average_heartrate) {
      hrSum += run.average_heartrate;
      hrCount += 1;
    }
    if (run.streak) streak = Math.max(streak, run.streak);
  });
  const avgSpeed =
    totalSeconds > 0
      ? ((totalMeters / totalSeconds) * 3.6).toFixed(1)
      : null;
  const avgHR = hrCount ? Math.round(hrSum / hrCount) : null;

  // Real hour buckets from every visible ride's local start time.
  const periods = useMemo(() => buildPeriods(activities), [activities]);
  const periodTotal = periods.reduce((sum, p) => sum + p.count, 0);

  const records = useMemo<RecordItem[]>(() => {
    if (!validRuns.length) return [];

    const dateOf = (a: Activity) => a.start_date_local.slice(0, 10);

    const far = validRuns.reduce((a, b) => (b.distance > a.distance ? b : a));
    const longest = validRuns.reduce((a, b) =>
      convertMovingTime2Sec(b.moving_time) > convertMovingTime2Sec(a.moving_time)
        ? b
        : a
    );
    const highestElev = validRuns.reduce((a, b) =>
      (b.elevation_gain || 0) > (a.elevation_gain || 0) ? b : a
    );
    const fastest = validRuns.reduce((a, b) =>
      b.average_speed > a.average_speed ? b : a
    );

    // most distance in a day
    const byDate = new Map<string, Activity[]>();
    validRuns.forEach((run) => {
      const date = dateOf(run);
      const bucket = byDate.get(date);
      if (bucket) bucket.push(run);
      else byDate.set(date, [run]);
    });
    const bestDayEntry = Array.from(byDate.entries()).reduce<{
      date: string;
      runs: Activity[];
      distance: number;
    } | null>((current, [date, dayRuns]) => {
      const distance = dayRuns.reduce((sum, run) => sum + run.distance, 0);
      if (!current || distance > current.distance) {
        return { date, runs: dayRuns, distance };
      }
      return current;
    }, null);

    const rows: RecordItem[] = [
      {
        label: '最长骑行 / Longest Ride',
        value: `${(far.distance / 1000).toFixed(2)} km`,
        date: dateOf(far),
        run: far,
      },
      {
        label: '最长时长 / Longest Duration',
        value: fmtDuration(convertMovingTime2Sec(longest.moving_time)),
        date: dateOf(longest),
        run: longest,
      },
      {
        label: '最大爬升 / Greatest Elevation',
        value: `${Math.round(highestElev.elevation_gain || 0)} m`,
        date: dateOf(highestElev),
        run: highestElev,
      },
      {
        label: '最高速度 / Highest Average Speed',
        value: `${(fastest.average_speed * 3.6).toFixed(1)} km/h`,
        date: dateOf(fastest),
        run: fastest,
      },
    ];

    if (bestDayEntry) {
      rows.push({
        label: '单日最多里程 / Most Distance in a Day',
        value: `${(bestDayEntry.distance / 1000).toFixed(2)} km`,
        date: bestDayEntry.date,
        run: bestDayEntry.runs[0],
      });
    }

    if (validRuns.some((run) => run.average_heartrate)) {
      const bestHr = validRuns
        .filter((run) => run.average_heartrate)
        .reduce((a, b) =>
          (b.average_heartrate || 0) > (a.average_heartrate || 0) ? b : a
        );
      rows.push({
        label: '最高平均心率 / Highest Average Heart Rate',
        value: `${Math.round(bestHr.average_heartrate || 0)} bpm`,
        date: dateOf(bestHr),
        run: bestHr,
      });
    }

    return rows;
  }, [validRuns]);

  const homeCity = cityArr[0];
  const maxMeters = homeCity ? homeCity[1] : 1;
  const shownCities = expanded ? cityArr : cityArr.slice(0, PREVIEW_CITIES);

  return (
    <section className={styles.journey} aria-label="Total Journey">
      <SectionHeader index="04" kicker="TOTAL JOURNEY" title="骑行旅程" />

      <div className={styles.geoGrid}>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{years.length}</span>
          <span className={styles.geoLabel}>Years / 年</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{countries.length}</span>
          <span className={styles.geoLabel}>Countries / 国家</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{provinces.length}</span>
          <span className={styles.geoLabel}>Provinces / 省份</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{cityArr.length}</span>
          <span className={styles.geoLabel}>Cities / 城市</span>
        </div>
        {homeCity ? (
          <button
            type="button"
            className={`${styles.geoCell} ${styles.homeCell}`}
            onClick={() => changeCity(homeCity[0])}
            title="点击在地图上查看主场足迹"
          >
            <span className={styles.geoValue}>{homeCity[0]}</span>
            <span className={styles.geoLabel}>
              {fmtKm(homeCity[1])} KM · Home / 主场
            </span>
          </button>
        ) : null}
      </div>

      <div className={styles.body}>
        {cityArr.length ? (
          <div className={styles.cities}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                Geographic Footprint / 骑行足迹
              </span>
              <span className={styles.panelHint}>
                点击城市，在地图上点亮它的轨迹
              </span>
            </div>
            <div
              className={`${styles.cityList} ${
                expanded ? styles.cityListExpanded : ''
              }`}
            >
              {shownCities.map(([name, meters], i) => (
                <button
                  key={name}
                  type="button"
                  className={styles.cityRow}
                  onClick={() => changeCity(name)}
                  title={`${name} · ${fmtKm(meters)} KM`}
                >
                  <span className={styles.cityName}>{name}</span>
                  <span className={styles.cityTrack}>
                    <span
                      className={styles.cityFill}
                      style={{
                        width: `${Math.max(
                          (meters / maxMeters) * 100,
                          0.6
                        )}%`,
                        background: `color-mix(in srgb, var(--accent) ${Math.round(
                          Math.max(
                            0.24,
                            0.95 - (i / Math.max(1, shownCities.length - 1)) * 0.7
                          ) * 100
                        )}%, transparent)`,
                      }}
                    />
                  </span>
                  <span className={styles.cityKm}>{fmtKm(meters)} KM</span>
                </button>
              ))}
            </div>
            {cityArr.length > PREVIEW_CITIES ? (
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? '收起' : `展开全部 ${cityArr.length} 城`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.rhythm}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>
              Riding Rhythm / 骑行节律
            </span>
            <span className={styles.panelHint}>{periodTotal} Rides</span>
          </div>
          {periodTotal ? (
            <div className={styles.periodBar} role="group" aria-label="时段分布">
              {periods.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  className={`${styles.periodSeg} ${
                    i === 0 ? styles.segFirst : ''
                  } ${i === periods.length - 1 ? styles.segLast : ''}`}
                  style={{
                    flexGrow: p.count,
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                  onClick={() => changePeriod(p.key)}
                  title={`${p.en} · ${p.label}骑行 · ${p.count} Rides`}
                  aria-label={`${p.label} ${p.count} 次`}
                />
              ))}
            </div>
          ) : null}
          <div className={styles.periodLegend}>
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                className={styles.legendItem}
                onClick={() => changePeriod(p.key)}
              >
                <span
                  className={styles.legendDot}
                  style={{
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                />
                <span className={styles.legendName}>{p.label}</span>
                <span className={styles.legendCount}>{p.count}</span>
              </button>
            ))}
          </div>

          <div className={styles.extraKpis}>
            {avgSpeed ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{avgSpeed} km/h</span>
                <span className={styles.kpiLabel}>
                  Average Speed / 平均速度
                </span>
              </div>
            ) : null}
            {streak ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{streak} day</span>
                <span className={styles.kpiLabel}>
                  Longest Streak / 最长连续骑行
                </span>
              </div>
            ) : null}
            {avgHR ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{avgHR}</span>
                <span className={styles.kpiLabel}>
                  Avg Heart Rate / 平均心率
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {records.length ? (
        <div className={styles.records}>
          <div className={styles.recordCard}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                Cycling Records / 骑行纪录
              </span>
              <span className={styles.panelHint}>
                真实历史活动 · 点击纪录查看活动
              </span>
            </div>
            <div className={styles.recordList}>
              {records.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className={styles.recordRowButton}
                  onClick={() =>
                    setSelectedRecord((current) =>
                      current?.run.run_id === r.run.run_id &&
                      current?.label === r.label
                        ? null
                        : r
                    )
                  }
                  aria-pressed={
                    selectedRecord?.label === r.label &&
                    selectedRecord?.run.run_id === r.run.run_id
                  }
                >
                  <span className={styles.recordLabel}>{r.label}</span>
                  <span className={styles.recordValue}>{r.value}</span>
                  <span className={styles.recordDate}>{r.date}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedRecord ? (
        <div className={styles.detailCard}>
          <div className={styles.detailHead}>
            <span className={styles.detailTitle}>{selectedRecord.label}</span>
            <button
              type="button"
              className={styles.detailClose}
              onClick={() => setSelectedRecord(null)}
            >
              返回列表
            </button>
          </div>
          <p className={styles.detailValue}>{selectedRecord.value}</p>
          <dl className={styles.detailGrid}>
            <div>
              <dt>日期 / Date</dt>
              <dd>{selectedRecord.run.start_date_local.slice(0, 10)}</dd>
            </div>
            <div>
              <dt>距离 / Distance</dt>
              <dd>{(selectedRecord.run.distance / 1000).toFixed(2)} km</dd>
            </div>
            <div>
              <dt>时长 / Duration</dt>
              <dd>{fmtDuration(convertMovingTime2Sec(selectedRecord.run.moving_time))}</dd>
            </div>
            <div>
              <dt>速度 / Speed</dt>
              <dd>{(selectedRecord.run.average_speed * 3.6).toFixed(1)} km/h</dd>
            </div>
            <div>
              <dt>爬升 / Elevation</dt>
              <dd>{Math.round(selectedRecord.run.elevation_gain || 0)} m</dd>
            </div>
            <div>
              <dt>心率 / Heart Rate</dt>
              <dd>
                {selectedRecord.run.average_heartrate
                  ? `${Math.round(selectedRecord.run.average_heartrate)} bpm`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>类型 / Type</dt>
              <dd>{selectedRecord.run.subtype || selectedRecord.run.type}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={styles.detailMapButton}
            onClick={() => onViewRun(selectedRecord.run.run_id)}
          >
            在地图中查看轨迹 / View on map
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default JourneyStats;
