## EMS 模块说明（输入/决策/输出）

该目录用于承载 **EMS（能量管理系统）** 的核心逻辑，尤其是“输入 → 决策 → 输出”的链路，方便后续你替换为真实协议/真实算法。

### 目录结构

- `src/modules/ems/models.ts`
  - **类型定义**：`EmsInputs` / `EmsDecision` / `EmsOutputs` / `EmsSnapshot`
- `src/modules/ems/decisionEngine.ts`
  - **决策引擎**：`computeEmsSnapshot(...)`
  - 内部会生成/汇聚输入并给出决策与输出（当前为模拟逻辑）
- `src/views/EMS.vue`
  - **UI 展示**：按输入/决策/输出三大块展示
- `src/stores/energyStore.ts`
  - EMS 快照挂载在 `emsSnapshot`，并随全站 tick 刷新

### 输入（EmsInputs）

输入主要来自 3 类：

- **现场设备（PCS / BMS / 保护装置）**
  - 项目内以 `batteryGroups`（每组 1 PCS + 1 BMS）作为“现场设备聚合”
  - 保护装置 `protectionDevices` 当前为 mock，可后续对接真实保护/消防/绝缘等采集
- **协控层信息**
  - 来自 `coordinationUnits`（3 个协控单元）
  - 当前使用：单元状态统计、单元通信统计、可用功率上限、联锁状态/原因等
- **电网调度指令**
  - `dispatch.agcSetpointKw / avcBusVoltageSetpointKv` 以及使能信号
  - 当前为 mock（`generateDispatchCommands()`），后续可替换为真实调度接口

### 决策（EmsDecision）

核心入口：`computeEmsSnapshot({ batteryGroups, coordinationUnits })`

目前决策引擎采用 **规则驱动**，并输出结构化“动作 + 理由”，便于你快速替换为优化/预测/强化学习等算法。

#### 当前决策优先级（可在 `decisionEngine.ts` 内调整）

- **安全优先**：若检测到协控联锁或保护跳闸 → `SAFE_STOP`
  - 目标功率强制为 0
  - 输出：冻结 AGC/AVC 执行、等待联锁解除
- **就绪且正常**：默认执行 `AGC`（功率跟踪），AVC 可并行给出电压目标
  - 目标功率会受“协控可用功率上限”限幅
- **降级/限幅**：若通信异常、现场设备故障、SOC 过低/过高 → `LIMITED`
  - 在限幅策略中会对目标功率施加缩放系数（你可以替换为更精细的分配/约束求解）

#### 输出到协控层（反馈控制）

决策结果会写入：

- `outputs.toCoordinationLayer.stationControlTargetPowerKw`
- `outputs.toCoordinationLayer.stationControlMode`
- `outputs.toCoordinationLayer.targetVoltageKv`

后续你可以在协控模块里把这些目标进一步拆分到每台 PCS（分配/约束/爬坡/优先级）。

### 输出（EmsOutputs）

- **协控层**：全站控制目标（站内智能调控入口）
- **主站**：实际上送功率、可用容量、故障信息（可扩展：预测功率、限电原因、执行偏差等）
- **SCADA**：告警、报表、优化建议、可视化画面建议、决策摘要
  - 当前已在 `EmsSnapshot.outputs.toScada` 里结构化输出，后续做 SCADA 页面时可直接消费

### 后续优化建议（你可能会很快用到）

- **把规则决策替换为约束优化**：
  - 目标：最小化 \(|P_{cmd} - P_{act}|\) + 惩罚项（SOC 边界、温度、故障、通信）
  - 约束：PCS 上下限、爬坡率、联锁/保护、SOC/温度阈值
- **把“可用容量/可用功率”从粗估变成模型计算**
  - 引入 SOC-功率曲线、温度降额、SOH、设备故障可用性
- **决策可解释性**
  - 保留 `actions` / `rationale`，将来直接映射到 SCADA 的“解释面板”


