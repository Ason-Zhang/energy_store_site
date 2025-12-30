<template>
  <div class="data-summary">
    <h1>数据汇总</h1>

    <div class="data-tabs">
      <button
        class="tab-button"
        :class="{ active: activeTab === 'telemetry' }"
        @click="activeTab = 'telemetry'"
      >
        遥测量
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === 'alarm' }"
        @click="activeTab = 'alarm'"
      >
        遥信量
      </button>
    </div>

    <div v-if="activeTab === 'telemetry'" class="telemetry-data">
      <h2>遥测量汇总</h2>

      <div class="telemetry-overview">
        <div class="overview-card">
          <h3>系统实时数据</h3>
          <div class="data-grid">
            <div class="data-item">
              <label>当前时间</label>
              <span>{{ telemetryData.currentTime }}</span>
            </div>
            <div class="data-item">
              <label>平均电压</label>
              <span>{{ telemetryData.averageVoltage }} V</span>
            </div>
            <div class="data-item">
              <label>总电流</label>
              <span>{{ telemetryData.totalCurrent }} A</span>
            </div>
            <div class="data-item">
              <label>平均温度</label>
              <span>{{ telemetryData.averageTemperature }} °C</span>
            </div>
            <div class="data-item">
              <label>系统SOC</label>
              <span>{{ telemetryData.systemSOC }} %</span>
            </div>
            <div class="data-item">
              <label>系统SOH</label>
              <span>{{ telemetryData.systemSOH }} %</span>
            </div>
          </div>
        </div>
      </div>

      <div class="device-telemetry">
        <h3>设备详细遥测量</h3>
        <div class="device-selector">
          <select v-model="selectedDeviceType" @change="updateDeviceList">
            <option value="battery">电池仓</option>
            <option value="bms">BMS</option>
          </select>
          <select v-model="selectedDeviceId">
            <option v-for="id in deviceIds" :key="id" :value="id">
              {{ deviceTypeMap[selectedDeviceType] }} {{ id }}
            </option>
          </select>
        </div>

        <div class="telemetry-details">
          <h4>{{ deviceTypeMap[selectedDeviceType] }} {{ selectedDeviceId }} 详细数据</h4>
          <div class="details-grid">
            <div class="detail-item">
              <label>电压</label>
              <span>{{ deviceTelemetry.voltage }} V</span>
            </div>
            <div class="detail-item">
              <label>电流</label>
              <span>{{ deviceTelemetry.current }} A</span>
            </div>
            <div class="detail-item">
              <label>温度</label>
              <span>{{ deviceTelemetry.temperature }} °C</span>
            </div>
            <div class="detail-item">
              <label>SOC</label>
              <span>{{ deviceTelemetry.soc }} %</span>
            </div>
            <div class="detail-item">
              <label>SOH</label>
              <span>{{ deviceTelemetry.soh }} %</span>
            </div>
            <div class="detail-item">
              <label>功率</label>
              <span>{{ deviceTelemetry.power }} kW</span>
            </div>
            <div class="detail-item">
              <label>充放电状态</label>
              <span :class="['status-tag', deviceTelemetry.chargingStatus]">
                {{
                  deviceTelemetry.chargingStatus === 'charging'
                    ? '充电'
                    : deviceTelemetry.chargingStatus === 'discharging'
                      ? '放电'
                      : '待机'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="telemetry-charts">
        <h3>历史趋势</h3>
        <div class="charts-grid">
          <div class="chart-item">
            <h4>电压趋势</h4>
            <div class="chart-container">
              <Line :data="voltageChartData" :options="voltageChartOptions" />
            </div>
          </div>
          <div class="chart-item">
            <h4>电流趋势</h4>
            <div class="chart-container">
              <Line :data="currentChartData" :options="currentChartOptions" />
            </div>
          </div>
          <div class="chart-item">
            <h4>温度趋势</h4>
            <div class="chart-container">
              <Line :data="temperatureChartData" :options="temperatureChartOptions" />
            </div>
          </div>
          <div class="chart-item">
            <h4>SOC趋势</h4>
            <div class="chart-container">
              <Line :data="socChartData" :options="socChartOptions" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'alarm'" class="alarm-data">
      <h2>遥信量汇总</h2>

      <div class="alarm-overview">
        <div class="alarm-stats">
          <div class="stat-card">
            <label>总告警数</label>
            <span class="stat-value">{{ alarmData.totalAlarms }}</span>
          </div>
          <div class="stat-card critical">
            <label>严重告警</label>
            <span class="stat-value">{{ alarmData.criticalAlarms }}</span>
          </div>
          <div class="stat-card warning">
            <label>警告告警</label>
            <span class="stat-value">{{ alarmData.warningAlarms }}</span>
          </div>
          <div class="stat-card info">
            <label>信息告警</label>
            <span class="stat-value">{{ alarmData.infoAlarms }}</span>
          </div>
        </div>
      </div>

      <div class="alarm-list">
        <h3>告警列表</h3>
        <div class="filter-controls">
          <select v-model="alarmFilter">
            <option value="all">全部告警</option>
            <option value="critical">严重</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>
          <button class="filter-button" @click="clearFilters">清除筛选</button>
        </div>

        <div class="alarm-table-container">
          <table class="alarm-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>设备</th>
                <th>告警类型</th>
                <th>告警等级</th>
                <th>描述</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(alarm, index) in filteredAlarms"
                :key="index"
                :class="['alarm-row', alarm.level]"
              >
                <td>{{ alarm.timestamp }}</td>
                <td>{{ alarm.device }}</td>
                <td>{{ alarm.type }}</td>
                <td>
                  <span :class="['alarm-level', alarm.level]">{{ alarm.level }}</span>
                </td>
                <td>{{ alarm.description }}</td>
                <td>
                  <span :class="['alarm-status', alarm.status]">
                    {{ alarm.status === 'active' ? '激活' : '已处理' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="alarm-statistics">
        <h3>告警统计分析</h3>
        <div class="window-selector">
          <button
            class="window-button"
            :class="{ active: selectedAlarmWindow === '1m' }"
            @click="selectedAlarmWindow = '1m'"
          >
            近1分钟
          </button>
          <button
            class="window-button"
            :class="{ active: selectedAlarmWindow === '1h' }"
            @click="selectedAlarmWindow = '1h'"
          >
            近1小时
          </button>
          <button
            class="window-button"
            :class="{ active: selectedAlarmWindow === '1d' }"
            @click="selectedAlarmWindow = '1d'"
          >
            近1天
          </button>

          <div class="window-meta">
            <span v-if="alarmStatsLoading" class="meta-text">统计加载中…</span>
            <span v-else class="meta-text">本窗告警：{{ currentAlarmWindow.total }}</span>
          </div>
        </div>
        <div class="statistics-grid">
          <div class="statistics-card">
            <h4>告警类型分布</h4>
            <div class="chart-container">
              <div v-if="alarmStatsLoading" class="chart-placeholder">加载中…</div>
              <div v-else-if="currentAlarmWindow.total === 0" class="chart-placeholder">
                该时段内无告警
              </div>
              <Bar v-else :data="alarmTypeChartData" :options="alarmBarChartOptions" />
            </div>
          </div>
          <div class="statistics-card">
            <h4>设备告警分布</h4>
            <div class="chart-container">
              <div v-if="alarmStatsLoading" class="chart-placeholder">加载中…</div>
              <div v-else-if="currentAlarmWindow.total === 0" class="chart-placeholder">
                该时段内无告警
              </div>
              <Bar v-else :data="alarmDeviceChartData" :options="alarmBarChartOptions" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useEnergyStore } from '../stores/energyStore'
import type { DeviceTelemetry } from '../services/mockDataService'
import type { AlarmStatsResponse, AlarmStatsWindowKey } from '../services/alarmStats'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import { getAlarmStats } from '../services/dataApiService'

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
)

const energyStore = useEnergyStore()
const activeTab = ref('telemetry')
const selectedDeviceType = ref('battery')
const selectedDeviceId = ref(1)
const alarmFilter = ref('all')
const selectedAlarmWindow = ref<AlarmStatsWindowKey>('1h')

const deviceTypeMap: { [key: string]: string } = {
  battery: '电池仓',
  bms: 'BMS',
}

// 系统遥测量数据 - 确保始终返回有效的对象
const telemetryData = computed(() => {
  // 获取store中的数据
  const data = energyStore.telemetryData
  // 如果数据不存在或缺少必要属性，返回默认值
  if (!data || !data.currentTime) {
    return {
      currentTime: new Date().toLocaleTimeString('zh-CN'),
      averageVoltage: 0,
      totalCurrent: 0,
      averageTemperature: 0,
      systemSOC: 0,
      systemSOH: 0,
    }
  }
  return data
})
// 告警数据 - 提供默认值避免undefined
const alarmData = computed(() => {
  const data = energyStore.alarmData
  if (!data) {
    return {
      totalAlarms: 0,
      criticalAlarms: 0,
      warningAlarms: 0,
      infoAlarms: 0,
      alarmList: [],
    }
  }
  return data
})

// 告警统计（按时间窗聚合：1m/1h/1d）
const alarmStats = ref<AlarmStatsResponse | null>(null)
const alarmStatsLoading = ref(false)

const refreshAlarmStats = async () => {
  if (alarmStatsLoading.value) return
  alarmStatsLoading.value = true
  try {
    alarmStats.value = await getAlarmStats()
  } catch {
    alarmStats.value = {
      generatedAt: Date.now(),
      windows: {
        '1m': { key: '1m', startTs: 0, endTs: 0, total: 0, byType: [], byDevice: [] },
        '1h': { key: '1h', startTs: 0, endTs: 0, total: 0, byType: [], byDevice: [] },
        '1d': { key: '1d', startTs: 0, endTs: 0, total: 0, byType: [], byDevice: [] },
      },
    }
  } finally {
    alarmStatsLoading.value = false
  }
}

const currentAlarmWindow = computed(() => {
  return (
    alarmStats.value?.windows?.[selectedAlarmWindow.value] ?? {
      key: selectedAlarmWindow.value,
      startTs: 0,
      endTs: 0,
      total: 0,
      byType: [],
      byDevice: [],
    }
  )
})

const deviceIds = computed(() => {
  if (selectedDeviceType.value === 'battery') {
    return Array.from({ length: 10 }, (_, i) => i + 1)
  } else {
    return Array.from({ length: 10 }, (_, i) => i + 1)
  }
})

// 设备遥测量数据 - 提供默认值避免undefined
const deviceTelemetry = ref({
  voltage: 0,
  current: 0,
  temperature: 0,
  soc: 0,
  soh: 0,
  power: 0,
  chargingStatus: 'idle',
} as DeviceTelemetry)

const filteredAlarms = computed(() => {
  if (alarmFilter.value === 'all') {
    return alarmData.value.alarmList
  }
  return alarmData.value.alarmList.filter((alarm) => alarm.level === alarmFilter.value)
})

// 更新设备遥测量数据
const updateDeviceTelemetry = () => {
  const data = energyStore.getDeviceTelemetry(selectedDeviceType.value, selectedDeviceId.value)
  if (data) {
    deviceTelemetry.value = data
  }
}

const updateDeviceList = () => {
  selectedDeviceId.value = 1
  updateDeviceTelemetry()
}

// 监听设备选择变化，更新设备遥测量数据
watch([selectedDeviceType, selectedDeviceId], () => {
  updateDeviceTelemetry()
})

// 监听系统实时数据更新，同步刷新“设备详细遥测量”
// 这里用 telemetryData.currentTime 作为“更新节拍”，每次 store 刷新都会触发一次
watch(
  () => energyStore.telemetryData?.currentTime,
  () => {
    updateDeviceTelemetry()
  },
)

// 组件挂载时初始化设备遥测量数据
onMounted(() => {
  updateDeviceTelemetry()
})

// 进入“遥信量”页签后，随着全局刷新节拍（5s）刷新一次统计；避免在其它页签时频繁请求
watch(
  [() => activeTab.value, () => energyStore.telemetryData?.currentTime],
  ([tab]) => {
    if (tab === 'alarm') void refreshAlarmStats()
  },
  { immediate: true },
)

const clearFilters = () => {
  alarmFilter.value = 'all'
}

// 历史趋势数据 - 使用独立的ref变量避免嵌套对象的响应式问题
const historicalLabels = ref<string[]>([])
const historicalVoltageData = ref<number[]>([])
const historicalCurrentData = ref<number[]>([])
const historicalTemperatureData = ref<number[]>([])
const historicalSocData = ref<number[]>([])

// 图表配置
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: false,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: '时间',
      },
      grid: {
        display: false,
      },
    },
    y: {
      title: {
        display: true,
      },
      beginAtZero: false,
    },
  },
  animation: {
    duration: 300,
  },
} satisfies ChartOptions<'line'>

const voltageChartOptions = computed<ChartOptions<'line'>>(() => ({
  ...baseChartOptions,
  scales: {
    ...(baseChartOptions.scales ?? {}),
    y: {
      ...(baseChartOptions.scales?.y ?? {}),
      title: { display: true, text: '电压 (V)' },
    },
  },
}))

const currentChartOptions = computed<ChartOptions<'line'>>(() => ({
  ...baseChartOptions,
  scales: {
    ...(baseChartOptions.scales ?? {}),
    y: {
      ...(baseChartOptions.scales?.y ?? {}),
      title: { display: true, text: '电流 (A)' },
    },
  },
}))

const temperatureChartOptions = computed<ChartOptions<'line'>>(() => ({
  ...baseChartOptions,
  scales: {
    ...(baseChartOptions.scales ?? {}),
    y: {
      ...(baseChartOptions.scales?.y ?? {}),
      title: { display: true, text: '温度 (°C)' },
    },
  },
}))

const socChartOptions = computed<ChartOptions<'line'>>(() => ({
  ...baseChartOptions,
  scales: {
    ...(baseChartOptions.scales ?? {}),
    y: {
      ...(baseChartOptions.scales?.y ?? {}),
      title: { display: true, text: 'SOC (%)' },
    },
  },
}))

// 图表数据类型定义
interface ChartDataset {
  label: string
  data: number[]
  borderColor: string
  backgroundColor: string
  fill: boolean
  tension: number
}

interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

// 告警统计柱状图：堆叠显示各等级
type AlarmBarDataset = {
  label: string
  data: number[]
  backgroundColor: string
  borderColor: string
  borderWidth: number
  stack: string
}

type AlarmBarChartData = {
  labels: string[]
  datasets: AlarmBarDataset[]
}

const alarmBarChartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    x: { stacked: true, ticks: { maxRotation: 40, minRotation: 0 } },
    y: { stacked: true, beginAtZero: true, title: { display: true, text: '数量' } },
  },
  animation: { duration: 200 },
}))

const alarmTypeChartData = computed<AlarmBarChartData>(() => {
  const rows = currentAlarmWindow.value.byType
  const labels = rows.map((r) => r.key)
  return {
    labels: labels.slice(),
    datasets: [
      {
        label: '严重',
        data: rows.map((r) => r.critical).slice(),
        backgroundColor: 'rgba(245, 101, 101, 0.35)',
        borderColor: 'rgba(245, 101, 101, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
      {
        label: '警告',
        data: rows.map((r) => r.warning).slice(),
        backgroundColor: 'rgba(237, 137, 54, 0.35)',
        borderColor: 'rgba(237, 137, 54, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
      {
        label: '信息',
        data: rows.map((r) => r.info).slice(),
        backgroundColor: 'rgba(66, 153, 225, 0.35)',
        borderColor: 'rgba(66, 153, 225, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
    ],
  }
})

const alarmDeviceChartData = computed<AlarmBarChartData>(() => {
  // 设备维度可能很多，这里默认展示 Top10，避免图表过挤
  const rows = currentAlarmWindow.value.byDevice.slice(0, 10)
  const labels = rows.map((r) => r.key)
  return {
    labels: labels.slice(),
    datasets: [
      {
        label: '严重',
        data: rows.map((r) => r.critical).slice(),
        backgroundColor: 'rgba(245, 101, 101, 0.35)',
        borderColor: 'rgba(245, 101, 101, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
      {
        label: '警告',
        data: rows.map((r) => r.warning).slice(),
        backgroundColor: 'rgba(237, 137, 54, 0.35)',
        borderColor: 'rgba(237, 137, 54, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
      {
        label: '信息',
        data: rows.map((r) => r.info).slice(),
        backgroundColor: 'rgba(66, 153, 225, 0.35)',
        borderColor: 'rgba(66, 153, 225, 0.9)',
        borderWidth: 1,
        stack: 'levels',
      },
    ],
  }
})

// 电压图表数据
const voltageChartData = computed<ChartData>(() => ({
  // 重要：传给 chart.js 的数据必须是“非响应式”的普通数组副本
  // 否则 chart.js/vue-chartjs 内部若对数组做 push/splice 等原地修改，
  // 会修改到 Vue Proxy 数组，引发递归更新并最终 Maximum call stack size exceeded。
  // 用 slice()：既会追踪数组迭代/长度变化（push/shift 会触发重算），又会返回普通数组副本
  labels: historicalLabels.value.slice(),
  datasets: [
    {
      label: '电压 (V)',
      data: historicalVoltageData.value.slice(),
      borderColor: '#4299e1',
      backgroundColor: 'rgba(66, 153, 225, 0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

// 电流图表数据
const currentChartData = computed<ChartData>(() => ({
  labels: historicalLabels.value.slice(),
  datasets: [
    {
      label: '电流 (A)',
      data: historicalCurrentData.value.slice(),
      borderColor: '#48bb78',
      backgroundColor: 'rgba(72, 187, 120, 0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

// 温度图表数据
const temperatureChartData = computed<ChartData>(() => ({
  labels: historicalLabels.value.slice(),
  datasets: [
    {
      label: '温度 (°C)',
      data: historicalTemperatureData.value.slice(),
      borderColor: '#ed8936',
      backgroundColor: 'rgba(237, 137, 54, 0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

// SOC图表数据
const socChartData = computed<ChartData>(() => ({
  labels: historicalLabels.value.slice(),
  datasets: [
    {
      label: 'SOC (%)',
      data: historicalSocData.value.slice(),
      borderColor: '#9f7aea',
      backgroundColor: 'rgba(159, 122, 234, 0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

// 历史趋势：只保留最近 8 次“页面（store）更新”的数据点
const MAX_HISTORY_POINTS = 8
const lastHistoryKey = ref<string>('')
// 注意：图表数据的 computed 必须能“追踪到数组长度/迭代”，否则 push 不会触发重算。
// 我们会用 slice() 既触发追踪，又返回普通数组，避免 chart.js 修改到 Vue Proxy。

const pushHistoricalPoint = (telemetry: typeof energyStore.telemetryData) => {
  if (!telemetry || !telemetry.currentTime) return

  // 去重：避免同一条 telemetry 被重复入队（比如 watch 某些情况下触发多次）
  if (telemetry.currentTime === lastHistoryKey.value) {
    return
  }
  lastHistoryKey.value = telemetry.currentTime

  historicalLabels.value.push(telemetry.currentTime)
  historicalVoltageData.value.push(telemetry.averageVoltage)
  historicalCurrentData.value.push(telemetry.totalCurrent)
  historicalTemperatureData.value.push(telemetry.averageTemperature)
  historicalSocData.value.push(telemetry.systemSOC)

  // 滑动窗口：只保留最新的 8 条
  while (historicalLabels.value.length > MAX_HISTORY_POINTS) {
    historicalLabels.value.shift()
    historicalVoltageData.value.shift()
    historicalCurrentData.value.shift()
    historicalTemperatureData.value.shift()
    historicalSocData.value.shift()
  }
}

// 监听遥测数据变化，更新历史数据
watch(
  // 直接监听整个对象的引用变化（store 每次更新会替换为新对象）
  () => energyStore.telemetryData,
  (newData) => pushHistoricalPoint(newData),
  { immediate: true },
)

// 组件挂载时：如果已经有遥测数据，补一条初始点（避免图表空白）
onMounted(() => {
  pushHistoricalPoint(energyStore.telemetryData)
})
</script>

<style scoped>
.data-summary {
  padding: 20px;
}

.data-summary h1 {
  font-size: 28px;
  color: #1a202c;
  margin-bottom: 30px;
}

.data-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}

.tab-button {
  padding: 12px 30px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-button:hover {
  border-color: #4299e1;
  background: #ebf8ff;
}

.tab-button.active {
  background: #4299e1;
  border-color: #4299e1;
  color: white;
}

.telemetry-data h2,
.alarm-data h2 {
  font-size: 24px;
  color: #2d3748;
  margin-bottom: 20px;
}

.telemetry-overview {
  margin-bottom: 40px;
}

.overview-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.overview-card h3 {
  font-size: 18px;
  color: #4a5568;
  margin-bottom: 20px;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
}

.data-item span {
  font-size: 24px;
  color: #2d3748;
  font-weight: 600;
}

.device-telemetry {
  margin-bottom: 40px;
}

.device-telemetry h3 {
  font-size: 20px;
  color: #2d3748;
  margin-bottom: 20px;
}

.device-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.device-selector select {
  padding: 10px 20px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  background: white;
}

.telemetry-details {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.telemetry-details h4 {
  font-size: 18px;
  color: #4a5568;
  margin-bottom: 20px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7fafc;
  border-radius: 8px;
}

.detail-item label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
}

.detail-item span {
  font-size: 18px;
  color: #2d3748;
  font-weight: 600;
}

.status-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}

.status-tag.charging {
  background: #c6f6d5;
  color: #22543d;
}

.status-tag.discharging {
  background: #fed7d7;
  color: #742a2a;
}

.status-tag.idle {
  background: #e2e8f0;
  color: #4a5568;
}

.telemetry-charts {
  margin-bottom: 40px;
}

.telemetry-charts h3 {
  font-size: 20px;
  color: #2d3748;
  margin-bottom: 20px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.chart-item {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-item h4 {
  font-size: 16px;
  color: #4a5568;
  margin-bottom: 16px;
}

.chart-container {
  height: 250px;
  width: 100%;
  margin: 0 auto;
  position: relative;
}

.chart-placeholder {
  height: 250px;
  background: #f7fafc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0aec0;
  font-size: 14px;
}

.alarm-overview {
  margin-bottom: 40px;
}

.alarm-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  border-left: 4px solid #e2e8f0;
}

.stat-card.critical {
  border-left-color: #f56565;
}

.stat-card.warning {
  border-left-color: #ed8936;
}

.stat-card.info {
  border-left-color: #4299e1;
}

.stat-card label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
}

.stat-value {
  font-size: 36px;
  color: #2d3748;
  font-weight: 700;
}

.alarm-list h3 {
  font-size: 20px;
  color: #2d3748;
  margin-bottom: 20px;
}

.filter-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filter-controls select {
  padding: 10px 20px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  background: white;
}

.filter-button {
  padding: 10px 20px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.filter-button:hover {
  border-color: #4299e1;
  background: #ebf8ff;
}

.alarm-table-container {
  overflow-x: auto;
}

.alarm-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.alarm-table th {
  background: #f7fafc;
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
}

.alarm-table td {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
}

.alarm-row:hover {
  background: #f7fafc;
}

.alarm-row.critical {
  background: #fff5f5;
}

.alarm-row.warning {
  background: #fffaf0;
}

.alarm-row.info {
  background: #ebf8ff;
}

.alarm-level {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.alarm-level.critical {
  background: #fed7d7;
  color: #742a2a;
}

.alarm-level.warning {
  background: #fef5e7;
  color: #744210;
}

.alarm-level.info {
  background: #bee3f8;
  color: #2b6cb0;
}

.alarm-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.alarm-status.active {
  background: #fed7d7;
  color: #742a2a;
}

.alarm-status.resolved {
  background: #c6f6d5;
  color: #22543d;
}

.alarm-statistics {
  margin-bottom: 40px;
}

.alarm-statistics h3 {
  font-size: 20px;
  color: #2d3748;
  margin-bottom: 20px;
}

.window-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.window-button {
  padding: 8px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.window-button:hover {
  border-color: #4299e1;
  background: #ebf8ff;
}

.window-button.active {
  background: #4299e1;
  border-color: #4299e1;
  color: white;
}

.window-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.meta-text {
  font-size: 14px;
  color: #718096;
  font-weight: 600;
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.statistics-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.statistics-card h4 {
  font-size: 18px;
  color: #4a5568;
  margin-bottom: 20px;
}
</style>
