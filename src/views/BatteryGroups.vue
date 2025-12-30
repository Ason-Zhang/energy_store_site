<template>
  <div class="battery-groups">
    <div class="header">
      <div class="title">
        <h1>电池组监控</h1>
        <p class="subtitle">
          按电池组展示（每组 1 PCS + 1 BMS），数据由后端模拟并在后端维护锁存状态。
        </p>
      </div>
      <div class="meta">
        <div class="meta-item">
          <span class="meta-label">更新时间</span>
          <span class="meta-value">{{ lastUpdateTime }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">电池组数量</span>
          <span class="meta-value">{{ batteryGroups.length }}</span>
        </div>
        <div class="meta-item meta-actions">
          <button
            class="reset-all"
            :disabled="faultedGroupIds.length === 0"
            @click="resetAllFaulted"
            :title="
              faultedGroupIds.length === 0
                ? '当前无故障电池组'
                : `一键人工复位：将复位 ${faultedGroupIds.length} 个故障电池组`
            "
          >
            一键人工复位
          </button>
        </div>
      </div>
    </div>

    <div class="groups-grid">
      <div
        v-for="g in batteryGroups"
        :key="g.id"
        :ref="(el) => setGroupEl(g.id, el as HTMLElement | null)"
        class="group-card"
        :class="{ focused: focusId === g.id }"
      >
        <div class="card-top">
          <div class="card-title">
            <div class="name">{{ g.name }}</div>
            <div class="badge-wrap">
              <span class="badge" :class="g.status">
                {{ g.status === 'normal' ? '正常' : g.status === 'warning' ? '告警' : '故障' }}
              </span>
              <button
                v-if="g.status !== 'normal' && activeEventBySource(`BAT-${g.id}`)"
                class="dismiss"
                @click.stop="dismissBySource(`BAT-${g.id}`)"
                title="消除该设备对应的告警记录（不会改变设备当前状态）"
              >
                消除
              </button>
            </div>
          </div>
          <div class="actions">
            <button
              v-if="g.status === 'error' || g.pcs.status === 'error' || g.bms.status === 'error'"
              class="reset"
              @click="resetGroup(g.id)"
              title="人工复位：清除后端锁存故障并同步告警状态"
            >
              人工复位
            </button>
            <button class="toggle" @click="toggleExpand(g.id)">
              {{ expandedIds.has(g.id) ? '收起' : '详情' }}
            </button>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi">
            <label>PCS 指令/实际</label>
            <span>{{ g.pcs.dispatchMode }} · {{ g.pcs.setpointKw }} / {{ g.pcs.actualKw }} kW</span>
          </div>
          <div class="kpi">
            <label>PCS 状态</label>
            <span :class="['kpi-status', g.pcs.status]">
              {{
                g.pcs.runningState === 'running'
                  ? '运行'
                  : g.pcs.runningState === 'standby'
                    ? '待机'
                    : '故障'
              }}
            </span>
          </div>
          <div class="kpi">
            <label>BMS SOC</label>
            <span>{{ g.bms.socPct }} %</span>
          </div>
          <div class="kpi">
            <label>BMS 温度</label>
            <span>{{ g.bms.temperatureC }} °C</span>
          </div>
        </div>

        <div v-if="expandedIds.has(g.id)" class="details">
          <div v-if="g.status === 'error' && g.faultReason" class="detail-panel">
            <div class="panel-header">
              <h3>故障原因</h3>
            </div>
            <div class="detail-grid">
              <div class="item" style="grid-column: 1 / -1">
                <label>原因</label>
                <span class="fault-reason">{{ g.faultReason }}</span>
              </div>
            </div>
          </div>

          <div class="detail-panel">
            <div class="panel-header">
              <h3>PCS</h3>
              <div class="badge-wrap">
                <span class="small-badge" :class="g.pcs.status">
                  {{
                    g.pcs.status === 'normal'
                      ? '正常'
                      : g.pcs.status === 'warning'
                        ? '告警'
                        : '故障'
                  }}
                </span>
                <button
                  v-if="g.pcs.status !== 'normal' && activeEventBySource(`PCS-${g.id}`)"
                  class="dismiss small"
                  @click.stop="dismissBySource(`PCS-${g.id}`)"
                  title="消除 PCS 告警记录"
                >
                  消除
                </button>
              </div>
            </div>
            <div class="detail-grid">
              <div class="item">
                <label>调度模式</label>
                <span>{{ g.pcs.dispatchMode }}</span>
              </div>
              <div class="item">
                <label>设定功率</label>
                <span>{{ g.pcs.setpointKw }} kW</span>
              </div>
              <div class="item">
                <label>实际功率</label>
                <span>{{ g.pcs.actualKw }} kW</span>
              </div>
              <div class="item">
                <label>爬坡率</label>
                <span>{{ g.pcs.rampRateKwPerMin }} kW/min</span>
              </div>
              <div class="item">
                <label>交流电压</label>
                <span>{{ g.pcs.acVoltageV }} V</span>
              </div>
              <div class="item">
                <label>交流电流</label>
                <span>{{ g.pcs.acCurrentA }} A</span>
              </div>
              <div class="item">
                <label>频率</label>
                <span>{{ g.pcs.frequencyHz }} Hz</span>
              </div>
              <div class="item">
                <label>功率因数</label>
                <span>{{ g.pcs.powerFactor }}</span>
              </div>
              <div class="item">
                <label>无功功率</label>
                <span>{{ g.pcs.reactivePowerKvar }} kvar</span>
              </div>
              <div class="item">
                <label>直流电压</label>
                <span>{{ g.pcs.dcVoltageV }} V</span>
              </div>
              <div class="item">
                <label>直流电流</label>
                <span>{{ g.pcs.dcCurrentA }} A</span>
              </div>
              <div class="item">
                <label>效率</label>
                <span>{{ g.pcs.efficiencyPct }} %</span>
              </div>
              <div class="item">
                <label>温度</label>
                <span>{{ g.pcs.temperature }} °C</span>
              </div>
            </div>
          </div>

          <div class="detail-panel">
            <div class="panel-header">
              <h3>BMS</h3>
              <div class="badge-wrap">
                <span class="small-badge" :class="g.bms.status">
                  {{
                    g.bms.status === 'normal'
                      ? '正常'
                      : g.bms.status === 'warning'
                        ? '告警'
                        : '故障'
                  }}
                </span>
                <button
                  v-if="g.bms.status !== 'normal' && activeEventBySource(`BMS-${g.id}`)"
                  class="dismiss small"
                  @click.stop="dismissBySource(`BMS-${g.id}`)"
                  title="消除 BMS 告警记录"
                >
                  消除
                </button>
              </div>
            </div>
            <div class="detail-grid">
              <div class="item">
                <label>总电压</label>
                <span>{{ g.bms.voltageV }} V</span>
              </div>
              <div class="item">
                <label>总电流</label>
                <span>{{ g.bms.currentA }} A</span>
              </div>
              <div class="item">
                <label>平均温度</label>
                <span>{{ g.bms.temperatureC }} °C</span>
              </div>
              <div class="item">
                <label>SOC</label>
                <span>{{ g.bms.socPct }} %</span>
              </div>
              <div class="item">
                <label>SOH</label>
                <span>{{ g.bms.sohPct }} %</span>
              </div>
              <div class="item">
                <label>单体电压(最大/最小)</label>
                <span>{{ g.bms.maxCellVoltageV }} / {{ g.bms.minCellVoltageV }} V</span>
              </div>
              <div class="item">
                <label>电压一致性</label>
                <span>{{ g.bms.deltaCellVoltageMv }} mV</span>
              </div>
              <div class="item">
                <label>单体温度(最大/最小)</label>
                <span>{{ g.bms.maxCellTempC }} / {{ g.bms.minCellTempC }} °C</span>
              </div>
              <div class="item">
                <label>绝缘电阻</label>
                <span>{{ g.bms.insulationResistanceKohm }} kΩ</span>
              </div>
              <div class="item">
                <label>接触器</label>
                <span>{{ g.bms.contactorClosed ? '闭合' : '断开' }}</span>
              </div>
              <div class="item">
                <label>均衡</label>
                <span>{{ g.bms.balancingActive ? '进行中' : '停止' }}</span>
              </div>
              <div class="item">
                <label>告警/故障</label>
                <span>{{ g.bms.warningCount }} / {{ g.bms.faultCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useEnergyStore } from '../stores/energyStore'

const energyStore = useEnergyStore()
const route = useRoute()

// 支持多个面板同时展开；默认全部关闭
const expandedIds = ref<Set<number>>(new Set())
const focusId = ref<number | null>(null)
const groupEls = new Map<number, HTMLElement>()

const batteryGroups = computed(() => energyStore.batteryGroups)

const faultedGroupIds = computed(() => {
  return batteryGroups.value
    .filter((g) => g.status === 'error' || g.pcs.status === 'error' || g.bms.status === 'error')
    .map((g) => g.id)
})

const lastUpdateTime = computed(() => {
  return batteryGroups.value[0]?.lastUpdateTime ?? energyStore.telemetryData?.currentTime ?? ''
})

const toggleExpand = (id: number) => {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

const resetGroup = (id: number) => {
  energyStore.resetBatteryGroup(id)
}

const resetAllFaulted = async () => {
  const ids = faultedGroupIds.value
  if (ids.length === 0) return
  const ok = window.confirm(`确认一键人工复位？将复位 ${ids.length} 个故障电池组。`)
  if (!ok) return
  await energyStore.resetBatteryGroupsBulk(ids)
}

const dismissBySource = (source: string) => {
  energyStore.dismissLatestBySource(source)
}

// 兼容：在 dev/HMR 或缓存情况下，store 里可能暂时没有该 getter，避免模板直接报错
const activeEventBySource = (source: string) => {
  const fn = (energyStore as unknown as { getActiveEventBySource?: unknown }).getActiveEventBySource
  return typeof fn === 'function' ? fn(source) : null
}

const setGroupEl = (id: number, el: HTMLElement | null) => {
  if (!el) return
  groupEls.set(id, el)
}

const applyFocus = async () => {
  const raw = route.query.focus
  const id = typeof raw === 'string' ? Number(raw) : Array.isArray(raw) ? Number(raw[0]) : NaN
  if (!Number.isFinite(id)) return
  focusId.value = id

  const next = new Set(expandedIds.value)
  next.add(id)
  expandedIds.value = next

  await nextTick()
  const el = groupEls.get(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  // 2秒高亮
  setTimeout(() => {
    if (focusId.value === id) focusId.value = null
  }, 2000)
}

onMounted(() => {
  void applyFocus()
})

watch(
  () => route.query.focus,
  () => void applyFocus(),
)
</script>

<style scoped>
.battery-groups {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
}

.title h1 {
  font-size: 28px;
  color: #1a202c;
  margin-bottom: 6px;
}

.subtitle {
  color: #718096;
  font-size: 14px;
}

.meta {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 12px;
  color: #718096;
}

.meta-value {
  font-size: 14px;
  font-weight: 700;
  color: #2d3748;
}

.meta-actions {
  justify-content: flex-end;
}

.reset-all {
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  transition: all 0.15s ease;
}

.reset-all:hover {
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.16);
}

.reset-all:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.fault-reason {
  white-space: pre-line;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.group-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 16px;
}

.group-card.focused {
  outline: 3px solid rgba(66, 153, 225, 0.55);
  box-shadow: 0 0 0 6px rgba(66, 153, 225, 0.12);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reset {
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  transition: all 0.15s ease;
}

.reset:hover {
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.16);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.badge-wrap {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.dismiss {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px dashed rgba(66, 153, 225, 0.55);
  background: rgba(66, 153, 225, 0.08);
  color: #2b6cb0;
  cursor: pointer;
  font-weight: 900;
}

.dismiss.small {
  padding: 4px 8px;
  font-size: 12px;
}

.dismiss:hover {
  background: rgba(66, 153, 225, 0.14);
}

.name {
  font-weight: 800;
  color: #1a202c;
  font-size: 16px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.normal {
  background: #c6f6d5;
  color: #22543d;
}
.badge.warning {
  background: #fef5e7;
  color: #744210;
}
.badge.error {
  background: #fed7d7;
  color: #742a2a;
}

.toggle {
  border: 1px solid #e2e8f0;
  background: #f7fafc;
  color: #2d3748;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.15s ease;
}
.toggle:hover {
  background: #ebf8ff;
  border-color: #4299e1;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 10px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kpi label {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
}

.kpi span {
  font-size: 14px;
  color: #2d3748;
  font-weight: 700;
}

.kpi-status.normal {
  color: #22543d;
}
.kpi-status.warning {
  color: #744210;
}
.kpi-status.error {
  color: #742a2a;
}

.details {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 12px;
}

.detail-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  font-size: 16px;
  margin: 0;
  color: #1a202c;
}

.small-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.small-badge.normal {
  background: #c6f6d5;
  color: #22543d;
}
.small-badge.warning {
  background: #fef5e7;
  color: #744210;
}
.small-badge.error {
  background: #fed7d7;
  color: #742a2a;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item label {
  font-size: 12px;
  color: #718096;
  font-weight: 600;
}

.item span {
  font-size: 14px;
  color: #2d3748;
  font-weight: 700;
}
</style>
