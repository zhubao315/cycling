import { useMemo } from 'react';
import Profile from './Profile';
import CoreMetrics from './CoreMetrics';
import YearTrend from './YearTrend';
import {
  buildYearSeries,
  computeTotals,
  formatDateCN,
  formatNumber,
  scopeLabel,
  type MetricKey,
  type RunRecord,
  type RunScope,
} from '@/utils/cyclingStats';
import styles from './style.module.css';

interface ICyclingDashboardProps {
  runs: RunRecord[];
  /** Career runs, narrowed by the city / run-type shortcut but not by year. */
  baseRuns: RunRecord[];
  scopeRuns: RunRecord[];
  scope: RunScope;
  filterNote: string | null;
  selectedMetric: MetricKey;
  onSelectYear: (_year: string) => void;
  onSelectMonth: (_year: number, _month: number) => void;
  onSelectMetric: (_metric: MetricKey) => void;
  onClearScope: () => void;
}

const CyclingDashboard = ({
  runs,
  baseRuns,
  scopeRuns,
  scope,
  filterNote,
  selectedMetric,
  onSelectYear,
  onSelectMonth,
  onSelectMetric,
  onClearScope,
}: ICyclingDashboardProps) => {
  const careerTotals = useMemo(() => computeTotals(runs), [runs]);
  const scopeTotals = useMemo(() => computeTotals(scopeRuns), [scopeRuns]);
  const yearSeries = useMemo(
    () => buildYearSeries(baseRuns),
    [baseRuns]
  );
  const filtering =
    scope.year !== 'all' ||
    scope.month !== null ||
    scope.date !== null ||
    Boolean(filterNote);

  const scopeText = filterNote ?? scopeLabel(scope);
  const suspiciousLongRides = useMemo(
    () =>
      runs.filter(
        (run) =>
          run.seconds > 4 * 3600 &&
          (run.average_speed ?? 0) * 3.6 < 6
      ).length,
    [runs]
  );
  /** First year the device reported heart rate, so the coverage sentence never hard-codes a year. */
  const hrFirstYear = useMemo(() => {
    const years = runs
      .filter((run) => run.average_heartrate)
      .map((run) => run.year);
    return years.length ? Math.min(...years) : null;
  }, [runs]);
  const coveragePercent = (count: number): number =>
    runs.length ? Math.round((count / runs.length) * 100) : 0;
  const elevationCoveragePercent = coveragePercent(
    careerTotals.elevationCount
  );

  return (
    <div className={styles.dashboard}>
      <Profile runs={runs} />

      <nav className={styles.scopeBar} aria-label="当前筛选范围">
        <span className={styles.scopeCaption}>当前范围</span>
        {filtering ? (
          <button
            type="button"
            className={styles.scopeLink}
            onClick={onClearScope}
          >
            全部历史
          </button>
        ) : (
          <span className={styles.scopeCurrent} aria-current="true">
            全部历史
          </span>
        )}

        {scope.year !== 'all' ? (
          <>
            <span className={styles.scopeSep}>/</span>
            {scope.month || scope.date ? (
              <button
                type="button"
                className={styles.scopeLink}
                onClick={() => onSelectYear(scope.year)}
              >
                {scope.year} 年
              </button>
            ) : (
              <span className={styles.scopeCurrent} aria-current="true">
                {scope.year} 年
              </span>
            )}
          </>
        ) : null}

        {scope.month ? (
          <>
            <span className={styles.scopeSep}>/</span>
            {scope.date ? (
              <button
                type="button"
                className={styles.scopeLink}
                onClick={() =>
                  onSelectMonth(Number(scope.year), scope.month as number)
                }
              >
                {scope.month} 月
              </button>
            ) : (
              <span className={styles.scopeCurrent} aria-current="true">
                {scope.month} 月
              </span>
            )}
          </>
        ) : null}

        {scope.date ? (
          <>
            <span className={styles.scopeSep}>/</span>
            <span className={styles.scopeCurrent} aria-current="date">
              {formatDateCN(scope.date)}
            </span>
          </>
        ) : null}

        {filterNote ? (
          <span className={styles.scopeChip}>{filterNote}</span>
        ) : null}

        {filtering ? (
          <button
            type="button"
            className={styles.scopeClear}
            onClick={onClearScope}
          >
            清除筛选 ×
          </button>
        ) : null}
      </nav>

      <CoreMetrics totals={scopeTotals} scope={scopeText} />

      <YearTrend
        series={yearSeries}
        metric={selectedMetric}
        selectedYear={scope.year}
        onSelectMetric={onSelectMetric}
        onSelectYear={onSelectYear}
      />

      <details className={styles.dataNotes}>
        <summary>数据说明</summary>
        <p>
          本页只统计骑行记录：{formatNumber(runs.length)} 条，来自{' '}
          {careerTotals.firstDate} 至 {careerTotals.lastDate}
          ；口径为设备类型为 cycling 且单次里程不低于 3
          km。原始数据按 run_id 去重，缺失值显示为「—」，不以 0
          代替；跑步、徒步与健康数据不混入。
        </p>
        <p>
          累计爬升 {formatNumber(careerTotals.elevationM)} m 来自{' '}
          {formatNumber(careerTotals.elevationCount)} /{' '}
          {formatNumber(runs.length)} 条（
          {elevationCoveragePercent}%）上报了爬升字段的记录，其余记录没有可信
          爬升值，不计入也不以 0 顶替；因此「平均每次爬升」按全部记录摊平，会低
          于真实爬坡强度。2013–2014 年导入的记录原始单位为英尺，已在同步管道中
          统一换算为米。核心指标采用移动均速（total km / total 移动小时）而非配
          速。
        </p>
        <p>
          心率仅 {formatNumber(careerTotals.hrCount)} /{' '}
          {formatNumber(runs.length)} 条记录包含（
          {coveragePercent(careerTotals.hrCount)}%，
          {hrFirstYear ?? '设备开始上报心率的那一年'} 起），心率均值只代表有心率的样本，
          不代表 {hrFirstYear ? `${careerTotals.firstDate?.slice(0, 4)}–${Number(hrFirstYear) - 1}` : '早期'}
          年。另有 {suspiciousLongRides} 条时长超过 4 小时且均速低于 6
          km/h 的疑似忘关表记录，保留在总量中、未做删改，解读均速与时长时需留意。
        </p>
      </details>
    </div>
  );
};

export default CyclingDashboard;
