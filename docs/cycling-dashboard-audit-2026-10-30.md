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
| `PATH_PREFIX=/cycling pnpm build` | ✅ 通过（14.8s / 22.6s；当时 activities 是一个 18.7MB（gzip 5.7MB）的单独 chunk 且随首屏下载 —— 2026-11-06 已拆分，见「十二」。表中所称「懒加载」仅指 manualChunks 单独命名，并非 dynamic import，实际并未延迟） |
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
3. **`location_country` 覆盖 39.4%（3,121 / 7,915）**：设备原生地点仍只有这些。**2026-11-06 起**其余 4,794 条由轨迹坐标离线反查得到 `location_resolved`（见「十一」），地理模块覆盖率因此到 100%——两种来源在页面上分开计数，设备原文优先，派生值不覆盖任何原始字段。派生只回答「这个点落在哪个省／国家」，不推断城市，也不生成任何新的地址文本。
4. **2013–2015 年活动稀少（35 / 19 / 3 次）**：年度趋势显示真实空档，不做人为补齐；文案已标注空档是真实数据状态。
5. **`dist/` 与 `run_page/data.db` 体积**：DB 已在库内（running_page 模板惯例），FIT/GPX 原始轨迹文件未提交；`.git` 体积与 running 仓库同源问题，不影响站点。
6. **MapLibre 警告**：`Expected value to be of type number, but found null instead` 与 WebGL 驱动警告为库级警告，不影响页面渲染，与 running 站同源。

---

**最终状态**：Cycling 已从「骑行总里程统计页面」升级为可下钻、可追溯、可点击的六模块骑行数据档案 —— 真实历史数据支撑、`run_id` 全链路关联、移动时间口径清晰、功率踏频不推算不编造、日历位于首页最后。


---

## 十一、轨迹坐标反查地点（2026-11-06 追加）

### 11.1 问题

7,915 条记录里有 **4,794 条（60%）没有设备写入的地点字符串**。它们计入总里程、时长与日历，却在地理模块里彻底缺席——页面此前只归类设备标注过的那些地点。

### 11.2 机制：离线、可核对、不猜

`run_page/resolve_locations_rh.py`：

1. 纯 Python 解码 Google polyline（precision 5，即站点已有的编码格式）；
2. 先取轨迹**首枚定位点**，只有当它落在所有边界之外时才改取中位点；
3. 国内用站点自带的 34 个省份多边形（`run_page/assets/china_provinces.json`，由 `src/static/run_countries.ts` 提取——**画地图的图层和判地点的图层是同一个**）；国外用 239 个国家多边形（`run_page/assets/world_countries.json`，Natural Earth 公共版权数据 `surbowl/world-geo-json-zh`，剔除中国要素，因为省级图层更细）；
4. 判定为 bbox 预筛 + 射线法，外环减去内环，飞地与湖泊不会被误判。

不联网、不调地理编码服务、不做「最近的city算它」的近似。

结果写入**新字段** `location_resolved`，拼写与设备地址尾部一致（`陕西省, 中国`／`日本`）。`location_country` 一律不动：设备原文永远优先，原始记录不被改写。前端 `locationForRun` 读 `location_country || location_resolved`，Profile 底部如实标注来源各多少次；`run_page/data.db` 以同一个 `run_id` 写入同名列，两份数据保持一致。

### 11.3 准确率：写任何东西之前先测

对**已经带设备地点**的记录按各自轨迹重新反查并逐条比对：**3,120 / 3,120 一致，0 冲突**。`--verify` 重跑同一比对，低于 95% 直接非零退出——将来更换边界是「被检查」，不是「被相信」。

### 11.4 本次结果

| 步骤 | 记录数 |
| --- | ---: |
| 无设备地点 | 4,794 |
| 其中没有 GPS 线（保持空值） | 0 |
| 首枚定位点即命中 | 4,794 |
| 落在所有边界之外（保持空值） | 0 |
| **写入的派生地点** | **4,794** |

分布：北京市 4,727 · 黑龙江省 21 · 陕西省 18 · 辽宁省 15 · 日本 4 · 河北省 3 · 天津市 2 · 广西壮族自治区 1 · 福建省 1 · 河南省 1 · 浙江省 1。数据库镜像 4,794 行全部命中，0 条 `run_id` 对不上。

页面口径还多一层过滤：`useActivities` 只渲染里程 ≥ 3 km 的骑行。部署当日线上实测 **5,765** 条，其中设备原生 **2,204** 条、派生 **3,561** 条——Profile 底部「地点来源」显示的就是这一组数字，而不是上面的全量计数；两者都对，只是范围不同（这 3,561 条里没有一条是因为缺 GPS 线而落空的）。上线后 390／320 px 与 1440 px 同屏实测：pageerror 0、非库告警的 console error 0、横向溢出 0，地理标题为 **2 个国家 · 12 个省份 · 19 座城市**。

把设备地址归一化成同一拼写后统计，地名从 **11 个增至 14 个**，新增 **天津市、福建省、黑龙江省**；日本本就由设备记录点出，不算新增国家。

### 11.5 在 sync 中的位置

`Resolve locations from tracks` 排在全部数据步骤之后、`Check dataset integrity`（`run_page/check_data_integrity_rh.py --sport cycling`）与 `Commit new runs` 之前。集成检查比对 JSON 与 `data.db` 的记录集合、里程、起始时间、总里程以及地点来源计数，任何不一致即拒绝提交。派生地点因此由 CI 从**线上数据**重新生成，本地跑出来的 JSON 不进仓库。

---

## 十二、轨迹与记录分离：首屏不再下载整份轨迹（2026-11-06 追加）

### 12.1 问题

`src/static/activities.json` 一份 20.0 MB 的文件里，7,917 条记录只有 `summary_polyline` 一项就占了绝大部分体积。它被 `useActivities` 静态引入，`manualChunks` 只是把它单独命名（并非 dynamic import），因此每次访问、每个视口都要先下载完这 18.7 MB（gzip 5.78 MB）才会出现第一个数字——而统计、表格、日历、核心指标从来不画线，只有地图需要几何。

### 12.2 机制：构建期拆分，仓库仍只有一份数据

`plugins/splitActivities.ts`（enforce: pre）在 `resolveId` 里认领 `src/static/activities.json`：

- **记录**去掉 `summary_polyline`，其余字段原样，并对手上有几何的记录加一个 `has_track: true`，作为虚拟模块 `virtual:activities-meta` 同步求值——所有统计口径因此完全不变；
- **几何**按 `start_date_local` 年份归入 `data/tracks/tracks-<年份>.json`（`generateBundle` 以 asset 形式产出，共 14 个分片）；
- `vite dev` 由同一插件的中间件按需提供同样的分片（实测 `?import` 模块 3.6 MB，原始文件 19.5 MB；未知年份 404），`handleHotUpdate` 在 JSON 变化时使元数据模块失效。

分片与元数据都是**构建产物，一个字节都不进仓库**：`activities.json` 依旧是唯一数据源，sync 流程、`data.db`、完整性检查都不用改，也不会出现第二份需要保持同步的副本。

运行侧 `src/utils/tracks.ts`：按当前视图需要的年份抓一次、会话内缓存、`trackFor(run_id)` 供 `pathForRun` 解码；`utils.ts` 改为 `run.summary_polyline || trackFor(run.run_id)`，dev 与 prod 两条路都能画。地图标题在几何未齐时显示「轨迹加载中 X/Y」，某年抓取失败则显示「N 个年份的轨迹加载失败」——**加载失败要说出来，而不是悄悄少画几条线冒充全部数据**。

### 12.3 体积与行为（同一份线上数据、同一次构建实测）

| 项目 | 拆分前 | 拆分后 |
| --- | ---: | ---: |
| 首屏必需 | activities chunk 18.7 MB / gzip 5.78 MB | 元数据 3.21 MB / gzip 401 kB |
| 首屏几何 | 全部 7,917 条 | 仅当年 `tracks-2026.json` 2.72 MB / gzip 675 kB |
| 全部历史几何 | 同上，一次下载 | 14 个分片共 15.99 MB / gzip 5.20 MB，按需累计 |

Playwright（1440×900 / 390×844 / 320×568，本地 `dist` 直服）三视口均为：pageerror 0、非库告警的 console error 0、`scrollWidth - clientWidth` 0，首屏只请求 `tracks-2026.json`（断言 ≤4 个分片），载入提示最终消失；点 2019 后追加请求 `tracks-2019.json` 并同样落定；切到全部历史时 14 个分片全部到位后提示消失。标题仍为「Total 全部历史 · 5,765 次 · 45,207.8 km」，与拆分前一致——统计数字没有任何变化。

### 12.4 完整性：一条线都不能少

对构建产物逐条核对：元数据含全部 **7,917** 条记录（cycling 类型即全量，无其他类型），分片含 **7,917** 条几何，与源文件中「非空 `summary_polyline`」的记录数完全相等，且连接后 polyline **逐条一致**。本库不存在「无 GPS 线」的骑行记录，故 `has_track` 对每条为真；「(No map data for this run)」这条文案对现数据不再触发，逻辑保留以防未来出现无轨迹记录。

### 12.5 19 位 `run_id`：与「十三」同一现象，这里为何无害

7,917 条里有 **3,121** 条 `run_id` 大于 2^53，`JSON.parse → stringify` 会把它们写成最短往返小数（Node 实测 `9223370414951006207` → `9223370414951006000`），分片文件里的文本因此与源文件不同——这正是 hiking「十三」记录的那个 IEEE-754 缺陷。它在这里不改变任何结果，原因是两侧都以**同一个 double** 进入 JS：`polylines` 按数字取键，源记录与分片记录是同一个数值。实测：0 例碰撞（7,917 个精确 id 与 7,917 个 double 一一对应），7,917/7,917 可连接，polyline 一致；2019 视图（≥3 km 共 279 条，其中 255 条是 19 位 id）提示消失即是端到端证明。分片是构建产物，从不提交，也不与 `data.db`、`scenes.json` 连接，因此仓库里的 id 文本一字未动；hiking 需要修复的是**已提交的 JSON**，两者不是同一个问题。

### 12.6 为什么只拆 cycling

同一文件在 running 为 4.26 MB、hiking 为 1.10 MB，首屏代价远低于这里拆分前后的差值；拆分要引入分片与运行时取键，收益不抵复杂度，因此暂不套用。若某一站后续增长到同样量级，插件与 `tracks.ts` 是可直接搬用的（`bucketOf`/分片名不含站点假设）。
