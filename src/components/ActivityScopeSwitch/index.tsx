import { useSyncExternalStore } from 'react';
import {
  ACTIVITY_SCOPES,
  getActivityScope,
  setActivityScope,
  subscribeActivityScope,
  type ActivityScope,
} from '@/hooks/useActivities';
import styles from './style.module.css';

/**
 * A single, page-wide switch for the two cycling data views. Every dashboard
 * component reads the same scope from useActivities(), so KPIs, trends,
 * calendar, map and table always use one statistical universe.
 */
const ActivityScopeSwitch = () => {
  const scope = useSyncExternalStore(subscribeActivityScope, getActivityScope);

  return (
    <div className={styles.wrap} role="group" aria-label="骑行数据范围">
      <span className={styles.label}>骑行数据范围</span>
      <div className={styles.segment}>
        {ACTIVITY_SCOPES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`${styles.option} ${scope === option.key ? styles.active : ''}`}
            aria-pressed={scope === option.key}
            onClick={() => setActivityScope(option.key as ActivityScope)}
          >
            <span>{option.label}</span>
            <span className={styles.hint}>{option.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActivityScopeSwitch;
