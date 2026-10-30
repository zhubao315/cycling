import { useMemo } from 'react';
import SectionHeader from './SectionHeader';
import {
  formatDistanceKm,
  formatDurationLong,
  formatNumber,
  type Totals,
  type RunRecord,
} from '@/utils/cyclingStats';
import styles from './style.module.css';

interface ICoreMetricsProps {
  totals: Totals;
  scope: string;
  runs?: RunRecord[];
}

const CoreMetrics = ({ totals, scope, runs = [] }: ICoreMetricsProps) => {
  const hasRuns = totals.count > 0;
  const avgSpeedKmh =
    totals.seconds > 0
      ? (totals.distanceKm / (totals.seconds / 3600)).toFixed(1)
      : '—';
  const maxDistanceKm = runs.length
    ? Math.max(...runs.map((run) => run.distance / 1000))
    : null;
  const maxElevationM = runs.length
    ? Math.max(...runs.map((run) => run.elevation_gain || 0))
    : null;

  const items = [
    {
      label: '累计骑行里程',
      value: formatDistanceKm(totals.distanceKm),
      unit: 'km',
      sub: hasRuns
        ? `${formatNumber(totals.count)} 次 · 平均 ${formatDistanceKm(
            totals.averageDistanceKm
          )} km`
        : '当前范围没有记录',
    },
    {
      label: '累计骑行时长',
      value: formatDurationLong(totals.seconds),
      unit: '',
      sub: hasRuns
        ? `平均每次 ${formatDurationLong(totals.averageSeconds)}`
        : '当前范围没有记录',
    },
    {
      label: '累计爬升',
      value: formatNumber(totals.elevationM),
      unit: 'm',
      sub: hasRuns
        ? `平均每次 ${formatNumber(
            totals.count ? Math.round(totals.elevationM / totals.count) : 0
          )} m`
        : '当前范围没有记录',
    },
    {
      label: '骑行次数',
      value: formatNumber(totals.count),
      unit: '次',
      sub: hasRuns
        ? `${formatNumber(totals.activeDays)} 个骑行日`
        : '当前范围没有记录',
    },
  ];

  const hrCoverage = totals.count
    ? Math.round((totals.hrCount / totals.count) * 100)
    : 0;

  return (
    <section className={styles.core} aria-labelledby="core-title">
      <SectionHeader index="02" kicker="CORE METRICS" title="核心骑行数据">
        <span className={styles.scopePill}>{scope}</span>
      </SectionHeader>

      <div className={styles.metricsGrid}>
        {items.map((item) => (
          <article key={item.label} className={styles.metricCard}>
            <span className={styles.metricLabel}>{item.label}</span>
            <p className={styles.metricValue}>
              {item.value}
              {item.unit ? (
                <span className={styles.metricUnit}>{item.unit}</span>
              ) : null}
            </p>
            <p className={styles.metricSub}>{item.sub}</p>
          </article>
        ))}
      </div>

      <p className={styles.metricNote}>
        {hasRuns
          ? `平均速度 ${avgSpeedKmh} km/h${
              maxDistanceKm !== null
                ? ` · 最长单次 ${maxDistanceKm.toFixed(2)} km`
                : ''
            }${
              maxElevationM !== null
                ? ` · 最大单次爬升 ${Math.round(maxElevationM)} m`
                : ''
            }。`
          : '当前范围没有记录。'}
        {totals.hrCount > 0
          ? ` 心率均值 ${Math.round(
              totals.hrAverage ?? 0
            )} bpm，仅覆盖 ${formatNumber(totals.hrCount)} / ${formatNumber(
              totals.count
            )} 次（${hrCoverage}%）。`
          : ' 当前数据未包含心率记录。'}
        {' 当前数据未包含功率、踏频或热量字段，相关指标暂不展示。'}
      </p>
    </section>
  );
};

export default CoreMetrics;
