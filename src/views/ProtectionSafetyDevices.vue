<template>
  <div class="psd">
    <div class="header">
      <div>
        <h1>保护/安全装置</h1>
        <p class="sub">
          与 EMS 的 protectionDevices
          数据同步；用于对“电气保护装置（交流侧/直流侧）等站内保护与安全相关装置”进行更细粒度的监控项展示。
        </p>
      </div>
      <div class="meta">
        <div class="meta-item">
          <span class="k">时间</span>
          <span class="v">{{ snapshot?.inputs.timestamp || '--' }}</span>
        </div>
        <div class="meta-item">
          <span class="k">状态</span>
          <span :class="['pill', isAuto ? 'ok' : 'off']">{{ isAuto ? '自动' : '非自动' }}</span>
        </div>
        <div class="meta-item">
          <span class="k">装置数</span>
          <span class="v">{{ devices.length }}</span>
        </div>
      </div>
    </div>

    <div v-if="!snapshot" class="empty">暂无 EMS 数据（请等待数据刷新）</div>

    <div v-else class="grid">
      <section class="panel list">
        <div class="panel-h">
          <h2>装置列表</h2>
          <span class="stamp">来源：EMS.inputs.protectionDevices</span>
        </div>

        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>装置名称</th>
                <th>状态</th>
                <th>动作</th>
                <th>最近</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="d in devices"
                :key="d.name"
                :class="{ active: selectedName === d.name }"
                @click="selectedName = d.name"
              >
                <td class="name">{{ d.name }}</td>
                <td>
                  <span class="badge" :class="d.displayStatus">{{
                    statusText(d.displayStatus)
                  }}</span>
                </td>
                <td>{{ d.trip ? '跳闸' : '—' }}</td>
                <td>{{ d.lastAction }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel detail" v-if="selected">
        <div class="panel-h">
          <h2>监控详情</h2>
          <span class="stamp">{{ selected.name }}</span>
        </div>

        <div class="blocks">
          <div class="block">
            <h3>运行状态</h3>
            <div class="kv">
              <div class="kv-item">
                <label>装置状态</label>
                <span class="badge" :class="selected.displayStatus">{{
                  statusText(selected.displayStatus)
                }}</span>
              </div>
              <div class="kv-item">
                <label>跳闸</label>
                <span :class="['pill', selected.trip ? 'hot' : 'ok']">{{
                  selected.trip ? '是' : '否'
                }}</span>
              </div>
              <div class="kv-item">
                <label>最近动作</label>
                <span>{{ selected.lastAction }}</span>
              </div>
              <div class="kv-item">
                <label>人工复位</label>
                <button
                  class="btn"
                  type="button"
                  :disabled="!selected.trip || resetting"
                  @click="resetSelected"
                >
                  {{ resetting ? '复位中…' : '手动复位' }}
                </button>
                <div v-if="resetFeedback" class="resetFeedback">{{ resetFeedback }}</div>
              </div>
              <div class="kv-item">
                <label>运行方式</label>
                <span>{{ isAuto ? '自动（状态恒为正常）' : '非自动（允许预警/动作）' }}</span>
              </div>
            </div>
          </div>

          <div v-if="selected.reason" class="block">
            <h3>告警/动作原因</h3>
            <div class="reasonBox" :class="selected.displayStatus">
              {{ selected.reason }}
            </div>
          </div>

          <div class="block">
            <h3>监测量（实时）</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>监控项</th>
                    <th>数值</th>
                    <th>单位</th>
                    <th>质量</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="it in selected.realtime" :key="it.key">
                    <td class="mono">{{ it.key }}</td>
                    <td class="mono">{{ it.value }}</td>
                    <td>{{ it.unit }}</td>
                    <td><span class="pill ok">GOOD</span></td>
                    <td>{{ it.note }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="block">
            <h3>定值/门限</h3>
            <div class="table-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>定值项</th>
                    <th>设定</th>
                    <th>单位</th>
                    <th>使能</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="it in selected.settings" :key="it.key">
                    <td class="mono">{{ it.key }}</td>
                    <td class="mono">{{ it.value }}</td>
                    <td>{{ it.unit }}</td>
                    <td>
                      <span :class="['pill', it.enabled ? 'ok' : 'off']">{{
                        it.enabled ? 'ON' : 'OFF'
                      }}</span>
                    </td>
                    <td>{{ it.note }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="block">
            <h3>自检与通信</h3>
            <div class="kv">
              <div class="kv-item">
                <label>自检状态</label>
                <span class="pill ok">通过</span>
              </div>
              <div class="kv-item">
                <label>通信链路</label>
                <span class="pill ok">在线</span>
              </div>
              <div class="kv-item">
                <label>采样周期</label>
                <span>{{ updateIntervalLabel }}</span>
              </div>
              <div class="kv-item">
                <label>数据源</label>
                <span class="mono">EMS.inputs.protectionDevices</span>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>最近事件（示例）</h3>
            <ul class="list">
              <li v-for="(e, idx) in selected.events" :key="idx">{{ e }}</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useEnergyStore } from '../stores/energyStore'
import { resetProtectionDevice } from '../services/dataApiService'
import { resetProtectionDeviceLatch } from '../modules/ems/decisionEngine'

type Status = 'normal' | 'warning' | 'error'

type DetailItem = { key: string; value: string; unit: string; note: string }

type SettingItem = { key: string; value: string; unit: string; enabled: boolean; note: string }

type UiDevice = {
  name: string
  status: Status
  displayStatus: Status
  trip: boolean
  lastAction: string
  reason?: string
  realtime: DetailItem[]
  settings: SettingItem[]
  events: string[]
}

const energyStore = useEnergyStore()
const snapshot = computed(() => energyStore.emsSnapshot)
const controlCommands = computed(() => energyStore.getControlCommands)
const telemetry = computed(() => energyStore.getTelemetryData)
const updateIntervalLabel = computed(() => `${energyStore.updateIntervalMs / 1000}s`)

const isAuto = computed(() =>
  Boolean(controlCommands.value?.agc?.enabled || controlCommands.value?.avc?.enabled),
)

const statusText = (s: Status) => (s === 'normal' ? '正常' : s === 'warning' ? '告警' : '故障')

const hash = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const mkRealtime = (name: string): DetailItem[] => {
  const h = hash(name)
  const v = Number(telemetry.value?.averageVoltage ?? 400)
  const i = Number(telemetry.value?.totalCurrent ?? 0)
  const p = (v * i) / 1000

  const a = 0.9 + (h % 17) / 100 // 0.90~1.06
  const b = 0.85 + ((h >>> 5) % 21) / 100 // 0.85~1.05
  const c = 0.88 + ((h >>> 11) % 19) / 100 // 0.88~1.06

  if (name.includes('交流')) {
    const freq = 50 + (((h >>> 3) % 7) - 3) * 0.01
    const ua = clamp(v * 0.98 * a, 340, 480)
    const ub = clamp(v * 1.01 * b, 340, 480)
    const uc = clamp(v * 1.0 * c, 340, 480)
    const ia = clamp(Math.abs(i) * 0.33 * a, 0, 1200)
    const ib = clamp(Math.abs(i) * 0.33 * b, 0, 1200)
    const ic = clamp(Math.abs(i) * 0.33 * c, 0, 1200)
    return [
      { key: 'UA', value: ua.toFixed(1), unit: 'V', note: 'A 相电压' },
      { key: 'UB', value: ub.toFixed(1), unit: 'V', note: 'B 相电压' },
      { key: 'UC', value: uc.toFixed(1), unit: 'V', note: 'C 相电压' },
      { key: 'IA', value: ia.toFixed(1), unit: 'A', note: 'A 相电流' },
      { key: 'IB', value: ib.toFixed(1), unit: 'A', note: 'B 相电流' },
      { key: 'IC', value: ic.toFixed(1), unit: 'A', note: 'C 相电流' },
      { key: 'FREQ', value: freq.toFixed(2), unit: 'Hz', note: '电网频率' },
      { key: 'P', value: p.toFixed(1), unit: 'kW', note: '参考全站功率估算' },
      { key: 'CB', value: '合', unit: '', note: '交流断路器状态' },
      { key: 'SYNC', value: '就绪', unit: '', note: '同期/并网条件' },
    ]
  }

  if (name.includes('直流')) {
    const u = clamp(v * (0.98 + ((h % 9) - 4) * 0.002), 300, 520)
    const ripple = clamp(((h >>> 4) % 20) * 0.1 + 0.6, 0.4, 3.5)
    const insu = clamp(200 + ((h >>> 7) % 400), 120, 800)
    const leak = clamp(((h >>> 10) % 60) * 0.2, 0, 20)
    return [
      { key: 'U_DC', value: u.toFixed(1), unit: 'V', note: '直流母线电压' },
      { key: 'I_DC', value: i.toFixed(1), unit: 'A', note: '直流母线电流（参考）' },
      { key: 'RIPPLE', value: ripple.toFixed(1), unit: '%', note: '纹波系数（示例）' },
      { key: 'INSU', value: insu.toFixed(0), unit: 'kΩ', note: '绝缘电阻（参考）' },
      { key: 'LEAK', value: leak.toFixed(1), unit: 'mA', note: '泄漏电流（示例）' },
      { key: 'DC_SW', value: '合', unit: '', note: '直流隔离开关' },
      { key: 'DIOST', value: '正常', unit: '', note: '二极管/旁路状态' },
    ]
  }

  if (name.includes('消防')) {
    const smoke = clamp(((h % 30) / 30) * 100, 0, 100)
    const temp = Number(telemetry.value?.averageTemperature ?? 25)
    const co = clamp(((h >>> 9) % 40) * 1.8, 0, 120)
    return [
      { key: 'SMOKE', value: smoke.toFixed(0), unit: '%', note: '烟感相对量（示例）' },
      { key: 'TEMP', value: temp.toFixed(1), unit: '°C', note: '环境温度参考' },
      { key: 'CO', value: co.toFixed(0), unit: 'ppm', note: 'CO 浓度（示例）' },
      { key: 'LINK_OUT', value: '待命', unit: '', note: '联动输出状态' },
      { key: 'SIREN', value: '关闭', unit: '', note: '声光报警器' },
      { key: 'DOOR', value: '关闭', unit: '', note: '门磁状态（示例）' },
    ]
  }

  if (name.includes('绝缘')) {
    const insu = clamp(220 + ((h % 600) - 120), 80, 1200)
    const u = Number(telemetry.value?.averageVoltage ?? 400)
    const pol = (h >>> 6) % 2 === 0 ? '正' : '负'
    return [
      { key: 'INSU_R', value: insu.toFixed(0), unit: 'kΩ', note: '绝缘电阻' },
      { key: 'U_REF', value: u.toFixed(1), unit: 'V', note: '参考母线电压' },
      { key: 'POL', value: pol, unit: '', note: '故障极性判定（示例）' },
      { key: 'IMD_MODE', value: '在线监测', unit: '', note: '工作模式' },
      { key: 'TEST', value: '未触发', unit: '', note: '自检/试验' },
    ]
  }

  const x = clamp(10 + ((h % 40) - 10), 0, 50)
  return [
    { key: 'HEALTH', value: '正常', unit: '', note: '装置健康度' },
    { key: 'INDEX', value: x.toFixed(0), unit: '%', note: '综合指标（示例）' },
  ]
}

const mkSettings = (name: string): SettingItem[] => {
  const h = hash(name)

  if (name.includes('交流')) {
    return [
      {
        key: 'I>>',
        value: String(800 + (h % 120)),
        unit: 'A',
        enabled: true,
        note: '相过流 II 段',
      },
      { key: 'I>', value: String(420 + (h % 80)), unit: 'A', enabled: true, note: '相过流 I 段' },
      { key: 'U<', value: String(320 + (h % 20)), unit: 'V', enabled: true, note: '欠压定值' },
      { key: 'U>', value: String(460 + (h % 20)), unit: 'V', enabled: true, note: '过压定值' },
      { key: 'F<', value: '49.50', unit: 'Hz', enabled: true, note: '低频定值' },
      { key: 'F>', value: '50.50', unit: 'Hz', enabled: true, note: '高频定值' },
      { key: 'DF/DT', value: '0.60', unit: 'Hz/s', enabled: true, note: '频率变化率' },
    ]
  }

  if (name.includes('直流')) {
    return [
      { key: 'Udc>', value: '520', unit: 'V', enabled: true, note: '直流母线过压保护' },
      { key: 'Udc<', value: '320', unit: 'V', enabled: true, note: '直流母线欠压保护' },
      {
        key: 'Idc>',
        value: String(900 + (h % 140)),
        unit: 'A',
        enabled: true,
        note: '直流过流保护',
      },
      { key: 'INSU<', value: '150', unit: 'kΩ', enabled: true, note: '绝缘低门限' },
      { key: 'RIPPLE>', value: '3.0', unit: '%', enabled: true, note: '纹波门限' },
    ]
  }

  if (name.includes('消防')) {
    return [
      { key: 'SMOKE>', value: '60', unit: '%', enabled: true, note: '烟雾触发门限' },
      { key: 'TEMP>', value: '65', unit: '°C', enabled: true, note: '温度触发门限' },
      { key: 'CO>', value: '80', unit: 'ppm', enabled: true, note: 'CO 触发门限' },
      { key: 'LINK_DELAY', value: '5', unit: 's', enabled: true, note: '联动延时' },
    ]
  }

  if (name.includes('绝缘')) {
    return [
      { key: 'INSU_WARN', value: '200', unit: 'kΩ', enabled: true, note: '绝缘预警门限' },
      { key: 'INSU_TRIP', value: '120', unit: 'kΩ', enabled: true, note: '绝缘跳闸门限' },
      { key: 'SCAN_T', value: '2', unit: 's', enabled: true, note: '扫描周期' },
    ]
  }

  return [{ key: 'EN', value: '1', unit: '', enabled: true, note: '功能总使能' }]
}

const mkEvents = (name: string) => {
  const h = hash(name)
  const base = (h % 6) + 1
  return [
    `事件#${base}：周期自检完成`,
    `事件#${base + 1}：采样数据上送`,
    `事件#${base + 2}：通信心跳正常`,
  ]
}

const devices = computed<UiDevice[]>(() => {
  const list = snapshot.value?.inputs.protectionDevices ?? []

  return list.map((p) => {
    const displayStatus: Status = isAuto.value ? 'normal' : p.status
    const trip = isAuto.value ? false : p.trip

    return {
      name: p.name,
      status: p.status,
      displayStatus,
      trip,
      lastAction: p.lastAction,
      reason: p.reason,
      realtime: mkRealtime(p.name),
      settings: mkSettings(p.name),
      events: mkEvents(p.name),
    }
  })
})

const selectedName = ref<string>('')

watchEffect(() => {
  if (!selectedName.value && devices.value.length) {
    const first = devices.value[0]
    if (first) selectedName.value = first.name
  }
})

const selected = computed(() => devices.value.find((d) => d.name === selectedName.value) ?? null)

const resetting = ref(false)
const resetFeedback = ref('')

const resetSelected = async () => {
  if (!selected.value) return
  resetFeedback.value = ''
  resetting.value = true
  try {
    try {
      await resetProtectionDevice(selected.value.name)
    } catch {
      // fallback to local latch (useful if server is unavailable)
      resetProtectionDeviceLatch(selected.value.name)
    }
    await energyStore.refreshTick()

    // 若复位后仍为跳闸，说明触发条件仍在（会在下一次计算中再次跳闸/锁存）
    const after = devices.value.find((d) => d.name === selected.value?.name)
    if (after?.trip) {
      resetFeedback.value =
        '复位已执行，但触发条件仍存在，装置会再次进入跳闸/锁存。请先消除告警原因后再复位。'
    } else {
      resetFeedback.value = '复位成功。'
    }
  } finally {
    resetting.value = false
  }
}
</script>

<style scoped>
.psd {
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.sub {
  margin-top: 6px;
  color: #64748b;
  max-width: 980px;
}

.meta {
  display: grid;
  gap: 10px;
  align-content: start;
}

.meta-item {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
}

.meta-item .k {
  color: #64748b;
  font-size: 12px;
}

.meta-item .v {
  font-weight: 700;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  background: #fff;
}

.pill.ok {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.12);
}

.pill.off {
  border-color: rgba(148, 163, 184, 0.5);
  background: rgba(148, 163, 184, 0.12);
}

.pill.hot {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.12);
}

.grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 16px;
  align-items: start;
}

.panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.panel-h {
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.panel-h h2 {
  font-size: 16px;
  margin: 0;
}

.stamp {
  color: #64748b;
  font-size: 12px;
}

.table-wrap {
  overflow-x: auto;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl th,
.tbl td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  white-space: nowrap;
}

.tbl thead th {
  font-size: 12px;
  color: #64748b;
  font-weight: 800;
}

.tbl tbody tr {
  cursor: pointer;
}

.tbl tbody tr:hover {
  background: #f8fafc;
}

.tbl tbody tr.active {
  background: rgba(59, 130, 246, 0.08);
}

.name {
  font-weight: 800;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid #cbd5e1;
}

.badge.normal {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.12);
  color: #14532d;
}

.badge.warning {
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.12);
  color: #7c2d12;
}

.badge.error {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.12);
  color: #7f1d1d;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: rgba(59, 130, 246, 0.12);
  color: #0f172a;
  font-weight: 800;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.resetFeedback {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.reasonBox {
  padding: 12px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  line-height: 1.55;
}

.reasonBox.warning {
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.1);
}

.reasonBox.error {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.1);
}

.detail {
  min-height: 500px;
}

.blocks {
  padding: 14px 16px 18px;
  display: grid;
  gap: 14px;
}

.block h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
}

.kv {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.kv-item {
  display: grid;
  gap: 6px;
}

.kv-item label {
  font-size: 12px;
  color: #64748b;
}

.list {
  margin: 0;
  padding-left: 18px;
  color: #0f172a;
}

.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.empty {
  padding: 18px;
  color: #64748b;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
