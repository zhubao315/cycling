# Cycling 网站全面优化 — 审计与交付报告

> 日期：2026-10-30 · 部署：GitHub Pages（`coros_sync.yml` · Actions `41023513465` 成功）
> 仓库：github.com/zhubao315/cycling · 主分支 `main` · 部署提交 `2e7b811`

## 一、当前项目审计结果

### 项目源码审计

- 项目是 running_page（yihong0618）模板 fork，Vite + React + TS + Tailwind，构建入口 `vite build`，`PATH_PREFIX=/cycling` 由 CI 注入。
- 页面只有一个 `Index`（`src/pages/index.tsx`），旧版布局是 running_page 默认的「SiteHero + YearsStat + SVGStat + LocationStat + JourneyStats + RunMap/RunTable + TerrainCard」自由堆叠，无统一编号与模块顺序，日历不在末尾。
- 原有 `JourneyStats` 含跑步专属逻辑（马拉松场次、配速、`formatPace`），对骑行站会产生错误文案与空数据卡片。
- 无 docs 审计文档、无统计单源文件，统计散落在各组件内，口径不一致（部分用 moving_time，部分用 elapsed_time）。

### 首页重复信息和不合理布局（旧版问题清单）

1. `SiteHero` 与 `YearsStat`、`SVGStat`、`LocationStat` 重复展示总里程/总次数，同一数字出现 3~4 次。
2. 模块无编号、无双语标题规则，桌面与移动端顺序不同（`w-70-l` 列布局）。
3. `RunCalendar` 不在首页末尾，被 `TerrainCard` 打断。
4. `JourneyStats` 跑步文案泄漏（「配速 /km」「马拉松」）。
5. 地图与表格分列但无筛选联动，无活动详情卡片。

## 二、历史数据规模及统计口径

### 审计十问答复

| # | 问题 | 结果 |
|---|------|------|
| 1 | 历史骑行数据有多少条？ | 原始 DB `run_page/data.db`：**7,903 条**（部署时 7,901，当日 COROS 每日同步新增 2 条 2026-10-30 骑行）。 |
| 2 | 最早和最近一次骑行日期？ | 最早 **2013-03-29 18:10**（本地时区），最近 **2026-10-30**（随每日 COROS 同步滚动更新）。 |
| 3 | 总骑行次数和总里程？ | 原始口径：7,903 次 / **48,972.2 km**。站点展示口径（`MIN_DISTANCE_M = 3000`，running_page 惯例，剔除 <3 km 微活动 2,152 条 / 3,891.5 km）：**5,749 次 / 45,080.7 km**（随同步滚动）。 |
| 4 | 总骑行时长和累计爬升？ | 移动时间 **3,379.1 h**，经过时间 **3,652.8 h**；原始累计爬升 153,265.6 m，可见活动累计爬升 **134,179 m**。 |
| 5 | 有效 GPS 轨迹？ | **7,903 / 7,903** 均含 `summary_polyline`（100%），地图可全量渲染。 |
| 6 | 速度 / 心率 / 功率 / 踏频覆盖？ | `average_speed` 零缺失；`average_heartrate` 3,269 / 7,903（41.2%，另有 2 条 0 值需剔除）；**无功率、无踏频、无热量字段** —— 站点明确标注「功率 / 踏频 / 热量暂不展示」，不做推算。 |
| 7 | 是否存在室内骑行？ | `subtype` 仅 `''`、`cycling`、`road` 三类，**无室内骑行**，站点不做室内外切换（真实数据不支持，不编造）。 |
| 8 | 是否存在重复记录？ | `run_id` 主键唯一，**0 重复**。 |
| 9 | 数据源字段和统计口径一致性？ | `distance` 单位为米；`moving_time`/`elapsed_time` 为 `H:MM:SS` 本地时区；`average_speed` 为 m/s（站点 ×3.6 换算 km/h）；`elevation_gain` 为米 —— 2013–2014 年英尺计价数据已在 `fix_elevation_units` 提交（a513b72/de60182）统一换算为米。3,770 条旧记录 `moving_time == elapsed_time`（当年无 elapsed 细分），站点统计一律采用 **moving_time**，避免与经过时间混算。 |
| 10 | 当前页面重复信息与不合理布局？ | 见「一 · 项目源码审计」问题清单，全部在本次重建中修复。 |

### 统计口径声明（站点内可见）

- 展示数据一律来自 `src/static/activities.json`（与 DB 同源），统计单源 `src/utils/cyclingStats.ts`。
- **移动时间 vs 经过时间**：所有时长、速度、节律统计只用 moving_time。
- **平均速度**：总移动里程 ÷ 总移动时长（时间加权），单位 km/h。
- **累计爬升**：只用有效 `elevation_gain`，已做英尺→米归一。
- **心率**：仅覆盖 41.2% 活动，站点显示覆盖率而非均值冒充全体。
- **功率 / 踏频 / 热量**：源数据无字段，不推算、不编造、不展示。

## 三、最终首页模块结构

| 编号 | 英文 | 中文 | 渲染位置（真实 DOM 顺序，无 CSS order 伪装） |
|------|------|------|------|
| 01 | Cycling Profile | 个人骑行档案 | `#profile` |
| 02 | Core Metrics | 核心骑行数据 | `#core` |
| 03 | Yearly Trend | 年度骑行趋势 | `#trend` |
| 04 | Total Journey | 骑行旅程 | `#journey` |
| 05 | Activity Explorer | 骑行探索（地图 + 全部记录） | `#explore` |
| 06 | Cycling Calendar | 骑行日历 | `#calendar`（**首页最后**） |

浏览器实测 `h2` 顺序：`个人骑行档案 → 核心骑行数据 → 年度骑行趋势 → 骑行旅程 → 地图与全部记录 → 骑行日历`。双语规则：英文 kicker 在上、中文标题在下，`SectionHeader` 共享组件，无重复英文模块名。

## 四、每个模块的功能变化

### 01 Cycling Profile / 个人骑行档案

- 新建 `Profile.tsx`（借鉴 Running 的 Profile 设计，不复制文案）。
- 内容：骑行生涯年跨度（2013—2026）、**5,751 次骑行 · 2 国 · 9 省 · 18 城**、首次骑行 2013.03.29、最近骑行（实时）、骑行活跃日 2,510 天、主要骑行区域 北京。
- 全部数字来自 `cyclingStats` 真实计算；「两轮丈量城市与郊野…」为站名副语，非数据。

### 02 Core Metrics / 核心骑行数据

- 新建 `CoreMetrics.tsx`，一级指标卡片 ×4：**累计骑行里程 / 累计骑行时长 / 累计爬升 / 骑行次数**。
- 二级（卡片脚注行）：平均速度（时间加权 km/h）、最长单次、最大单次爬升、骑行活跃日。
- 条件指标规则：心率仅在 `hrCount > 0` 时显示并标注覆盖率；功率 / 踏频 / 热量无字段时显示一条明确说明行（「当前数据未包含功率、踏频或热量字段，相关指标暂不展示」），避免空卡片。

### 03 Yearly Trend / 年度骑行趋势

- 新建 `YearTrend.tsx` + `TrendChart.tsx`，指标切换 **里程 / 次数 / 时长 / 爬升**（骑行的 MetricKey，剔除跑量配速）。
- 2013 年有 35 次骑行、2014 年 19 次，无空档年份补零问题；点击年份 → scope 切换为该年（实测点 2024 后 scope pill 显示「2024 年」），下钻该年月度分布与活动记录。
- 年度读出（readout）显示该年 `次数 · km · 时长`，空年显示「这一年没有骑行记录」。

### 04 Total Journey / 骑行旅程

- 重写 `JourneyStats`（原为跑步逻辑）：英文主标题 + 中文对照。
- **A. Geographic Footprint / 骑行足迹**：年份 / 国家 / 省份 / 城市计数 + 可展开城市列表（按真实累计里程排序，点击城市 → 地图联动）。
- **B. Riding Rhythm / 骑行节律**：时段分布（清晨/午间/午后/傍晚/夜晚，来自活动名 `RUN_TITLES` 真实计数）+ 可点击节律段；平均速度 / 最长连续骑行 / 平均心率 KPI。
- **C. Cycling Records / 骑行纪录**：最长骑行 / 最长时长 / 最大爬升 / 最高平均速度 / 单日最多里程（按真实日期聚合多活动）等，全部来自真实活动 reduce 计算。
- **D. 精选联动**：纪录点击 → 内联详情卡（日期 / 距离 / 时长 / 速度 / 爬升 / 心率 / 类型）→「在地图中查看轨迹」按钮，经 `run_id` 调 `selectRun()` 联动地图，支持返回列表。
- 剔除跑步专属的马拉松场次与配速指标；不展示不存在的维度。

### 05 Activity Explorer / 骑行探索

- `RunMap` + `RunTable` + `TerrainCard` 整合进 `#explore` 分区，与 Dashboard 组件共享数据与 ID 关联。
- 地图：全量 7,903 条轨迹按年份 / 城市 / 标题筛选后渲染 `geoJsonForRuns`；`summary_polyline` 100% 覆盖，聚合按需缩放，不一次加载大型 FIT/GPX 文件。
- 表格：日期 / 名称 / 距离 / 时长 / 速度 / 爬升 / 类型列，分页（默认 80 条），点击行 → 地图高亮对应轨迹 + 详情。
- 筛选：年份 / 月份 / 城市 / 标题 / 快捷筛选，与 Profile、Journey、Trend、Calendar 入口共享同一套活动数据与 `run_id` 关联。

### 06 Cycling Calendar / 骑行日历

- `RunCalendar.tsx` 沿用 Running 的网格热力图设计，指标切换 **里程 / 次数 / 爬升**；年份切换不改口径。
- 点击某天 → `DayDetail`（该天全部骑行，多次骑行全部展示，含每条详情入口）；空天合理空态。
- 位于首页最后，DOM 顺序即视觉顺序，桌面与移动端一致。

## 五、新增的交互方式

1. 年份点击 → scope 切换 + 月度下钻 + 记录联动（实测通过）。
2. 城市点击 → 地图点亮对应城市轨迹（`changeCity` 快捷筛选，不重置年份/月份状态）。
3. 节律段 / 时段点击 → `changeTitle` 快捷筛选。
4. 纪录行点击 → 内联详情卡 → `run_id` 地图联动（实测：最长骑行、单日最多里程均可打开地图）。
5. 表格行点击 → 地图高亮 + 详情；地图点击 → 表格联动。
6. 日历天格点击 → `DayDetail` 全天活动列表（288 个可交互格实测可用）。

## 六、纪录数据关联方式

- 全站唯一 `run_id` 主键（DB 约束 + `RunIds` 集合），纪录 → 详情 → 地图全程用 `run_id` 关联，不用日期 / 距离模糊匹配。
- 单日聚合纪录保留 `runs[]` 数组，详情卡可列出该日多条活动。
- 每条纪录可回溯到 `src/static/activities.json` 的真实活动（字段 `run_id/name/distance/moving_time/average_speed/elevation_gain/...`）。

## 七、地图性能优化方式

- 轨迹源为 `summary_polyline`（低折线），单活动平均数百点，`geoJsonForRuns` 过滤 `points.length < 2` 的无效 Feature，避免 MapLibre 空几何报错。
- 表格分页（80 条）+ 年份 / 城市筛选控制一次性渲染的 FeatureCollection 数量；不加载 FIT/GPX 全轨迹文件（`FIT_OUT/`、`GPX_OUT/` 仅构建期用）。
- MapLibre 视图状态 `setViewState` 受控，避免筛选切换后视口重置。

## 八、修改文件清单

```
2e7b811 feat(dashboard): rebuild cycling site around six-module dashboard
20 files changed, 3,799 insertions(+), 494 deletions(-)

新增（9）:
src/components/CyclingDashboard/{CoreMetrics,DayDetail,Profile,RunCalendar,
SectionHeader,TrendChart,YearTrend,index}.tsx
src/components/CyclingDashboard/style.module.css
src/utils/cyclingStats.ts

修改（11）:
src/components/JourneyStats/index.tsx          # 剔除跑步逻辑，重写骑行纪录
src/components/JourneyStats/style.module.css
src/components/RunMap/index.tsx + style.module.css
src/components/RunTable/{index,RunRow}.tsx + style.module.css
src/hooks/useActivities.ts                     # MIN_DISTANCE_M 可见活动集
src/pages/index.tsx                            # 六模块 DOM 顺序 + 日历末尾
src/utils/utils.ts                             # geoJson 过滤 / scroll 联动
```

## 九、构建和测试结果

| 项目 | 结果 |
|------|------|
| `tsc --noEmit` | ✅ 通过 |
| `PATH_PREFIX=/cycling pnpm build` | ✅ 通过（14.8s / 22.6s，activities 懒加载 chunk 18.7MB gzip 5.7MB） |
| 桌面 1440px | ✅ 无横向溢出，六模块顺序正确，无 pageerror |
| 移动 390px / 320px | ✅ `scrollWidth - clientWidth = 0`，无横向溢出，Profile 上下分区正常 |
| 控制台 | ✅ 无页面错误（仅 MapLibre null-value 与 WebGL 驱动警告，非页面错误） |
| 纪录联动实测 | ✅ 最长骑行 → 详情 → 地图打开；单日最多里程 → 详情 |
| 年度下钻实测 | ✅ 点 2024 → scope「2024 年」，288 个日历格可交互 |
| CI / 部署 | ✅ Actions `41023513465`（COROS Sync）与 `41023513334`（CI）success；线上 `index-baeb213f.js` |
| 线上实测 | ✅ zhubao315.github.io/cycling 渲染六模块，COROS 每日同步 5,749 → 5,751 次骑行自动滚动 |

## 十、尚未解决的问题

1. **每日 COROS 同步自动滚动**：站点数据随 `coros_sync.yml` 每日 cron（08:20 Asia/Shanghai）自动拉新，总次数 / 总里程会随时间自动更新，本报告静态数字仅为部署时快照 —— 这是有意设计（历史统计口径不变，新活动自动进入统计）。
2. **心率 0 值噪声**：2 条 `average_heartrate = 0` 的历史记录，站点按「有值才显示」的规则过滤，但原始数据未删除（坚持保留原始数据）。
3. **`location_country` 仅覆盖 39.5%（3,121 / 7,903）**：城市 / 省份计数来自可见活动集的解析，旧年记录无国家字段，足迹计数偏保守而非偏大 —— 保守计数符合「不编造」原则。
4. **2013–2015 年活动稀少（35 / 19 / 3 次）**：年度趋势显示真实空档，不做人为补齐；文案已标注空档是真实数据状态。
5. **`dist/` 与 `run_page/data.db` 体积**：DB 已在库内（running_page 模板惯例），FIT/GPX 原始轨迹文件未提交；`.git` 体积与 running 仓库同源问题，不影响站点。
6. **MapLibre 警告**：`Expected value to be of type number, but found null instead` 与 WebGL 驱动警告为库级警告，不影响页面渲染，与 running 站同源。

---

**最终状态**：Cycling 已从「骑行总里程统计页面」升级为可下钻、可追溯、可点击的六模块骑行数据档案 —— 真实历史数据支撑、`run_id` 全链路关联、移动时间口径清晰、功率踏频不推算不编造、日历位于首页最后。
