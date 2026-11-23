import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
let stats;
try {
  stats = await server.ssrLoadModule('/src/utils/cyclingStats.ts');
} finally {
  await server.close();
}

const {
  buildDataset,
  computeTotals,
  availableYears,
  daysInMonth,
  firstWeekdayOffset,
  formatPaceSeconds,
} = stats;

const act = (over = {}) => ({
  run_id: 1,
  name: 'test ride',
  distance: 20000,
  moving_time: '1:00:00',
  type: 'cycling',
  subtype: 'cycling',
  start_date: '2024-03-01 08:00:00',
  start_date_local: '2024-03-01 08:00:00',
  average_speed: 20 / 3.6,
  streak: 1,
  ...over,
});

test('buildDataset 只收 cycling 类型', () => {
  const ds = buildDataset([
    act({ run_id: 1, type: 'cycling' }),
    act({ run_id: 2, type: 'run' }),
    act({ run_id: 3, type: 'hiking' }),
  ]);
  assert.equal(ds.runs.length, 1);
  assert.equal(ds.dropped, 2);
  assert.equal(ds.runs[0].run_id, 1);
});

test('buildDataset 按 run_id 去重，无效行丢弃', () => {
  const ds = buildDataset([
    act({ run_id: 1 }),
    act({ run_id: 1 }),
    act({ run_id: 2, distance: -1 }),
    act({ run_id: 3, moving_time: '0:00:00' }),
    act({ run_id: 4 }),
  ]);
  assert.equal(ds.runs.length, 2);
  assert.equal(ds.dropped, 3);
});

test('爬升缺失不补零：只统计设备真正上报的记录', () => {
  const t = computeTotals(
    buildDataset([
      act({ run_id: 1, elevation_gain: 300 }),
      act({ run_id: 2 }), // 无 elevation_gain
      act({ run_id: 3, elevation_gain: 0 }),
    ]).runs
  );
  assert.equal(t.elevationM, 300);
  assert.equal(t.elevationCount, 1);
});

test('computeTotals 配速为总时长 / 总距离', () => {
  const t = computeTotals(
    buildDataset([
      act({ run_id: 1, distance: 10000, moving_time: '0:30:00' }),
      act({ run_id: 2, distance: 30000, moving_time: '1:30:00' }),
    ]).runs
  );
  assert.equal(t.distanceKm, 40);
  assert.equal(t.seconds, 7200);
  assert.ok(Math.abs(t.paceSecondsPerKm - 180) < 1e-9);
});

test('缺失心率时 hrAverage 为 null', () => {
  const t = computeTotals(buildDataset([act({ run_id: 1 })]).runs);
  assert.equal(t.hrCount, 0);
  assert.equal(t.hrAverage, null);
});

test('≥3 km 双口径的门槛在 useActivities / 分片层，不在统计引擎（口径单一）', () => {
  // 统计引擎只负责「cycling 且有效」；3 km 是视图过滤，不能改统计口径。
  const ds = buildDataset([
    act({ run_id: 1, distance: 2000 }), // 标准视图外
    act({ run_id: 2, distance: 5000 }),
  ]);
  assert.equal(ds.runs.length, 2);
  assert.equal(computeTotals(ds.runs).distanceKm, 7);
});

test('日历边界与年份升序', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(firstWeekdayOffset(2024, 3), 4);
  const ds = buildDataset([
    act({ run_id: 1, start_date_local: '2025-01-01 08:00:00' }),
    act({ run_id: 2, start_date_local: '2024-01-01 08:00:00' }),
  ]);
  assert.deepEqual(availableYears(ds.runs), [2024, 2025]);
});

test('格式化对 null 返回 —', () => {
  assert.equal(formatPaceSeconds(null), '—');
  assert.equal(formatPaceSeconds(180), `3'00"`);
});
