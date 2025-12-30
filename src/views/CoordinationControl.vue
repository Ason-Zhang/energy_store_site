<template>
  <div class="coord">
    <div class="header">
      <div>
        <h1>协控监控</h1>
        <p class="sub">
          协控单元（3个）输入/输出总览：上层计划与指令、安全与闭锁、下层设备信息；以及下发命令、上报信息、同层联锁/协调信号。
        </p>
      </div>
      <div class="meta">
        <div class="meta-item">
          <span class="k">单元数</span>
          <span class="v">{{ units.length }}</span>
        </div>
        <div class="meta-item">
          <span class="k">更新时间</span>
          <span class="v">{{ lastUpdate }}</span>
        </div>
      </div>
    </div>

    <div class="unit-tabs">
      <button
        v-for="u in units"
        :key="u.unitId"
        class="tab"
        :class="{ active: selectedUnitId === u.unitId }"
        @click="selectedUnitId = u.unitId"
      >
        {{ u.name }}
        <span class="badge" :class="u.status">{{ statusText(u.status) }}</span>
        <button
          v-if="u.status !== 'normal' && activeEventBySource(`CCU-${u.unitId}`)"
          class="dismiss"
          @click.stop="dismissBySource(`CCU-${u.unitId}`)"
          title="消除该协控单元对应的告警记录（不会改变当前状态）"
        >
          消除
        </button>
      </button>
    </div>

    <div v-if="selectedUnit" class="content">
      <div class="grid">
        <section class="panel">
          <div class="panel-h">
            <h2>输入</h2>
            <span class="stamp">{{ selectedUnit.lastUpdateTime }}</span>
          </div>

          <div class="block">
            <h3>上层系统（EMS/调度中心）计划与指令</h3>
            <div class="kv">
              <div class="kv-item">
                <label>来源</label>
                <span>{{ selectedUnit.inputs.upper.source }}</span>
              </div>
              <div class="kv-item">
                <label>模式</label>
                <span>{{ selectedUnit.inputs.upper.mode }}</span>
              </div>
              <div class="kv-item">
                <label>计划号</label>
                <span>{{ selectedUnit.inputs.upper.planId }}</span>
              </div>
              <div class="kv-item">
                <label>时段</label>
                <span>{{ selectedUnit.inputs.upper.planWindow }}</span>
              </div>
              <div class="kv-item">
                <label>目标功率</label>
                <span>{{ selectedUnit.inputs.upper.targetPowerKw }} kW</span>
              </div>
              <div class="kv-item">
                <label>使能</label>
                <span :class="['pill', selectedUnit.inputs.upper.enable ? 'ok' : 'off']">
                  {{ selectedUnit.inputs.upper.enable ? '启用' : '禁用' }}
                </span>
              </div>
              <div class="kv-item">
                <label>下发时间</label>
                <span>{{ selectedUnit.inputs.upper.issuedAt }}</span>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>同层/安全系统安全与闭锁信号</h3>
            <div class="signals">
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.batteryPreWarning)">
                电池预警
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.batteryWarning)">
                电池告警
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.batteryTrip)">
                电池跳闸
              </div>
              <div
                class="signal"
                :class="flagClass(selectedUnit.inputs.safety.electricalProtectionTrip)"
              >
                保护动作
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.fireConfirmed)">
                火灾确认
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.emergencyStop)">
                急停
              </div>
              <div class="signal" :class="flagClass(!selectedUnit.inputs.safety.acBreakerClosed)">
                交流断路器断开
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.dcBusOverVoltage)">
                直流母线过压
              </div>
              <div class="signal" :class="flagClass(selectedUnit.inputs.safety.dcBusUnderVoltage)">
                直流母线欠压
              </div>
              <div
                class="signal wide"
                :class="flagClass(selectedUnit.inputs.safety.interlockActive)"
              >
                联锁状态：{{ selectedUnit.inputs.safety.interlockActive ? '生效' : '未生效' }}
                <span v-if="selectedUnit.inputs.safety.lockReason" class="reason">
                  （{{ selectedUnit.inputs.safety.lockReason }}）
                </span>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>下层执行设备输入（PCS）</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>PCS</th>
                    <th>状态</th>
                    <th>运行</th>
                    <th>实时功率(kW)</th>
                    <th>可调范围(kW)</th>
                    <th>故障码</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in selectedUnit.inputs.devices.pcs" :key="p.pcsId">
                    <td>{{ p.pcsId }}</td>
                    <td>
                      <span class="badge" :class="p.status">{{ statusText(p.status) }}</span>
                    </td>
                    <td>{{ p.runningState }}</td>
                    <td>{{ p.actualKw }}</td>
                    <td>{{ p.adjustableMinKw }} ~ {{ p.adjustableMaxKw }}</td>
                    <td class="mono">{{ p.faultCode || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="block">
            <h3>下层执行设备输入（BMS）</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>BMS</th>
                    <th>状态</th>
                    <th>SOC(%)</th>
                    <th>温度(°C)</th>
                    <th>绝缘(kΩ)</th>
                    <th>一致性(mV)</th>
                    <th>告警/故障</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in selectedUnit.inputs.devices.bms" :key="b.bmsId">
                    <td>{{ b.bmsId }}</td>
                    <td>
                      <span class="badge" :class="b.status">{{ statusText(b.status) }}</span>
                    </td>
                    <td>{{ b.socPct }}</td>
                    <td>{{ b.temperatureC }}</td>
                    <td>{{ b.insulationResistanceKohm }}</td>
                    <td>{{ b.deltaCellVoltageMv }}</td>
                    <td>{{ b.warningCount }} / {{ b.faultCount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-h">
            <h2>输出</h2>
            <span class="stamp">{{ selectedUnit.outputs.upperReport.reportedAt }}</span>
          </div>

          <div class="block">
            <h3>下发至执行设备（PCS控制指令）</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>PCS</th>
                    <th>使能</th>
                    <th>启停</th>
                    <th>模式</th>
                    <th>设定功率(kW)</th>
                    <th>爬坡(kW/min)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in selectedUnit.outputs.pcsCommands" :key="c.pcsId">
                    <td>{{ c.pcsId }}</td>
                    <td>
                      <span :class="['pill', c.enable ? 'ok' : 'off']">{{
                        c.enable ? 'ON' : 'OFF'
                      }}</span>
                    </td>
                    <td>{{ c.startStop }}</td>
                    <td>{{ c.modeCmd }}</td>
                    <td>{{ c.setpointKw }}</td>
                    <td>{{ c.rampRateKwPerMin }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="block">
            <h3>上报至上层系统（汇总信息）</h3>
            <div class="kv">
              <div class="kv-item">
                <label>全站实际总功率</label>
                <span>{{ selectedUnit.outputs.upperReport.stationActualTotalKw }} kW</span>
              </div>
              <div class="kv-item">
                <label>可用容量</label>
                <span>{{ selectedUnit.outputs.upperReport.availableCapacityKwh }} kWh</span>
              </div>
              <div class="kv-item">
                <label>就绪状态</label>
                <span :class="['pill', selectedUnit.outputs.upperReport.ready ? 'ok' : 'off']">
                  {{ selectedUnit.outputs.upperReport.ready ? '就绪' : '未就绪' }}
                </span>
              </div>
              <div class="kv-item">
                <label>执行情况</label>
                <span>{{ selectedUnit.outputs.upperReport.executionStatus }}</span>
              </div>
              <div class="kv-item">
                <label>跟踪误差</label>
                <span>{{ selectedUnit.outputs.upperReport.commandTrackingErrorKw }} kW</span>
              </div>
              <div class="kv-item">
                <label>报警汇总</label>
                <span>
                  C{{ selectedUnit.outputs.upperReport.alarmSummary.critical }} / W{{
                    selectedUnit.outputs.upperReport.alarmSummary.warning
                  }}
                  / I{{ selectedUnit.outputs.upperReport.alarmSummary.info }}
                </span>
              </div>
              <div class="kv-item">
                <label>事件汇总</label>
                <span>
                  启停{{ selectedUnit.outputs.upperReport.eventSummary.startStop }}， 模式{{
                    selectedUnit.outputs.upperReport.eventSummary.modeSwitch
                  }}， 联锁{{ selectedUnit.outputs.upperReport.eventSummary.interlock }}
                </span>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>同层联锁与协调信号（对外发布）</h3>
            <div class="signals">
              <div
                class="signal"
                :class="flagClass(selectedUnit.outputs.peerOutputs.fireConfirmed)"
              >
                火灾确认
              </div>
              <div class="signal" :class="flagClass(selectedUnit.outputs.peerOutputs.limitPower)">
                限制功率
              </div>
              <div class="signal" :class="flagClass(selectedUnit.outputs.peerOutputs.exitRun)">
                退出运行
              </div>
              <div v-if="selectedUnit.outputs.peerOutputs.limitReason" class="signal wide hot">
                原因：{{ selectedUnit.outputs.peerOutputs.limitReason }}
              </div>
            </div>
          </div>

          <div class="block">
            <h3>协控单元间通信</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>对端单元</th>
                    <th>链路状态</th>
                    <th>延迟(ms)</th>
                    <th>最后接收</th>
                    <th>对端就绪</th>
                    <th>对端限功率</th>
                    <th>对端退出运行</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in selectedUnit.inputs.peerSignals" :key="p.peerUnitId">
                    <td>{{ p.peerUnitId }}</td>
                    <td>
                      <span class="badge" :class="p.commStatus">{{
                        statusText(p.commStatus)
                      }}</span>
                    </td>
                    <td>{{ p.latencyMs }}</td>
                    <td>{{ p.lastRxTime }}</td>
                    <td>{{ p.peerReady ? '是' : '否' }}</td>
                    <td>{{ p.peerLimitPower ? '是' : '否' }}</td>
                    <td>{{ p.peerExitRun ? '是' : '否' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="empty">暂无协控数据（请等待刷新或检查数据源）。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useEnergyStore } from '../stores/energyStore'

const energyStore = useEnergyStore()
const route = useRoute()

const units = computed(() => energyStore.coordinationUnits)
const selectedUnitId = ref<number>(1)

watchEffect(() => {
  // 如果数据尚未就绪，或单元数变更，确保选中有效
  if (units.value.length === 0) return
  const exists = units.value.some((u) => u.unitId === selectedUnitId.value)
  if (!exists) selectedUnitId.value = units.value[0]?.unitId ?? 1
})

const selectedUnit = computed(() => units.value.find((u) => u.unitId === selectedUnitId.value))

const lastUpdate = computed(
  () => units.value[0]?.lastUpdateTime ?? energyStore.telemetryData?.currentTime ?? '',
)

const statusText = (s: 'normal' | 'warning' | 'error') =>
  s === 'normal' ? '正常' : s === 'warning' ? '告警' : '故障'

const flagClass = (flag: boolean) => (flag ? 'hot' : 'cold')

const applyFocusUnit = () => {
  const raw = route.query.unit
  const id = typeof raw === 'string' ? Number(raw) : Array.isArray(raw) ? Number(raw[0]) : NaN
  if (!Number.isFinite(id)) return
  selectedUnitId.value = id
}

onMounted(() => applyFocusUnit())
watch(
  () => route.query.unit,
  () => applyFocusUnit(),
)

const dismissBySource = (source: string) => {
  energyStore.dismissLatestBySource(source)
}

// 兼容：在 dev/HMR 或缓存情况下，store 里可能暂时没有该 getter，避免模板直接报错
const activeEventBySource = (source: string) => {
  const fn = (energyStore as unknown as { getActiveEventBySource?: unknown }).getActiveEventBySource
  return typeof fn === 'function' ? fn(source) : null
}
</script>

<style scoped>
.coord {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 28px;
  color: #1a202c;
  margin: 0 0 6px 0;
}

.sub {
  color: #718096;
  font-size: 14px;
  margin: 0;
  max-width: 900px;
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

.meta-item .k {
  font-size: 12px;
  color: #718096;
}

.meta-item .v {
  font-size: 14px;
  font-weight: 800;
  color: #2d3748;
}

.unit-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  cursor: pointer;
  font-weight: 800;
  color: #2d3748;
  transition: all 0.15s ease;
}

.tab:hover {
  background: #f7fafc;
  border-color: #4299e1;
}

.tab.active {
  background: #ebf8ff;
  border-color: #4299e1;
}

.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
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

.dismiss {
  margin-left: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px dashed rgba(66, 153, 225, 0.55);
  background: rgba(66, 153, 225, 0.08);
  color: #2b6cb0;
  font-weight: 900;
  cursor: pointer;
}

.dismiss:hover {
  background: rgba(66, 153, 225, 0.14);
}

.content {
  background: transparent;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 16px;
}

.panel-h {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.panel h2 {
  margin: 0;
  font-size: 18px;
  color: #1a202c;
}

.stamp {
  font-size: 12px;
  color: #718096;
}

.block {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 12px;
  background: #ffffff;
}

.block h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #2d3748;
}

.kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kv-item label {
  font-size: 12px;
  color: #718096;
  font-weight: 700;
}

.kv-item span {
  font-size: 14px;
  color: #2d3748;
  font-weight: 800;
}

.pill {
  display: inline-flex;
  width: fit-content;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
}

.pill.ok {
  background: #c6f6d5;
  color: #22543d;
}

.pill.off {
  background: #e2e8f0;
  color: #4a5568;
}

.signals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.signal {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  font-weight: 900;
  font-size: 12px;
  color: #2d3748;
  background: #f7fafc;
}

.signal.wide {
  grid-column: 1 / -1;
}

.signal.hot {
  background: #fff5f5;
  border-color: #fed7d7;
  color: #742a2a;
}

.signal.cold {
  background: #f7fafc;
  border-color: #e2e8f0;
  color: #2d3748;
}

.reason {
  font-weight: 800;
  opacity: 0.9;
}

.table-wrap {
  overflow-x: auto;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.tbl th {
  text-align: left;
  background: #f7fafc;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
  padding: 10px;
  white-space: nowrap;
}

.tbl td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
  white-space: nowrap;
}

.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.empty {
  padding: 18px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  color: #718096;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
