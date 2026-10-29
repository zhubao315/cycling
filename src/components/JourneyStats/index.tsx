import { useMemo, useState } from 'react';
import useActivities from '@/hooks/useActivities';
import { Activity, convertMovingTime2Sec } from '@/utils/utils';
import styles from './style.module.css';

interface IJourneyStatsProps {
  changeCity: (_city: string) => void;
  changeTitle: (_title: string) => void;
}

const PREVIEW_CITIES = 8;

interface RecordRow {
  label: string;
  value: string;
  date: string;
}

interface Records {
  pbRows: RecordRow[];
  prRows: RecordRow[];
}

const fmtDuration = (seconds: number): string => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

// 最快时间：用单次骑行的平均速度推算，骑量不足该距离则不计。
const FAST_DISTANCES = [
  { label: '20 公里', meters: 20000 },
  { label: '50 公里', meters: 50000 },
  { label: '100 公里', meters: 100000 },
  { label: '160 公里', meters: 160000 },
];

// 一天里的顺序：清晨 → 午间 → 午后 → 傍晚 → 夜骑；alpha 越小颜色越暗。
// 骑行数据的标题（晨骑/傍晚骑行/夜骑…）与跑步站的时段常量不同，
// 直接按 start_date_local 的小时分桶，口径与 titleForRun 保持一致。
const DAY_SEGMENTS = [
  { label: '清晨', alpha: 95, minHour: 0, maxHour: 10 },
  { label: '午间', alpha: 76, minHour: 10, maxHour: 14 },
  { label: '午后', alpha: 58, minHour: 14, maxHour: 18 },
  { label: '傍晚', alpha: 44, minHour: 18, maxHour: 21 },
  { label: '夜骑', alpha: 32, minHour: 21, maxHour: 24 },
];

const fmtKm = (meters: number) =>
  Math.round(meters / 1000).toLocaleString('en-US');

const JourneyStats = ({ changeCity }: IJourneyStatsProps) => {
  const { activities, years, countries, provinces, cities } = useActivities();
  const [expanded, setExpanded] = useState(false);

  const cityArr = useMemo(
    () => Object.entries(cities).sort((a, b) => b[1] - a[1]),
    [cities]
  );

  // 与 YearStat 的 Total 行同一套算法：只统计有速度/心率的记录，缺失不补零。
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
  const avgSpeed = totalSeconds ? totalMeters / totalSeconds : null;
  const avgHR = hrCount ? Math.round(hrSum / hrCount) : null;

  const periods = DAY_SEGMENTS.map(({ label, alpha, minHour, maxHour }) => ({
    label,
    alpha,
    count: activities.filter((a) => {
      const hour = +a.start_date_local.slice(11, 13);
      return hour >= minHour && hour < maxHour;
    }).length,
  }));
  const periodTotal = periods.reduce((sum, p) => sum + p.count, 0);

  const milestones = [
    { label: '半百 50K+', meters: 50000 },
    { label: '百公里 100K+', meters: 100000 },
  ].map((m) => ({
    ...m,
    count: activities.filter((a) => a.distance >= m.meters).length,
  }));

  const homeCity = cityArr[0];
  const maxMeters = homeCity ? homeCity[1] : 1;
  const shownCities = expanded ? cityArr : cityArr.slice(0, PREVIEW_CITIES);

  const records = useMemo<Records>(() => {
    const empty: Records = { pbRows: [], prRows: [] };
    const rides = activities.filter(
      (a) => a.distance > 0 && a.average_speed > 0
    );
    if (!rides.length) return empty;

    const dateOf = (a: Activity) => a.start_date_local.slice(0, 10);

    // 「最长时间」只计真实骑行时长：忘关表的记录（时长 > 2h 且均速
    // < 5 km/h）不计入；「最快均速」只计 ≥ 5 km 的骑行，避免短途
    // 刷出虚高均速。
    const realLong = rides.filter(
      (a) =>
        a.average_speed >= 5 / 3.6 ||
        convertMovingTime2Sec(a.moving_time) <= 2 * 3600
    );
    const far = rides.reduce((a, b) => (b.distance > a.distance ? b : a));
    const longest = (realLong.length ? realLong : rides).reduce((a, b) =>
      convertMovingTime2Sec(b.moving_time) > convertMovingTime2Sec(a.moving_time)
        ? b
        : a
    );
    const longRides = rides.filter((a) => a.distance >= 5000);
    const fastest = (longRides.length ? longRides : rides).reduce((a, b) =>
      b.average_speed > a.average_speed ? b : a
    );
    const climb = rides.reduce(
      (a, b) => ((b.elevation_gain || 0) > (a.elevation_gain || 0) ? b : a)
    );

    const pbRows: RecordRow[] = [
      {
        label: '最远距离（公里）',
        value: (far.distance / 1000).toFixed(2),
        date: dateOf(far),
      },
      {
        label: '最长时间',
        value: fmtDuration(convertMovingTime2Sec(longest.moving_time)),
        date: dateOf(longest),
      },
      {
        label: '最大爬升（米）',
        value: Math.round(climb.elevation_gain || 0).toLocaleString('en-US'),
        date: dateOf(climb),
      },
      {
        label: '最快均速（公里 / 小时）',
        value: (fastest.average_speed * 3.6).toFixed(2),
        date: dateOf(fastest),
      },
    ];

    const prRows: RecordRow[] = FAST_DISTANCES.map(({ label, meters }) => {
      const cands = rides.filter((a) => a.distance >= meters);
      if (!cands.length) return null;
      const best = cands.reduce((a, b) =>
        b.average_speed > a.average_speed ? b : a
      );
      return {
        label,
        value: fmtDuration(meters / best.average_speed),
        date: dateOf(best),
      };
    }).filter((r): r is RecordRow => r !== null);

    return { pbRows, prRows };
  }, [activities]);

  return (
    <section className={styles.journey} aria-label="Total Journey">
      <p className={styles.kicker}>Total Journey</p>

      <div className={styles.geoGrid}>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{years.length}</span>
          <span className={styles.geoLabel}>年</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{countries.length}</span>
          <span className={styles.geoLabel}>国家</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{provinces.length}</span>
          <span className={styles.geoLabel}>省份</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{cityArr.length}</span>
          <span className={styles.geoLabel}>城市</span>
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
              {fmtKm(homeCity[1])} KM · 主场
            </span>
          </button>
        ) : null}
      </div>

      <div className={styles.body}>
        {cityArr.length ? (
          <div className={styles.cities}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>城市足迹</span>
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
            <span className={styles.panelTitle}>时段节律</span>
            <span className={styles.panelHint}>{periodTotal} Rides</span>
          </div>
          {periodTotal ? (
            <div className={styles.periodBar} role="group" aria-label="时段分布">
              {periods.map((p, i) => (
                <span
                  key={p.label}
                  className={`${styles.periodSeg} ${
                    i === 0 ? styles.segFirst : ''
                  } ${i === periods.length - 1 ? styles.segLast : ''}`}
                  style={{
                    flexGrow: p.count,
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                  title={`${p.label} · ${p.count} Rides`}
                />
              ))}
            </div>
          ) : null}
          <div className={styles.periodLegend}>
            {periods.map((p) => (
              <span key={p.label} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                />
                <span className={styles.legendName}>{p.label}</span>
                <span className={styles.legendCount}>{p.count}</span>
              </span>
            ))}
          </div>

          <div className={styles.races}>
            {milestones.map((m) => (
              <span key={m.label} className={styles.racePill}>
                <span className={styles.raceLabel}>{m.label}</span>
                <span className={styles.raceCount}>{m.count} Rides</span>
              </span>
            ))}
          </div>

          <div className={styles.extraKpis}>
            {avgSpeed ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>
                  {(avgSpeed * 3.6).toFixed(1)} km/h
                </span>
                <span className={styles.kpiLabel}>Avg Speed</span>
              </div>
            ) : null}
            {streak ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{streak} day</span>
                <span className={styles.kpiLabel}>Streak</span>
              </div>
            ) : null}
            {avgHR ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{avgHR}</span>
                <span className={styles.kpiLabel}>Avg Heart Rate</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {records.pbRows.length ? (
        <div className={styles.records}>
          <div className={styles.recordCard}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>个人最佳</span>
              <span className={styles.panelHint}>历史之最</span>
            </div>
            <div className={styles.recordList}>
              {records.pbRows.map((r) => (
                <div key={r.label} className={styles.recordRow}>
                  <span className={styles.recordLabel}>{r.label}</span>
                  <span className={styles.recordValue}>{r.value}</span>
                  <span className={styles.recordDate}>{r.date}</span>
                </div>
              ))}
            </div>
          </div>
          {records.prRows.length ? (
            <div className={styles.recordCard}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>最快时间</span>
                <span className={styles.panelHint}>按平均速度推算</span>
              </div>
              <div className={styles.recordList}>
                {records.prRows.map((r) => (
                  <div key={r.label} className={styles.recordRow}>
                    <span className={styles.recordLabel}>{r.label}</span>
                    <span className={styles.recordValue}>{r.value}</span>
                    <span className={styles.recordDate}>{r.date}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default JourneyStats;
