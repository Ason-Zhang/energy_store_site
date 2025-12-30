<template>
  <div class="ds">
    <div class="header">
      <div>
        <h1>数据服务器（数据中心）</h1>
        <p class="sub">
          从当前数据库（SQLite）读取历史快照，按时间尺度聚合查询，用于后续分析与报表。
        </p>
      </div>
      <div v-if="range" class="range">
        <div class="ri">
          <span class="k">样本数</span>
          <span class="v">{{ range.count }}</span>
        </div>
        <div class="ri">
          <span class="k">最早</span>
          <span class="v">{{ range.minTs ? fmtTs(range.minTs) : '--' }}</span>
        </div>
        <div class="ri">
          <span class="k">最新</span>
          <span class="v">{{ range.maxTs ? fmtTs(range.maxTs) : '--' }}</span>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'telemetry' }"
          @click="activeTab = 'telemetry'"
        >
          遥测(全站)
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'system' }"
          @click="activeTab = 'system'"
        >
          状态(全站)
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'alarms' }"
          @click="activeTab = 'alarms'"
        >
          告警汇总
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'device' }"
          @click="activeTab = 'device'"
        >
          设备遥测
        </button>
        <button class="tab" :class="{ active: activeTab === 'comm' }" @click="activeTab = 'comm'">
          通信历史
        </button>
      </div>

      <div class="filters">
        <div class="f">
          <span class="k">时间范围</span>
          <select v-model="preset">
            <option value="15m">近15分钟</option>
            <option value="1h">近1小时</option>
            <option value="6h">近6小时</option>
            <option value="1d">近1天</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div class="f" v-if="preset === 'custom'">
          <span class="k">开始</span>
          <input type="datetime-local" v-model="startLocal" />
        </div>
        <div class="f" v-if="preset === 'custom'">
          <span class="k">结束</span>
          <input type="datetime-local" v-model="endLocal" />
        </div>
        <div class="f">
          <span class="k">时间尺度</span>
          <select v-model="bucket">
            <option value="raw">raw</option>
            <option value="5s">5s</option>
            <option value="10s">10s</option>
            <option value="30s">30s</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
          </select>
        </div>
        <div class="f">
          <span class="k">最大点数</span>
          <input type="number" v-model.number="maxPoints" min="50" max="5000" step="50" />
        </div>
        <button class="btn" :disabled="loading" @click="reload">查询</button>
      </div>
    </div>

    <div v-if="error" class="err">{{ error }}</div>

    <div class="panel">
      <div class="ph">
        <div class="t">{{ tabTitle }}</div>
        <div class="s">
          {{ activeTab === 'device' ? `${deviceType.toUpperCase()}-${deviceId}` : '' }}
          {{ activeTab === 'comm' ? `${commType.toUpperCase()}-${commId}` : '' }}
        </div>
      </div>

      <div class="body">
        <div v-if="activeTab === 'device'" class="device-filters">
          <div class="f">
            <span class="k">设备类型</span>
            <select v-model="deviceType">
              <option value="battery">battery</option>
              <option value="bms">bms</option>
            </select>
          </div>
          <div class="f">
            <span class="k">设备ID</span>
            <input type="number" v-model.number="deviceId" min="1" max="10" />
          </div>
        </div>

        <div v-if="activeTab === 'comm'" class="device-filters">
          <div class="f">
            <span class="k">设备类型</span>
            <select v-model="commType">
              <option value="ems">ems</option>
              <option value="bms">bms</option>
              <option value="battery">battery</option>
            </select>
          </div>
          <div class="f">
            <span class="k">设备ID</span>
            <input v-model="commId" placeholder="ems / 1 / ..." />
          </div>
        </div>

        <div v-if="loading" class="loading">查询中…</div>

        <template v-else>
          <!-- simple trend -->
          <div v-if="trendSeries.length" class="trend">
            <div class="trend-title">趋势（采样点 {{ trendSeries.length }}）</div>
            <svg viewBox="0 0 900 140" class="trend-svg">
              <path :d="sparkPath(trendSeries, 900, 140)" class="line" />
            </svg>
          </div>

          <!-- tables -->
          <div v-if="activeTab === 'telemetry'" class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>ts</th>
                  <th>平均电压(V)</th>
                  <th>总电流(A)</th>
                  <th>平均温度(°C)</th>
                  <th>SOC(%)</th>
                  <th>SOH(%)</th>
                  <th>samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in telemetryRows" :key="p.ts">
                  <td class="mono">{{ fmtTs(p.ts) }}</td>
                  <td>{{ p.averageVoltage.toFixed(2) }}</td>
                  <td>{{ p.totalCurrent.toFixed(2) }}</td>
                  <td>{{ Math.round(p.averageTemperature) }}</td>
                  <td>{{ Math.round(p.systemSOC) }}</td>
                  <td>{{ Math.round(p.systemSOH) }}</td>
                  <td>{{ p.samples }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="activeTab === 'system'" class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>ts</th>
                  <th>状态</th>
                  <th>负载(%)</th>
                  <th>总功率(kW)</th>
                  <th>samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in systemRows" :key="p.ts">
                  <td class="mono">{{ fmtTs(p.ts) }}</td>
                  <td>{{ p.status }}</td>
                  <td>{{ p.loadAvg.toFixed(0) }}</td>
                  <td>{{ p.totalPowerAvg.toFixed(0) }}</td>
                  <td>{{ p.samples }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="activeTab === 'alarms'" class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>ts</th>
                  <th>总告警</th>
                  <th>严重</th>
                  <th>告警</th>
                  <th>提示</th>
                  <th>samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in alarmRows" :key="p.ts">
                  <td class="mono">{{ fmtTs(p.ts) }}</td>
                  <td>{{ p.totalAlarms }}</td>
                  <td>{{ p.criticalAlarms }}</td>
                  <td>{{ p.warningAlarms }}</td>
                  <td>{{ p.infoAlarms }}</td>
                  <td>{{ p.samples }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="activeTab === 'device'" class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>ts</th>
                  <th>电压(V)</th>
                  <th>电流(A)</th>
                  <th>温度(°C)</th>
                  <th>SOC(%)</th>
                  <th>SOH(%)</th>
                  <th>功率(kW)</th>
                  <th>状态</th>
                  <th>samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in deviceRows" :key="p.ts">
                  <td class="mono">{{ fmtTs(p.ts) }}</td>
                  <td>{{ p.voltageAvg.toFixed(2) }}</td>
                  <td>{{ p.currentAvg.toFixed(2) }}</td>
                  <td>{{ p.temperatureAvg.toFixed(0) }}</td>
                  <td>{{ p.socAvg.toFixed(0) }}</td>
                  <td>{{ p.sohAvg.toFixed(0) }}</td>
                  <td>{{ p.powerAvg.toFixed(2) }}</td>
                  <td>{{ p.chargingStatus }}</td>
                  <td>{{ p.samples }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>ts</th>
                  <th>状态</th>
                  <th>最后通信时间</th>
                  <th>samples</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in commRows" :key="p.ts">
                  <td class="mono">{{ fmtTs(p.ts) }}</td>
                  <td>{{ p.status }}</td>
                  <td class="mono">{{ p.lastCommTime }}</td>
                  <td>{{ p.samples }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type {
  AlarmSnapshotsHistoryPoint,
  CommunicationHistoryPoint,
  DeviceTelemetryHistoryPoint,
  HistoryBucket,
  HistoryRangeResponse,
  SystemStatusHistoryPoint,
  TelemetryHistoryPoint,
} from '../services/dataApiService'
import {
  getAlarmSnapshotsHistory,
  getCommunicationHistory,
  getDeviceTelemetryHistory,
  getHistoryRange,
  getSystemStatusHistory,
  getTelemetryHistory,
} from '../services/dataApiService'

defineOptions({ name: 'DataServerView' })

type Tab = 'telemetry' | 'system' | 'alarms' | 'device' | 'comm'

const activeTab = ref<Tab>('telemetry')
const bucket = ref<HistoryBucket>('1m')
const maxPoints = ref(800)
const preset = ref<'15m' | '1h' | '6h' | '1d' | 'custom'>('1h')
const startLocal = ref('')
const endLocal = ref('')

const deviceType = ref('battery')
const deviceId = ref(1)
const commType = ref('ems')
const commId = ref('ems')

const loading = ref(false)
const error = ref<string | null>(null)
const range = ref<HistoryRangeResponse | null>(null)

const telemetryRows = ref<TelemetryHistoryPoint[]>([])
const systemRows = ref<SystemStatusHistoryPoint[]>([])
const alarmRows = ref<AlarmSnapshotsHistoryPoint[]>([])
const deviceRows = ref<DeviceTelemetryHistoryPoint[]>([])
const commRows = ref<CommunicationHistoryPoint[]>([])

const fmtTs = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

const toTsFromLocal = (v: string): number | undefined => {
  if (!v) return undefined
  const d = new Date(v)
  const ts = d.getTime()
  return Number.isFinite(ts) ? ts : undefined
}

const computeWindow = (endTs: number, key: string) => {
  const ms =
    key === '15m'
      ? 15 * 60_000
      : key === '1h'
        ? 60 * 60_000
        : key === '6h'
          ? 6 * 60 * 60_000
          : 24 * 60 * 60_000
  return { startTs: endTs - ms, endTs }
}

const queryParams = computed(() => {
  const endTs =
    preset.value === 'custom' ? toTsFromLocal(endLocal.value) : (range.value?.maxTs ?? Date.now())
  const resolvedEnd = endTs ?? Date.now()
  const window =
    preset.value === 'custom'
      ? {
          startTs: toTsFromLocal(startLocal.value) ?? resolvedEnd - 60 * 60_000,
          endTs: resolvedEnd,
        }
      : computeWindow(resolvedEnd, preset.value)
  return { ...window, bucket: bucket.value, maxPoints: maxPoints.value }
})

const tabTitle = computed(() => {
  switch (activeTab.value) {
    case 'telemetry':
      return '遥测量历史（telemetry）'
    case 'system':
      return '系统状态历史（system_status）'
    case 'alarms':
      return '告警快照历史（alarm_snapshots）'
    case 'device':
      return '设备遥测历史（device_telemetry）'
    case 'comm':
      return '通信历史（communication）'
    default:
      return ''
  }
})

const trendSeries = computed(() => {
  if (activeTab.value === 'telemetry') return telemetryRows.value.map((p) => p.systemSOC)
  if (activeTab.value === 'system') return systemRows.value.map((p) => p.totalPowerAvg)
  if (activeTab.value === 'alarms') return alarmRows.value.map((p) => p.totalAlarms)
  if (activeTab.value === 'device') return deviceRows.value.map((p) => p.powerAvg)
  return commRows.value.map((p) => (p.status === 'online' ? 1 : p.status === 'degraded' ? 0.5 : 0))
})

const sparkPath = (ys: number[], w: number, h: number) => {
  if (!ys.length) return ''
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const step = w / Math.max(1, ys.length - 1)
  return ys
    .map((y, i) => {
      const x = i * step
      const yy = h - 10 - ((y - min) / span) * (h - 20)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)}`
    })
    .join(' ')
}

const reload = async () => {
  loading.value = true
  error.value = null
  try {
    const q = queryParams.value
    if (activeTab.value === 'telemetry') telemetryRows.value = await getTelemetryHistory(q)
    else if (activeTab.value === 'system') systemRows.value = await getSystemStatusHistory(q)
    else if (activeTab.value === 'alarms') alarmRows.value = await getAlarmSnapshotsHistory(q)
    else if (activeTab.value === 'device')
      deviceRows.value = await getDeviceTelemetryHistory({
        ...q,
        type: deviceType.value,
        id: deviceId.value,
      })
    else
      commRows.value = await getCommunicationHistory({
        ...q,
        type: commType.value,
        id: commId.value,
      })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    range.value = await getHistoryRange()
    if (range.value?.maxTs) {
      const d = new Date(range.value.maxTs)
      endLocal.value = d.toISOString().slice(0, 16)
      startLocal.value = new Date(range.value.maxTs - 60 * 60_000).toISOString().slice(0, 16)
    }
    await reload()
  } catch (e) {
    error.value =
      (e instanceof Error ? e.message : String(e)) +
      '（提示：若 /api/history/* 返回 404，请重启后端 npm run server 使新接口生效）'
  }
})
</script>

<style scoped>
.ds {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 14px;
}

.header h1 {
  margin: 0 0 6px 0;
  font-size: 28px;
  color: #1a202c;
}

.sub {
  margin: 0;
  font-size: 14px;
  color: #718096;
  max-width: 980px;
}

.range {
  display: flex;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.ri {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ri .k {
  font-size: 12px;
  color: #718096;
}
.ri .v {
  font-size: 13px;
  font-weight: 900;
  color: #2d3748;
}

.controls {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 12px;
  margin-bottom: 14px;
}

.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.tab {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f7fafc;
  font-weight: 900;
  cursor: pointer;
}
.tab.active {
  background: #0b1220;
  color: #e8f0ff;
  border-color: rgba(0, 212, 255, 0.35);
}

.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: end;
}

.f {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.f .k {
  font-size: 12px;
  color: #718096;
  font-weight: 800;
}
.f select,
.f input {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f7fafc;
  font-weight: 800;
  color: #2d3748;
}

.btn {
  padding: 9px 14px;
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.35);
  background: #0b1220;
  color: #e8f0ff;
  font-weight: 1000;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.ph {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.ph .t {
  font-weight: 1000;
  color: #1a202c;
}
.ph .s {
  font-size: 12px;
  color: #718096;
  font-weight: 800;
}

.body {
  padding: 12px 14px 14px;
}

.device-filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: end;
  margin-bottom: 10px;
}

.loading {
  color: #718096;
  font-weight: 900;
  padding: 10px 0;
}

.err {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #feb2b2;
  background: #fff5f5;
  border-radius: 12px;
  color: #742a2a;
  font-weight: 900;
}

.trend {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #0b1220;
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #e8f0ff;
}
.trend-title {
  font-weight: 1000;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.7);
  margin-bottom: 8px;
}
.trend-svg {
  width: 100%;
  height: 140px;
}
.line {
  fill: none;
  stroke: #00d4ff;
  stroke-width: 3;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.28));
}

.table-wrap {
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  max-height: 520px;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.tbl th {
  text-align: left;
  padding: 10px;
  background: #f7fafc;
  border-bottom: 2px solid #e2e8f0;
  color: #4a5568;
  white-space: nowrap;
  font-weight: 900;
}
.tbl td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
  white-space: nowrap;
  font-weight: 800;
}
.tbl tr:hover td {
  background: #f7fafc;
}
.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}
</style>
