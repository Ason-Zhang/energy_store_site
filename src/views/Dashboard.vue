<template>
  <div class="dashboard">
    <!-- 顶部状态栏 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1>智能储能实时监控系统</h1>
        <div class="system-time">{{ currentTime }}</div>
      </div>
      <div class="header-right">
        <StatusIndicator />
        <div class="connection-status">
          <div class="status-dot" :class="connectionStatus"></div>
          <span>{{ connectionStatusText }}</span>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="dashboard-main">
      <!-- 左侧：实时监控和统计 -->
      <div class="left-panel">
        <!-- 实时仪表板 -->
        <div class="metric-cards">
          <div class="metric-card primary">
            <div class="metric-header">
              <div class="metric-icon">⚡</div>
              <div class="metric-title">实时功率</div>
            </div>
            <div class="metric-value">
              {{ realTimePower.toFixed(1) }} <span class="unit">kW</span>
            </div>
            <div class="metric-trend" :class="powerTrend">
              <span class="trend-arrow">{{
                powerTrend === 'up' ? '↗' : powerTrend === 'down' ? '↘' : '→'
              }}</span>
              <span class="trend-text">{{ powerTrendText }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon">🔋</div>
              <div class="metric-title">系统SOC</div>
            </div>
            <div class="metric-value">
              {{ telemetryData.systemSOC }} <span class="unit">%</span>
            </div>
            <div class="soc-bar">
              <div class="soc-fill" :style="{ width: telemetryData.systemSOC + '%' }"></div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon">🌡️</div>
              <div class="metric-title">平均温度</div>
            </div>
            <div class="metric-value">
              {{ telemetryData.averageTemperature }} <span class="unit">°C</span>
            </div>
            <div class="temp-status" :class="getTempStatus(telemetryData.averageTemperature)">
              {{ getTempStatusText(telemetryData.averageTemperature) }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <div class="metric-icon">⚠️</div>
              <div class="metric-title">告警数量</div>
            </div>
            <div class="metric-value">{{ alarmData.totalAlarms }}</div>
            <div class="alarm-breakdown">
              <span class="critical">{{ alarmData.criticalAlarms }}</span>
              <span class="warning">{{ alarmData.warningAlarms }}</span>
              <span class="info">{{ alarmData.infoAlarms }}</span>
            </div>
          </div>
        </div>

        <!-- 控制命令状态 -->
        <div class="control-status">
          <h3>控制状态</h3>
          <div class="control-items">
            <div class="control-item" :class="{ active: controlCommands.agc.enabled }">
              <div class="control-icon">🎯</div>
              <div class="control-info">
                <div class="control-name">AGC</div>
                <div class="control-value">{{ controlCommands.agc.targetPower }}kW</div>
              </div>
              <div
                class="control-status-dot"
                :class="{ active: controlCommands.agc.enabled }"
              ></div>
            </div>

            <div class="control-item" :class="{ active: controlCommands.avc.enabled }">
              <div class="control-icon">⚡</div>
              <div class="control-info">
                <div class="control-name">AVC</div>
                <div class="control-value">{{ controlCommands.avc.targetVoltage }}V</div>
              </div>
              <div
                class="control-status-dot"
                :class="{ active: controlCommands.avc.enabled }"
              ></div>
            </div>

            <div class="control-item" :class="{ active: controlCommands.manualPower.enabled }">
              <div class="control-icon">🛠️</div>
              <div class="control-info">
                <div class="control-name">手动</div>
                <div class="control-value">{{ controlCommands.manualPower.targetPower }}kW</div>
              </div>
              <div
                class="control-status-dot"
                :class="{ active: controlCommands.manualPower.enabled }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 设备统计 -->
        <div class="device-stats">
          <h3>设备状态统计</h3>
          <div class="device-grid">
            <div class="device-stat">
              <div class="device-count">{{ deviceCounts.batteryBins }}</div>
              <div class="device-label">电池仓</div>
              <div class="device-health">
                <div class="health-bar">
                  <div class="health-fill normal" :style="{ width: '95%' }"></div>
                </div>
              </div>
            </div>

            <div class="device-stat">
              <div class="device-count">{{ deviceCounts.bms }}</div>
              <div class="device-label">BMS</div>
              <div class="device-health">
                <div class="health-bar">
                  <div class="health-fill normal" :style="{ width: '92%' }"></div>
                </div>
              </div>
            </div>

            <div class="device-stat">
              <div class="device-count">{{ coordinationUnits.length }}</div>
              <div class="device-label">协控单元</div>
              <div class="device-health">
                <div class="health-bar">
                  <div class="health-fill normal" :style="{ width: '98%' }"></div>
                </div>
              </div>
            </div>

            <div class="device-stat">
              <div class="device-count">{{ batteryGroups.length }}</div>
              <div class="device-label">PCS 单元</div>
              <div class="device-health">
                <div class="health-bar">
                  <div class="health-fill warning" :style="{ width: '88%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：系统架构和命令控制 -->
      <div class="right-panel">
        <!-- 系统架构可视化 -->
        <div class="system-architecture">
          <div class="arch-header">
            <h2>系统架构拓扑</h2>
            <div class="arch-controls">
              <button
                class="arch-btn"
                :class="{ active: archView === 'overview' }"
                @click="archView = 'overview'"
              >
                简化(4)
              </button>
              <button
                class="arch-btn"
                :class="{ active: archView === 'detail' }"
                @click="archView = 'detail'"
              >
                全量(10)
              </button>
            </div>
          </div>

          <div ref="archCanvasRef" class="architecture-canvas" :class="archView">
            <!-- 动态连接线（根据节点实际位置计算） -->
            <svg class="topology-lines" aria-hidden="true">
              <defs>
                <linearGradient id="topoG" x1="0" x2="1">
                  <stop offset="0" stop-color="#3b82f6" stop-opacity="0.6" />
                  <stop offset="1" stop-color="#10b981" stop-opacity="0.6" />
                </linearGradient>
                <filter id="topoGlow">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                v-for="(d, idx) in topologyPaths"
                :key="idx"
                :d="d"
                class="topo-path"
                filter="url(#topoGlow)"
              />
            </svg>

            <!-- 电网层 -->
            <div class="layer grid-layer">
              <div ref="gridRef" class="node grid-node" @click="goEms('inputs')">
                <div class="node-icon">🌐</div>
                <div class="node-label">电网</div>
                <div class="node-status normal">正常</div>
              </div>
            </div>

            <!-- 变压器层 -->
            <div class="layer transformer-layer">
              <div ref="transformerRef" class="node transformer-node" @click="goEms('inputs')">
                <div class="node-icon">🔄</div>
                <div class="node-label">变压器</div>
                <div class="node-status normal">正常</div>
              </div>
            </div>

            <!-- EMS层 -->
            <div class="layer ems-layer">
              <div
                ref="emsRef"
                class="node ems-node"
                :class="{ active: systemStatus.status === 'normal' }"
                @click="goEms('decision')"
              >
                <div class="node-icon">🧠</div>
                <div class="node-label">EMS</div>
                <div class="node-status" :class="systemStatus.status">
                  {{ systemStatus.status === 'normal' ? '正常' : '异常' }}
                </div>
                <div class="node-metrics">
                  <div class="metric">{{ systemStatus.totalPower }}kW</div>
                  <div class="metric">{{ systemStatus.load }}%</div>
                </div>
              </div>
            </div>

            <!-- 协控层 -->
            <div class="layer coordination-layer">
              <div class="coordination-nodes">
                <div
                  v-for="unit in coordinationUnits.slice(0, 3)"
                  :key="unit.unitId"
                  :ref="(el) => setCcuRef(unit.unitId, el as HTMLElement | null)"
                  class="node coord-node"
                  :class="{ active: unit.status === 'normal' }"
                  @click="goCcu(unit.unitId)"
                >
                  <div class="node-icon">⚙️</div>
                  <div class="node-label">CCU{{ unit.unitId }}</div>
                  <div class="node-status" :class="unit.status">
                    {{ unit.status === 'normal' ? '正常' : '异常' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- PCS层 -->
            <div class="layer pcs-layer">
              <div class="pcs-nodes">
                <div
                  v-for="(group, idx) in displayGroups"
                  :key="group.id"
                  :ref="(el) => setGroupRef('pcs', idx, el as HTMLElement | null)"
                  class="node pcs-node"
                  :class="{ active: group.status === 'normal' }"
                  @click="goBatteryGroup(group.id)"
                >
                  <div class="node-icon">🔌</div>
                  <div class="node-label">PCS{{ group.id }}</div>
                  <div class="node-status" :class="group.status">
                    {{ group.status === 'normal' ? '正常' : '异常' }}
                  </div>
                  <div class="node-metrics">
                    <div class="metric">{{ group.pcs.actualKw }}kW</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- BMS层 -->
            <div class="layer bms-layer">
              <div class="bms-nodes">
                <div
                  v-for="(group, idx) in displayGroups"
                  :key="'bms-' + group.id"
                  :ref="(el) => setGroupRef('bms', idx, el as HTMLElement | null)"
                  class="node bms-node"
                  :class="{ active: group.bms.status === 'normal' }"
                  @click="goBatteryGroup(group.id)"
                >
                  <div class="node-icon">🔋</div>
                  <div class="node-label">BMS{{ group.id }}</div>
                  <div class="node-status" :class="group.bms.status">
                    {{ group.bms.status === 'normal' ? '正常' : '异常' }}
                  </div>
                  <div class="node-metrics">
                    <div class="metric">{{ group.bms.socPct }}%</div>
                    <div class="metric">{{ group.bms.temperatureC }}°C</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 电池层 -->
            <div class="layer battery-layer">
              <div class="battery-nodes">
                <div
                  v-for="(group, idx) in displayGroups"
                  :key="'bat-' + group.id"
                  :ref="(el) => setGroupRef('bat', idx, el as HTMLElement | null)"
                  class="node battery-node"
                  :class="{ active: group.status === 'normal' }"
                  @click="goBatteryGroup(group.id)"
                >
                  <div class="node-icon">🪫</div>
                  <div class="node-label">BAT{{ group.id }}</div>
                  <div class="node-status" :class="group.status">
                    {{ group.status === 'normal' ? '正常' : '异常' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="control-panel">
          <CommandControls />
          <div v-if="showContribution" class="control-contrib compact">
            <div class="contrib-head">
              <div class="contrib-title">设备调整贡献</div>
              <div class="contrib-meta">
                <span class="chip">目标 {{ stationTargetKw.toFixed(1) }} kW</span>
                <span class="chip">SOC 权重调度</span>
              </div>
            </div>
            <div class="contrib-table-wrap">
              <table class="contrib-table">
                <thead>
                  <tr>
                    <th>组</th>
                    <th>BMS SOC</th>
                    <th>权重</th>
                    <th>目标</th>
                    <th>PCS设定</th>
                    <th>PCS实际</th>
                    <th>需调节</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in contributionRows" :key="row.groupId">
                    <td class="mono">#{{ row.groupId }}</td>
                    <td>{{ row.socPct }}%</td>
                    <td>{{ (row.weight * 100).toFixed(0) }}%</td>
                    <td class="mono neon">{{ row.targetKw.toFixed(1) }}</td>
                    <td class="mono">{{ row.setpointKw.toFixed(1) }}</td>
                    <td class="mono">{{ row.actualKw.toFixed(1) }}</td>
                    <td class="mono" :class="row.adjustKw >= 0 ? 'up' : 'down'">
                      {{ row.adjustKw >= 0 ? '+' : '' }}{{ row.adjustKw.toFixed(1) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="contrib-foot">
              <div class="note">
                SOC 越接近安全边界，权重越低（自动降额）。需调节显示每台 PCS
                相比当前实际还要上/下调多少才能追踪目标。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import StatusIndicator from '../components/StatusIndicator.vue'
import CommandControls from '../components/CommandControls.vue'
import { useEnergyStore } from '../stores/energyStore'

defineOptions({ name: 'EnergyDashboard' })

const energyStore = useEnergyStore()
const router = useRouter()

// 响应式数据
const archView = ref<'overview' | 'detail'>('overview')

// 计算属性
const systemStatus = computed(() => energyStore.systemStatus)
const telemetryData = computed(() => energyStore.telemetryData)
const alarmData = computed(() => energyStore.alarmData)
const deviceCounts = computed(() => energyStore.deviceCounts)
const controlCommands = computed(() => energyStore.getControlCommands)
const coordinationUnits = computed(() => energyStore.coordinationUnits)
const batteryGroups = computed(() => energyStore.batteryGroups)

// 简化/全量切换：影响 PCS/BMS/BAT 显示数量
const displayGroups = computed(() =>
  archView.value === 'overview' ? batteryGroups.value.slice(0, 4) : batteryGroups.value,
)

// --- Topology dynamic lines ---
const archCanvasRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const transformerRef = ref<HTMLElement | null>(null)
const emsRef = ref<HTMLElement | null>(null)

const ccuRefs = ref<Record<number, HTMLElement | null>>({})
const groupRefs = ref<{
  pcs: Array<HTMLElement | null>
  bms: Array<HTMLElement | null>
  bat: Array<HTMLElement | null>
}>({ pcs: [], bms: [], bat: [] })

const setCcuRef = (unitId: number, el: HTMLElement | null) => {
  ccuRefs.value[unitId] = el
}

const setGroupRef = (kind: 'pcs' | 'bms' | 'bat', idx: number, el: HTMLElement | null) => {
  groupRefs.value[kind][idx] = el
}

const topologyPaths = ref<string[]>([])

const goBatteryGroup = (id: number) => {
  void router.push({ path: '/battery-groups', query: { focus: String(id) } })
}

const goCcu = (unitId: number) => {
  void router.push({ path: '/coordination-control', query: { unit: String(unitId) } })
}

const goEms = (section: 'inputs' | 'decision' | 'outputs' = 'inputs') => {
  void router.push({ path: '/ems', query: { section } })
}

const centerOf = (el: HTMLElement, container: HTMLElement) => {
  const r = el.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return {
    x: r.left - c.left + r.width / 2,
    y: r.top - c.top + r.height / 2,
  }
}

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  // 一个轻量的平滑曲线（控制点在 x 方向）
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.35)
  const c1 = { x: a.x + dx, y: a.y }
  const c2 = { x: b.x - dx, y: b.y }
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

const recomputeTopology = async () => {
  await nextTick()
  const container = archCanvasRef.value
  if (!container) return

  const paths: string[] = []

  const g = gridRef.value
  const t = transformerRef.value
  const e = emsRef.value
  if (g && t) paths.push(curve(centerOf(g, container), centerOf(t, container)))
  if (t && e) paths.push(curve(centerOf(t, container), centerOf(e, container)))

  // EMS -> 各 CCU（3 个）
  const units = coordinationUnits.value.slice(0, 3)
  for (const u of units) {
    const ccuEl = ccuRefs.value[u.unitId]
    if (e && ccuEl) paths.push(curve(centerOf(e, container), centerOf(ccuEl, container)))
  }

  // CCU -> PCS -> BMS -> BAT（按组映射到 3 个 CCU）
  const ccuIds = units.map((u) => u.unitId)
  const safeUnitId = (idx: number) => ccuIds[idx % Math.max(1, ccuIds.length)] ?? 1

  for (let i = 0; i < displayGroups.value.length; i++) {
    const unitId = safeUnitId(i)
    const ccuEl = ccuRefs.value[unitId]
    const pcsEl = groupRefs.value.pcs[i]
    const bmsEl = groupRefs.value.bms[i]
    const batEl = groupRefs.value.bat[i]
    if (ccuEl && pcsEl) paths.push(curve(centerOf(ccuEl, container), centerOf(pcsEl, container)))
    if (pcsEl && bmsEl) paths.push(curve(centerOf(pcsEl, container), centerOf(bmsEl, container)))
    if (bmsEl && batEl) paths.push(curve(centerOf(bmsEl, container), centerOf(batEl, container)))
  }

  topologyPaths.value = paths
}

const onResize = () => void recomputeTopology()
onMounted(() => {
  void recomputeTopology()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

watch(
  () => [archView.value, batteryGroups.value.length, coordinationUnits.value.length],
  () => void recomputeTopology(),
)

// 当前时间
const currentTime = computed(() => {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})

// 实时功率计算
const realTimePower = computed(() => {
  return (telemetryData.value.averageVoltage * telemetryData.value.totalCurrent) / 1000
})

// 功率趋势（简化的趋势计算）
const powerTrend = computed(() => {
  const power = realTimePower.value
  const target = controlCommands.value.agc.enabled ? controlCommands.value.agc.targetPower : 0
  const diff = Math.abs(power - target)
  if (diff < 10) return 'stable'
  return power > target ? 'up' : 'down'
})

const powerTrendText = computed(() => {
  const trend = powerTrend.value
  if (trend === 'stable') return '稳定'
  if (trend === 'up') return '上升'
  return '下降'
})

// -----------------------
// AGC/AVC 贡献分解（Dashboard 展示用）
// - 当 AGC/AVC/手动功率启用时，展示每个 BMS/PCS 为达到目标功率所需调节量
// - 分配策略：按 BMS SOC 权重（SOC 接近 20/90 会自动降额），并归一化
// -----------------------

const stationTargetKw = computed(() => {
  if (controlCommands.value.manualPower.enabled)
    return Number(controlCommands.value.manualPower.targetPower ?? 0)
  if (controlCommands.value.agc.enabled) return Number(controlCommands.value.agc.targetPower ?? 0)
  return 0
})

const showContribution = computed(() => {
  return (
    controlCommands.value.agc.enabled ||
    controlCommands.value.avc.enabled ||
    controlCommands.value.manualPower.enabled
  )
})

type ContributionRow = {
  groupId: number
  socPct: number
  weight: number
  targetKw: number
  setpointKw: number
  actualKw: number
  adjustKw: number
}

const contributionRows = computed<ContributionRow[]>(() => {
  const groups = batteryGroups.value
  const target = stationTargetKw.value
  if (!groups.length) return []

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  const denom = 90 - 20

  // 放电(target>0)：SOC 越高权重越大；充电(target<0)：SOC 越低权重越大
  const rawWeights = groups.map((g) => {
    const soc = Number(g.bms.socPct ?? 0)
    if (target >= 0) return clamp01((soc - 20) / denom)
    return clamp01((90 - soc) / denom)
  })

  const sum = rawWeights.reduce((a, b) => a + b, 0)
  const safeSum = sum > 0.001 ? sum : groups.length

  return groups.map((g, idx) => {
    const rw = rawWeights[idx] ?? 0
    const w = sum > 0.001 ? rw / safeSum : 1 / safeSum
    const perTarget = target * w
    const actual = Number(g.pcs.actualKw ?? 0)
    const setpoint = Number(g.pcs.setpointKw ?? 0)
    return {
      groupId: g.id,
      socPct: Number(g.bms.socPct ?? 0),
      weight: w,
      targetKw: perTarget,
      setpointKw: setpoint,
      actualKw: actual,
      adjustKw: perTarget - actual,
    }
  })
})

// 温度状态判断
const getTempStatus = (temp: number) => {
  if (temp < 25) return 'normal'
  if (temp < 35) return 'warning'
  return 'error'
}

const getTempStatusText = (temp: number) => {
  const status = getTempStatus(temp)
  if (status === 'normal') return '正常'
  if (status === 'warning') return '偏高'
  return '过高'
}

// 连接状态
const connectionStatus = computed(() => {
  // 简化的连接状态判断
  const emsStatus = systemStatus.value.status
  const alarmCount = alarmData.value.totalAlarms
  if (emsStatus === 'error' || alarmCount > 5) return 'error'
  if (alarmCount > 0) return 'warning'
  return 'normal'
})

const connectionStatusText = computed(() => {
  const status = connectionStatus.value
  if (status === 'normal') return '连接正常'
  if (status === 'warning') return '连接异常'
  return '连接中断'
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e2e8f0 100%);
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: white;
  padding: 20px 24px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.system-time {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.status-dot.warning {
  background: #f59e0b;
}

.status-dot.error {
  background: #ef4444;
}

.dashboard-main {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  height: calc(100vh - 140px);
}

/* 左侧面板 */
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 实时指标卡片 */
.metric-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.metric-card.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.metric-icon {
  font-size: 20px;
}

.metric-title {
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  opacity: 0.9;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: inherit;
  margin-bottom: 8px;
}

.metric-value .unit {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.8;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.metric-trend.up {
  color: #ef4444;
}

.metric-trend.down {
  color: #10b981;
}

.metric-trend.stable {
  color: #6b7280;
}

.trend-arrow {
  font-size: 14px;
}

.soc-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.soc-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.temp-status {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 12px;
  text-align: center;
}

.temp-status.normal {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.temp-status.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.temp-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.alarm-breakdown {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.alarm-breakdown .critical {
  color: #ef4444;
}

.alarm-breakdown .warning {
  color: #f59e0b;
}

.alarm-breakdown .info {
  color: #6b7280;
}

/* 控制状态 */
.control-status {
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.control-status h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px 0;
}

.control-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.control-item.active {
  background: #dbeafe;
  border: 1px solid #3b82f6;
}

.control-icon {
  font-size: 18px;
}

.control-info {
  flex: 1;
}

.control-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.control-value {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.control-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  transition: background-color 0.2s ease;
}

.control-status-dot.active {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}
.control-contrib {
  margin-top: 16px;
}

.control-contrib .contrib-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 8px;
}

.control-contrib .contrib-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.control-contrib .contrib-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.control-contrib .contrib-meta .chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: #f8fafc;
  color: #374151;
  font-weight: 700;
  font-size: 11px;
}

.control-contrib .contrib-table-wrap {
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.control-contrib .contrib-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.control-contrib th,
.control-contrib td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  text-align: right;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
}

.control-contrib th:first-child,
.control-contrib td:first-child {
  text-align: left;
}

.control-contrib th {
  font-size: 12px;
  background: #f8fafc;
  color: #64748b;
}

.control-contrib .mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.control-contrib .neon {
  color: #2563eb;
}

.control-contrib .up {
  color: #166534;
}

.control-contrib .down {
  color: #991b1b;
}

.control-contrib .contrib-foot {
  margin-top: 8px;
}

.control-contrib .note {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
}

/* 设备统计 */
.device-stats {
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  flex: 1;
}

.device-stats h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px 0;
}

.device-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.device-stat {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
}

.device-count {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  min-width: 40px;
}

.device-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.device-health {
  flex: 1;
}

.health-bar {
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.health-fill.normal {
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
}

.health-fill.warning {
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
}

.health-fill.error {
  background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
}

/* 右侧面板 */
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 系统架构 */
.system-architecture {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  flex: 1;
  display: flex;
  flex-direction: column;
}

.arch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.arch-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.arch-controls {
  display: flex;
  gap: 8px;
}

.arch-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.arch-btn:hover {
  border-color: #9ca3af;
  color: #374151;
}

.arch-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.architecture-canvas {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  position: relative;
}

.layer {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
  justify-content: center;
}

.topology-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.topo-path {
  fill: none;
  stroke: url(#topoG);
  stroke-width: 2.5;
  opacity: 0.85;
  stroke-linecap: round;
}

.coordination-nodes,
.pcs-nodes,
.bms-nodes,
.battery-nodes {
  width: 100%;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.coordination-nodes {
  flex-wrap: nowrap;
}

.architecture-canvas.overview .pcs-nodes,
.architecture-canvas.overview .bms-nodes,
.architecture-canvas.overview .battery-nodes {
  justify-content: center;
}

/* 全量模式：三层设备做成 5×2 网格，列对齐更规整 */
.architecture-canvas.detail .pcs-nodes,
.architecture-canvas.detail .bms-nodes,
.architecture-canvas.detail .battery-nodes {
  display: grid;
  grid-template-columns: repeat(5, minmax(84px, 1fr));
  gap: 10px;
  justify-items: center;
  align-items: start;
}

.architecture-canvas.detail .pcs-node,
.architecture-canvas.detail .bms-node,
.architecture-canvas.detail .battery-node {
  width: 100%;
  max-width: 120px;
}

.connection-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, #e2e8f0 0%, #3b82f6 50%, #e2e8f0 100%);
  border-radius: 1px;
  position: relative;
}

.connection-line::after {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.3) 50%, transparent 100%);
  animation: flow 2s ease-in-out infinite;
}

@keyframes flow {
  0%,
  100% {
    transform: translateX(-20px);
    opacity: 0;
  }
  50% {
    transform: translateX(20px);
    opacity: 1;
  }
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: white;
  border: 2px solid #e2e8f0;
  min-width: 80px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.node.active {
  border-color: #10b981;
  background: #f0fdf4;
}

.node-icon {
  font-size: 20px;
}

.node-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-align: center;
}

.node-status {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
}

.node-status.normal {
  background: #dcfce7;
  color: #166534;
}

.node-status.warning {
  background: #fef3c7;
  color: #92400e;
}

.node-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.node-metrics {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: #6b7280;
}

.metric {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 6px;
}

.grid-node {
  background: linear-gradient(135deg, #1e293b, #334155);
  color: white;
  border: none;
}

.transformer-node {
  background: linear-gradient(135deg, #7c3aed, #8b5cf6);
  color: white;
  border: none;
}

.ems-node {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
}

.coordination-nodes {
  display: flex;
  gap: 8px;
}

.coord-node {
  min-width: 70px;
}

.pcs-nodes {
  display: flex;
  gap: 8px;
}

.pcs-node {
  min-width: 70px;
}

.bms-nodes {
  display: flex;
  gap: 8px;
}

.bms-node {
  min-width: 70px;
}

.battery-nodes {
  display: flex;
  gap: 8px;
}

.battery-node {
  min-width: 70px;
}

/* 命令控制面板 */
.command-panel {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  max-height: 500px;
  overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .dashboard-main {
    grid-template-columns: 280px 1fr;
  }
}

@media (max-width: 1200px) {
  .dashboard-main {
    grid-template-columns: 1fr;
    height: auto;
  }

  .left-panel {
    order: 2;
  }

  .right-panel {
    order: 1;
  }
}
</style>
