远端# 智能储能实时监控系统

## 项目简介

智能储能实时监控系统是一个基于Vue 3的前端应用，用于实时监控和管理智能储能系统的运行状态。该系统提供了全站概览、设备通信状态监控和数据汇总等功能，支持数据实时更新和分层分级管理。

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由管理**: Vue Router
- **开发语言**: TypeScript

## 项目结构

```
src/
├── components/          # 通用组件
│   ├── StatusCard.vue  # 状态卡片组件
│   └── StatusIndicator.vue  # 状态栏指示器组件
├── composables/        # 组合式函数（预留）
├── router/             # 路由配置
│   └── index.ts        # 路由定义
├── services/           # 服务层
│   └── mockDataService.ts  # 模拟数据服务
├── stores/             # Pinia状态管理
│   └── energyStore.ts  # 能源系统状态管理
├── views/              # 页面视图
│   ├── Dashboard.vue   # 全站概览页面
│   ├── CommunicationStatus.vue  # 设备通信状态页面
│   └── DataSummary.vue # 数据汇总页面
├── App.vue             # 应用根组件
└── main.ts             # 应用入口文件
```

## 主要功能模块

### 1. 全站概览

- 显示系统整体运行状态
- 展示总负载、总功率等关键指标
- 可视化系统架构图
- 快速统计设备数量和状态

### 2. 设备通信状态

- 监控EMS、BMS和电池仓之间的通信
- 显示Modbus通信包的详细信息
- 可视化设备之间的交互关系
- 支持设备选择和详情查看

### 3. 数据汇总

- 遥测量数据展示（电压、电流、温度、SOC、SOH等）
- 遥信量数据展示（告警信息）
- 设备详细数据查询
- 数据筛选和统计分析

### 4. 实时更新

- 数据每5秒自动更新
- 支持手动调整更新频率
- 所有页面数据保持同步

## 接口说明

### 状态管理接口（Pinia Store）

#### energyStore

**状态**:

- `systemStatus`: 系统状态信息
- `telemetryData`: 遥测量数据
- `alarmData`: 告警数据
- `communicationData`: 设备通信数据
- `deviceCounts`: 设备数量统计

**操作**:

- `initData()`: 初始化所有数据
- `updateSystemStatus()`: 更新系统状态
- `updateTelemetryData()`: 更新遥测量数据
- `updateAlarmData()`: 更新告警数据
- `updateAllCommunicationData()`: 更新所有设备通信数据
- `getDeviceTelemetry(type, id)`: 获取特定设备的遥测量数据
- `startRealTimeUpdate()`: 开始实时更新
- `stopRealTimeUpdate()`: 停止实时更新
- `setUpdateInterval(ms)`: 设置更新间隔

### 模拟数据服务接口

#### mockDataService

**生成系统状态**:

- `generateSystemStatus()`: 生成系统状态数据

**生成遥测量数据**:

- `generateTelemetryData()`: 生成系统遥测量数据
- `generateDeviceTelemetry()`: 生成设备遥测量数据

**生成告警数据**:

- `generateAlarmData()`: 生成告警数据

**生成通信数据**:

- `generateModbusPackets(count)`: 生成Modbus通信包数据
- `generateConnectedDevices(device)`: 生成设备连接关系
- `generateCommunicationData(device)`: 生成设备通信数据

## 文件作用说明

### 1. 组件文件

#### `components/StatusCard.vue`

通用状态卡片组件，用于展示各种状态指标，支持不同状态的视觉样式。

**参数**:

- `title`: 卡片标题
- `value`: 显示值
- `status`: 状态（normal/warning/error）

#### `components/StatusIndicator.vue`

页面右上角的状态指示器，显示系统关键指标和当前时间。

### 2. 视图文件

#### `views/Dashboard.vue`

全站概览页面，展示系统整体运行状态和架构图。

#### `views/CommunicationStatus.vue`

设备通信状态页面，展示设备之间的通信关系和Modbus包信息。

#### `views/DataSummary.vue`

数据汇总页面，包含遥测量和遥信量的详细数据和统计分析。

### 3. 服务文件

#### `services/mockDataService.ts`

模拟数据服务，负责生成所有需要的模拟数据，包括系统状态、遥测量、告警和通信数据。

### 4. 状态管理文件

#### `stores/energyStore.ts`

使用Pinia管理应用状态，负责数据的存储、更新和实时同步。

### 5. 路由文件

#### `router/index.ts`

定义应用的路由结构，包括三个主要页面的路由配置。

### 6. 根组件和入口文件

#### `App.vue`

应用的根组件，包含导航菜单和主内容区域的布局。

#### `main.ts`

应用的入口文件，负责初始化Vue应用、配置Pinia和路由。

## 如何运行项目

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端（SQLite + 数据生成器）

后端会使用 SQLite 持久化每 5 秒生成的一次“快照数据”（按时间戳记录），并通过 `/api/*` 提供接口给前端调用。

```bash
npm run server
```

默认配置：

- **端口**：3001（可用 `PORT` 环境变量修改）
- **生成间隔**：5000ms（可用 `GENERATE_INTERVAL_MS` 修改）
- **数据库文件**：`server/data/energy-monitor.db`（可用 `DB_PATH` 修改）

### 3. 开发模式运行（前端）

```bash
npm run dev
```

### 4. 一条命令同时运行前后端（推荐）

```bash
npm run dev:full
```

说明：

- 前端 Vite 会把 `/api` 请求代理到后端 `http://localhost:3001`

### 5. 构建生产版本

```bash
npm run build
```

### 6. 预览生产版本

```bash
npm run preview
```

## 数据实时更新机制

系统采用定时更新机制，默认每5秒更新一次所有数据：

1. 在应用启动时，通过`energyStore.initData()`初始化所有数据
2. 调用`energyStore.startRealTimeUpdate()`开始定时更新
3. 定时任务会更新系统状态、遥测量、告警和通信数据
4. 所有组件通过Pinia的响应式系统自动获取最新数据

## 未来扩展方向

1. **后端接口集成**: 将模拟数据服务替换为真实的后端API接口
2. **数据可视化**: 集成图表库（如ECharts）展示历史趋势数据
3. **用户权限管理**: 添加用户登录和权限控制功能
4. **告警通知**: 实现邮件、短信等告警通知功能
5. **移动端适配**: 优化移动端显示效果
6. **数据导出**: 支持数据导出为Excel或PDF格式

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

MIT License
