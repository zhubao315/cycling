import SectionHeader from './SectionHeader';
import TrendChart from './TrendChart';
import {
  METRICS,
  type MetricKey,
  type YearPoint,
} from '@/utils/cyclingStats';
import styles from './style.module.css';

interface IYearTrendProps {
  series: YearPoint[];
  metric: MetricKey;
  selectedYear: string;
  onSelectMetric: (_metric: MetricKey) => void;
  onSelectYear: (_year: string) => void;
}

const YearTrend = ({
  series,
  metric,
  selectedYear,
  onSelectMetric,
  onSelectYear,
}: IYearTrendProps) => {
  const activeMetric = METRICS.find((item) => item.key === metric);

  return (
    <section className={styles.section} aria-labelledby="trend-title">
      <SectionHeader index="03" kicker="YEARLY TREND" title="年度骑行趋势">
        <div className={styles.metricTabs} role="group" aria-label="趋势指标">
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.metricTab} ${
                item.key === metric ? styles.metricTabActive : ''
              }`}
              onClick={() => onSelectMetric(item.key)}
              aria-pressed={item.key === metric}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </div>
      </SectionHeader>

      <TrendChart
        series={series}
        metric={metric}
        selectedYear={selectedYear}
        onSelectYear={onSelectYear}
      />

      <p className={styles.sectionNote}>
        {activeMetric?.hint}。点击年份可下钻到该年的日历与记录。
      </p>
    </section>
  );
};

export default YearTrend;
