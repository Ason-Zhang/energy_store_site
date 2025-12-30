# 系统功能说明与演示指南（function.md）

本文档用于：

- 面向开发者：快速理解系统由哪些部分组成、数据如何流转、核心功能落在哪些代码入口。
- 面向演示者：给客户/同事“完整展示所有功能”时，提供一套从零开始即可复现的演示步骤。

---

## 1. 系统概览

本项目是一个“智能储能实时监控 + 远端站控下发（模拟）”的完整闭环示例系统，包含三部分：

- **后端（Node.js + Express + SQLite）**
  - 定时生成站端数据（默认每 5 秒一笔快照）并写入 SQLite。
  - 提供 `/api/*` JSON 接口，供就地监控前端与远端控制台读取/下发。
  - 负责告警持久化、告警锁存、SCADA 通知模拟、控制指令持久化与日志。

- **就地监控前端（Vue 3 + Vite + Pinia + TypeScript）**
  - 通过 `/api/*` 轮询最新数据并渲染。
  - 展示全站、设备、告警、通信、EMS/协控等页面。
  - 支持电池组故障锁存原因展示与人工复位（单个/一键复位）。

- **远端控制台（remote-console，纯静态 HTML/CSS/JS，由后端静态托管）**
  - 登录后可下发 AGC/AVC/手动功率控制指令。
  - 可查看控制下发历史日志。
  - 与就地监控联动：就地页面会显示“远端指令正在执行”。

---

## 2. 关键能力清单（功能全量）

### 2.1 实时数据与全站概览

- **全站状态**：正常/告警/故障等状态汇总。
- **关键遥测**：功率(kW)、电压(V)、电流(A)、SOC、温度等。
- **实时刷新机制**：默认 5 秒更新一次，前后端一致。

### 2.2 告警体系（持久化 + 汇总 + 详情）

- **告警持久化**：告警不因刷新页面而“消失”，以 `alarm_occurrences` 为权威来源。
- **全系统告警覆盖**：包含 BMS/PCS/协控装置/EMS（保护/安全装置/联动）等来源。
- **告警列表**：支持按时间、按危急程度排序（远端页面已支持）。
- **告警统计**：支持按时间窗口（如 1m/1h/1d）统计及按类型/设备拆分。

### 2.3 电池组异常锁存与复位

- **锁存规则（示例）**：
  - `critical` 告警可直接触发锁存。
  - 或“1 分钟内 >=3 次 warning/critical”触发锁存。
- **锁存原因可追溯**：
  - 若为故障类锁存，展示触发的具体故障描述。
  - 若为频次类锁存，展示触发锁存的多条告警原因明细。
- **人工复位**：
  - 单个电池组复位。
  - 一键复位所有故障/锁存电池组（批量复位）。

### 2.4 SCADA 通知（模拟）

- 当发生锁存或重要事件时，后端写入 `scada_notifications`，前端可查询最新通知列表，用于模拟“站内上送/通知”的效果。

### 2.5 通信状态与数据服务器/前置机视角

- **通信状态页面**：展示设备间通信关系、通信包统计/模拟数据。
- **数据服务器视角**：展示告警汇总、系统数据聚合与一致性（以持久化告警为基础）。
- **前置机视角**：展示前置机相关的模拟状态与数据链路。

### 2.6 远端控制（站控下发）与闭环跟踪

- **控制模式互斥**：AGC / AVC / 手动功率 / 全部关闭。
- **下发日志**：每次下发写入 `control_command_logs`，可查询最近 N 条。
- **就地联动展示**：就地页面显示“远端指令正在执行”。
- **功率跟踪模型（关键）**：
  - 当远端站控调整 AGC/手动功率目标时，就地模拟的电池组 `PCS 实际功率` 会在 **20 秒内**跟踪到目标值。
  - 若出现电池组锁存故障，该组出力按规则降为 0，从而影响全站可达功率。
  - 远端页面的可调功率范围会按系统能力做限制（避免下发不可达目标）。

### 2.7 保护/安全装置（跳闸锁存 + 原因解释 + 手动复位）

- **页面入口**：实地站控 -> `保护/安全装置`（与 EMS 页面显示的装置列表保持一致）。
- **与 EMS 同步**：该页面展示数据来自 `EMS Snapshot`，与 `#/ems` 页面中的保护/安全装置保持一致。
- **正常情况下不随机跳闸**：保护/安全装置的预警/跳闸仅在出现异常条件时触发（例如协控安全信号、直流母线越界、绝缘偏低等）。
- **跳闸锁存**：一旦装置跳闸，会保持在“跳闸/故障”状态，直到执行“手动复位”（模拟线下复位）。
- **原因解释**：
  - 预警/跳闸时会展示详细原因（包含触发条件与关键量，例如最差绝缘所在电池组与数值）。
  - EMS 页面也会同步展示“原因”字段，方便从决策侧追溯。
- **自动状态恒正常**：当 AGC 或 AVC 处于使能状态时，保护/安全装置状态强制显示为“正常”。
- **IMD（绝缘监测装置）策略**：
  - 默认仅对“绝缘偏低”给出预警，不会在正常情况下轻易跳闸。
  - 仅在“绝缘极低”并伴随硬触发信号时才允许跳闸并锁存。

---

## 3. 如何启动（演示前准备）

### 3.1 安装依赖

在项目根目录：

```bash
npm install
```

### 3.2 一条命令同时启动前后端（推荐演示方式）

```bash
npm run dev:full
```

默认端口：

- 后端（Express）：`http://localhost:3001`
- 就地前端（Vite）：`http://localhost:5173`
- 远端控制台（后端静态托管）：`http://localhost:3001/remote/`

### 3.3 只启动后端（仅演示远端控制台或纯 API）

```bash
npm run server
```

### 3.4 远端控制台账号密码

默认账号密码：

- 用户名：`admin`
- 密码：`admin`

可通过环境变量修改：

- `REMOTE_CONSOLE_USER`
- `REMOTE_CONSOLE_PASS`

### 3.5 常用环境变量

- `PORT`：后端端口（默认 3001）
- `GENERATE_INTERVAL_MS`：数据生成间隔（默认 5000ms）
- `DB_PATH`：SQLite 数据库路径

#### 3.5.1 历史数据滚动保留（控制数据库体积）

后端会自动定期清理历史数据，仅保留近一段时间的快照与日志，用于控制 `energy-monitor.db` 以及其 `-wal` 文件的体积。

可通过以下环境变量调整：

- `DATA_RETENTION_HOURS`：保留近 N 小时数据（默认 6）。
- `DATA_MAINTENANCE_INTERVAL_MS`：清理执行间隔（默认 10 分钟）。
- `DATA_WAL_CHECKPOINT`：是否执行 `wal_checkpoint(TRUNCATE)`（默认开启；设置为 `0` 关闭）。

对应代码位置：

- `server/generator.ts`：`createDataGenerator()` 内的 `runMaintenance()` 与 `tick()` 维护逻辑。

---

## 4. 面向“展示所有功能”的演示步骤（建议脚本）

下面是一套推荐的演示顺序：从“可看见的状态”到“可操作的控制”，再到“可追溯的数据与日志”。

### Step 0：确认系统在线

- 打开后端健康检查：
  - `GET http://localhost:3001/api/health` 应返回 `{ ok: true }`

### Step 1：就地监控 - 全站概览（Dashboard）

- 访问：`http://localhost:5173/#/dashboard`（或直接从前端导航进入）
- 演示要点：
  - 实时刷新（默认 5 秒更新）
  - 功率/电压/电流/SOC 等关键指标

### Step 2：就地监控 - 告警日志与告警详情

- 页面：
  - `#/alarm-log`
  - `#/alarm-log/:id`（点击进入详情）
- 演示要点：
  - 告警列表持续存在（刷新不丢）
  - 告警来源覆盖（BMS/PCS/协控/EMS）
  - 查看单条告警的详细信息

### Step 3：就地监控 - 电池组页面（锁存原因 + 复位）

- 页面：`#/battery-groups`
- 演示要点：
  - 某些组会出现告警并触发锁存（模拟）
  - 锁存原因展示：
    - 故障类原因
    - 频次类原因（多条告警明细）
  - 人工复位：
    - 单个组复位
    - 一键复位（批量复位所有故障/锁存组）

### Step 4：就地监控 - 数据服务器告警汇总（DataServer）

- 页面：`#/data-server`
- 演示要点：
  - 告警汇总来自持久化告警（一致、可追溯）
  - 展示全站告警总数与分类统计

### Step 5：就地监控 - SCADA 通知

- 页面：通常在 SCADA 或告警相关区域展示（取决于 UI 布局）
- 接口也可直接演示：
  - `GET /api/scada/notifications/latest?limit=20&offset=0`
- 演示要点：
  - 锁存/重要事件会生成通知记录

### Step 6：远端控制台 - 登录、下发控制、观察闭环

1. 打开远端控制台：

- `http://localhost:3001/remote/`
- 未登录会跳转：`/remote/login.html`

2. 使用默认账号登录：`admin/admin`

3. 下发控制指令并观察就地闭环：

- **AGC 模式**：设置 `targetPower`（例如 300kW、600kW、-300kW）并下发
- 立刻切回就地监控（Dashboard / Scada 页面）观察：
  - “远端指令正在执行”标识
  - 全站功率与电流变化
  - **电池组 PCS 实际功率在 20 秒内跟踪到目标**

4. 打开远端控制台“下发历史”刷新：

- 确认本次下发被记录（时间、操作者、命令概览）

### Step 7：通信状态（CommunicationStatus）

- 页面：`#/communication`
- 演示要点：
  - 设备间通信关系与通信包统计

### Step 8：EMS / 协控相关页面

- 页面：
  - `#/ems`
  - `#/coordination-control`
- 演示要点：
  - EMS/协控装置的状态、联锁/保护类模拟信号与告警关联

### Step 9：实地站控 - 保护/安全装置（原因解释 + 手动复位）

- 页面：`#/protection-safety-devices`
- 演示要点：
  - 选择任意装置查看“监测量（实时）/设置项/事件记录”
  - 当装置出现预警/跳闸时：
    - 查看“告警/动作原因”的详细解释
    - 若为跳闸，点击“手动复位”模拟线下复位
  - 将控制模式切换到 AGC 或 AVC 后，观察：
    - 保护/安全装置状态恒为“正常”（演示自动状态恒正常的要求）

---

## 5. 开发者从哪里开始（阅读与二次开发入口）

### 5.1 最推荐的起点

- **后端入口**：`server/index.ts`
  - Express 路由注册
  - 远端控制台静态托管 `/remote`
  - 远端登录 `/api/remote/login`、会话 `/api/remote/me`
  - 数据生成器定时 tick

- **后端核心 API**：`server/api.ts`
  - “最新数据”查询：系统状态、遥测、告警、电池组、通信
  - 告警统计：`/api/alarm/stats`
  - 锁存与复位：`/api/battery-latches`、`/api/battery-groups/:id/reset`
  - 控制命令读写：`/api/control-commands`、`/api/remote/control-commands`
  - 控制日志：`/api/remote/control-command-logs`

- **后端数据生成器**：`server/generator.ts`
  - 每 5 秒生成快照
  - 写入 `alarm_occurrences`（全系统告警持久化）
  - 执行锁存规则，写入 `battery_latches` 与 `scada_notifications`

- **就地前端状态中枢（Pinia）**：`src/stores/energyStore.ts`
  - 定时拉取 `/api/*` 并驱动所有页面
  - 控制命令状态（显示远端正在执行）

- **就地前端模拟/跟踪逻辑（如果前端需要本地模拟数据）**：`src/services/mockDataService.ts`
  - 生成遥测/告警/通信的模拟数据
  - 功率跟踪（20 秒收敛）与相关仿真状态

- **EMS 决策与保护/安全装置生成**：`src/modules/ems/decisionEngine.ts`
  - `computeEmsSnapshot()`：生成 EMS Snapshot（供 EMS 页面/保护安全装置页面统一使用）
  - 保护/安全装置：异常条件触发 + 跳闸锁存 + 原因解释
  - `resetProtectionDeviceLatch(name)`：手动复位（模拟线下复位）

- **保护/安全装置页面**：`src/views/ProtectionSafetyDevices.vue`
  - 装置列表与详情展示
  - “告警/动作原因”展示
  - “手动复位”按钮（调用 `resetProtectionDeviceLatch`）

- **路由与页面入口**：`src/router/index.ts`
  - 一眼看到所有功能页面入口：Dashboard、BatteryGroups、EMS、Scada、DataServer、AlarmLog、Communication、DataSummary、CoordinationControl...

- **远端控制台入口**：`remote-console/app.js`
  - 登录态校验
  - 控制命令表单
  - 下发命令与日志读取

### 5.2 推荐的二次开发方式

- 新增/调整业务逻辑：优先从 `server/generator.ts`（数据生成/规则）与 `server/api.ts`（查询/写入接口）入手。
- 新增页面：在 `src/views/` 增加页面并在 `src/router/index.ts` 注册。
- 调整刷新周期：修改 `GENERATE_INTERVAL_MS` 或前端轮询间隔（Pinia store 内）。

---

## 6. 常用接口速查（演示/联调用）

- **健康检查**：`GET /api/health`
- **系统状态**：`GET /api/system-status/latest`
- **遥测**：`GET /api/telemetry/latest`
- **告警（最新汇总）**：`GET /api/alarm/latest`
- **告警（最近列表，持久化）**：`GET /api/alarms/recent?limit=50&offset=0`
- **告警统计**：`GET /api/alarm/stats`
- **电池组列表**：`GET /api/battery-groups/latest`
- **锁存列表**：`GET /api/battery-latches`
- **电池组复位**：`POST /api/battery-groups/:id/reset`
- **SCADA 通知**：`GET /api/scada/notifications/latest?limit=20&offset=0`
- **控制命令（就地写入）**：
  - `GET /api/control-commands`
  - `POST /api/control-commands`
- **控制命令（远端，需要登录）**：
  - `POST /api/remote/login`
  - `GET /api/remote/control-commands`
  - `POST /api/remote/control-commands`
  - `GET /api/remote/control-command-logs?limit=30&offset=0`

---

## 7. 演示注意事项（建议）

- 演示闭环控制时，建议开两个窗口：
  - 窗口 A：远端控制台（下发命令）
  - 窗口 B：就地监控（观察功率跟踪、告警、锁存）

- 如果演示时希望“更容易看到锁存/告警”：
  - 等待一段时间（系统会按规则/节奏生成告警）
  - 或通过调整生成策略/周期（开发者可在 `server/generator.ts` 或相关模拟逻辑中调整）
