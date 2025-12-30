<template>
  <div class="ems">
    <div class="header">
      <div>
        <h1>EMS（能量管理系统）</h1>
        <p class="sub">
          以“输入 → 决策 →
          输出”为核心展示：汇聚现场设备/协控层/调度指令，并通过决策系统生成站内控制目标，反馈协控并上送主站，同时输出可供SCADA展示的数据。
        </p>
      </div>
      <div class="meta">
        <div class="meta-item">
          <span class="k">时间</span>
          <span class="v">{{ snapshot?.inputs.timestamp || '' }}</span>
        </div>
        <div class="meta-item">
          <span class="k">决策</span>
          <span class="v">{{ snapshot?.decision.decisionId || '-' }}</span>
        </div>
      </div>
    </div>

    <div v-if="snapshot" class="grid">
      <section id="ems-inputs" class="panel">
        <div class="panel-h">
          <h2>输入</h2>
          <span class="stamp">来源：现场 + 协控 + 调度</span>
        </div>

        <div class="block">
          <h3>现场设备基础信息（PCS / BMS / 保护装置）</h3>
          <div class="kv">
            <div class="kv-item">
              <label>PCS数量</label>
              <span>{{ snapshot.inputs.fieldDevices.pcsCount }}</span>
            </div>
            <div class="kv-item">
              <label>BMS数量</label>
              <span>{{ snapshot.inputs.fieldDevices.bmsCount }}</span>
            </div>
            <div class="kv-item">
              <label>保护装置数量</label>
              <span>{{ snapshot.inputs.fieldDevices.protectionCount }}</span>
            </div>
            <div class="kv-item">
              <label>PCS状态(N/W/E)</label>
              <span>
                {{ snapshot.inputs.fieldDevices.pcsStatusCounts.normal }}/{{
                  snapshot.inputs.fieldDevices.pcsStatusCounts.warning
                }}/{{ snapshot.inputs.fieldDevices.pcsStatusCounts.error }}
              </span>
            </div>
            <div class="kv-item">
              <label>BMS状态(N/W/E)</label>
              <span>
                {{ snapshot.inputs.fieldDevices.bmsStatusCounts.normal }}/{{
                  snapshot.inputs.fieldDevices.bmsStatusCounts.warning
                }}/{{ snapshot.inputs.fieldDevices.bmsStatusCounts.error }}
              </span>
            </div>
            <div class="kv-item">
              <label>保护装置状态(N/W/E)</label>
              <span>
                {{ snapshot.inputs.fieldDevices.protectionStatusCounts.normal }}/{{
                  snapshot.inputs.fieldDevices.protectionStatusCounts.warning
                }}/{{ snapshot.inputs.fieldDevices.protectionStatusCounts.error }}
              </span>
            </div>
          </div>

          <div class="table-wrap" v-if="snapshot.inputs.protectionDevices.length">
            <table class="tbl">
              <thead>
                <tr>
                  <th>保护/安全装置</th>
                  <th>状态</th>
                  <th>动作</th>
                  <th>最近</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in snapshot.inputs.protectionDevices" :key="p.name">
                  <td>{{ p.name }}</td>
                  <td>
                    <span class="badge" :class="p.status">{{ statusText(p.status) }}</span>
                  </td>
                  <td>{{ p.trip ? '跳闸' : '—' }}</td>
                  <td>{{ p.lastAction }}</td>
                  <td>{{ p.reason || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="block">
          <h3>协控层信息（电池单元状态 / 可用功率上限 / 安全联锁）</h3>
          <div class="kv">
            <div class="kv-item">
              <label>协控单元数</label>
              <span>{{ snapshot.inputs.coordinationLayer.unitCount }}</span>
            </div>
            <div class="kv-item">
              <label>单元状态(N/W/E)</label>
              <span>
                {{ snapshot.inputs.coordinationLayer.unitStatusCounts.normal }}/{{
                  snapshot.inputs.coordinationLayer.unitStatusCounts.warning
                }}/{{ snapshot.inputs.coordinationLayer.unitStatusCounts.error }}
              </span>
            </div>
            <div class="kv-item">
              <label>单元通信(N/W/E)</label>
              <span>
                {{ snapshot.inputs.coordinationLayer.unitCommStatusCounts.normal }}/{{
                  snapshot.inputs.coordinationLayer.unitCommStatusCounts.warning
                }}/{{ snapshot.inputs.coordinationLayer.unitCommStatusCounts.error }}
              </span>
            </div>
            <div class="kv-item">
              <label>可用功率上限</label>
              <span>{{ snapshot.inputs.coordinationLayer.availablePowerUpperLimitKw }} kW</span>
            </div>
            <div class="kv-item">
              <label>安全联锁</label>
              <span
                :class="[
                  'pill',
                  snapshot.inputs.coordinationLayer.safetyInterlockActive ? 'hot' : 'ok',
                ]"
              >
                {{ snapshot.inputs.coordinationLayer.safetyInterlockActive ? '生效' : '未生效' }}
              </span>
            </div>
            <div class="kv-item">
              <label>联锁原因</label>
              <span>{{ snapshot.inputs.coordinationLayer.interlockReason || '-' }}</span>
            </div>
          </div>
        </div>

        <div class="block">
          <h3>电网调度指令（AGC / AVC）</h3>
          <div class="kv">
            <div class="kv-item">
              <label>来源</label>
              <span>{{ snapshot.inputs.dispatch.source }}</span>
            </div>
            <div class="kv-item">
              <label>下发时间</label>
              <span>{{ snapshot.inputs.dispatch.issuedAt }}</span>
            </div>
            <div class="kv-item">
              <label>AGC使能</label>
              <span :class="['pill', snapshot.inputs.dispatch.agcEnabled ? 'ok' : 'off']">
                {{ snapshot.inputs.dispatch.agcEnabled ? 'ON' : 'OFF' }}
              </span>
            </div>
            <div class="kv-item">
              <label>AGC设定值</label>
              <span>{{ snapshot.inputs.dispatch.agcSetpointKw }} kW</span>
            </div>
            <div class="kv-item">
              <label>AVC使能</label>
              <span :class="['pill', snapshot.inputs.dispatch.avcEnabled ? 'ok' : 'off']">
                {{ snapshot.inputs.dispatch.avcEnabled ? 'ON' : 'OFF' }}
              </span>
            </div>
            <div class="kv-item">
              <label>AVC母线电压</label>
              <span>{{ snapshot.inputs.dispatch.avcBusVoltageSetpointKv }} kV</span>
            </div>
          </div>
        </div>
      </section>

      <section id="ems-decision" class="panel">
        <div class="panel-h">
          <h2>决策系统</h2>
          <span class="stamp">{{ snapshot.decision.timestamp }}</span>
        </div>

        <div class="block">
          <h3>决策结果</h3>
          <div class="kv">
            <div class="kv-item">
              <label>就绪</label>
              <span :class="['pill', snapshot.decision.ready ? 'ok' : 'hot']">{{
                snapshot.decision.ready ? '是' : '否'
              }}</span>
            </div>
            <div class="kv-item">
              <label>策略</label>
              <span class="strong">{{ snapshot.decision.decisionMode }}</span>
            </div>
            <div class="kv-item">
              <label>全站目标功率</label>
              <span class="strong">{{ snapshot.decision.stationTargetPowerKw }} kW</span>
            </div>
            <div class="kv-item">
              <label>全站目标电压</label>
              <span class="strong">
                {{
                  snapshot.decision.stationTargetVoltageKv ??
                  (snapshot.inputs.dispatch.avcEnabled
                    ? snapshot.inputs.dispatch.avcBusVoltageSetpointKv
                    : null) ??
                  '-'
                }}
                {{
                  snapshot.decision.stationTargetVoltageKv || snapshot.inputs.dispatch.avcEnabled
                    ? ' kV'
                    : ''
                }}
                <span class="muted">
                  {{
                    snapshot.decision.stationTargetVoltageSource === 'local'
                      ? '（本地AVC）'
                      : snapshot.decision.stationTargetVoltageSource === 'remote'
                        ? '（远端AVC）'
                        : snapshot.decision.stationTargetVoltageSource === 'auto'
                          ? '（自动AVC）'
                          : ''
                  }}
                </span>
              </span>
            </div>
            <div class="kv-item">
              <label>限制原因</label>
              <span>{{ snapshot.decision.limitReason || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>SCADA摘要</label>
              <span>{{ snapshot.outputs.toScada.decisionDigest }}</span>
            </div>
          </div>
        </div>

        <div class="block">
          <h3>动作清单</h3>
          <ul class="list">
            <li v-for="(a, idx) in snapshot.decision.actions" :key="idx">{{ a }}</li>
            <li v-if="snapshot.decision.actions.length === 0">—</li>
          </ul>
        </div>

        <div class="block">
          <h3>理由/依据</h3>
          <ul class="list">
            <li v-for="(r, idx) in snapshot.decision.rationale" :key="idx">{{ r }}</li>
            <li v-if="snapshot.decision.rationale.length === 0">—</li>
          </ul>
        </div>

        <div class="block">
          <h3>站内状态（辅助决策）</h3>
          <div class="kv">
            <div class="kv-item">
              <label>全站实际功率</label>
              <span>{{ snapshot.inputs.station.actualTotalKw }} kW</span>
            </div>
            <div class="kv-item">
              <label>可用容量</label>
              <span>{{ snapshot.inputs.station.availableCapacityKwh }} kWh</span>
            </div>
            <div class="kv-item">
              <label>平均SOC</label>
              <span>{{ snapshot.inputs.station.avgSocPct }} %</span>
            </div>
          </div>
        </div>
      </section>

      <section id="ems-outputs" class="panel wide">
        <div class="panel-h">
          <h2>输出</h2>
          <span class="stamp">反馈协控 + 上送主站 + 供SCADA展示</span>
        </div>

        <div class="three">
          <div class="block">
            <h3>协控层（全站控制目标）</h3>
            <div class="kv">
              <div class="kv-item">
                <label>控制模式</label>
                <span class="strong">{{
                  snapshot.outputs.toCoordinationLayer.stationControlMode
                }}</span>
              </div>
              <div class="kv-item">
                <label>目标功率</label>
                <span class="strong"
                  >{{ snapshot.outputs.toCoordinationLayer.stationControlTargetPowerKw }} kW</span
                >
              </div>
              <div class="kv-item">
                <label>目标电压</label>
                <span class="strong">
                  {{ snapshot.outputs.toCoordinationLayer.targetVoltageKv ?? '-'
                  }}{{ snapshot.outputs.toCoordinationLayer.targetVoltageKv ? ' kV' : '' }}
                </span>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>主站（上送功率 / 可用容量 / 故障信息）</h3>
            <div class="kv">
              <div class="kv-item">
                <label>上送实际功率</label>
                <span>{{ snapshot.outputs.toMasterStation.reportActualTotalKw }} kW</span>
              </div>
              <div class="kv-item">
                <label>上送可用容量</label>
                <span>{{ snapshot.outputs.toMasterStation.reportAvailableCapacityKwh }} kWh</span>
              </div>
            </div>
            <div class="table-wrap" v-if="snapshot.outputs.toMasterStation.reportFaults.length">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>设备</th>
                    <th>等级</th>
                    <th>描述</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(f, idx) in snapshot.outputs.toMasterStation.reportFaults" :key="idx">
                    <td>{{ f.device }}</td>
                    <td>
                      <span class="badge" :class="f.level">{{ statusText(f.level) }}</span>
                    </td>
                    <td>
                      {{ f.description }}<span v-if="f.code">（{{ f.code }}）</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="block">
            <h3>SCADA信息（告警 / 报表 / 建议 / 可视化画面）</h3>
            <div class="kv">
              <div class="kv-item">
                <label>决策摘要</label>
                <span>{{ snapshot.outputs.toScada.decisionDigest }}</span>
              </div>
            </div>
            <div class="mini-grid">
              <div class="mini">
                <h4>告警(预览)</h4>
                <ul class="list">
                  <li v-for="(a, idx) in snapshot.outputs.toScada.alarms" :key="idx">
                    <span class="mono">[{{ a.level }}]</span> {{ a.title }}
                  </li>
                  <li v-if="snapshot.outputs.toScada.alarms.length === 0">—</li>
                </ul>
              </div>
              <div class="mini">
                <h4>报表(预览)</h4>
                <ul class="list">
                  <li v-for="(r, idx) in snapshot.outputs.toScada.reports" :key="idx">
                    {{ r.title }}：{{ r.summary }}
                  </li>
                  <li v-if="snapshot.outputs.toScada.reports.length === 0">—</li>
                </ul>
              </div>
              <div class="mini">
                <h4>优化建议</h4>
                <ul class="list">
                  <li
                    v-for="(s, idx) in snapshot.outputs.toScada.optimizationSuggestions"
                    :key="idx"
                  >
                    {{ s }}
                  </li>
                  <li v-if="snapshot.outputs.toScada.optimizationSuggestions.length === 0">—</li>
                </ul>
              </div>
              <div class="mini">
                <h4>可视化画面建议</h4>
                <ul class="list">
                  <li v-for="(h, idx) in snapshot.outputs.toScada.visualizationHints" :key="idx">
                    {{ h }}
                  </li>
                  <li v-if="snapshot.outputs.toScada.visualizationHints.length === 0">—</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="empty">暂无EMS快照（等待刷新）。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEnergyStore } from '../stores/energyStore'

const energyStore = useEnergyStore()
const route = useRoute()
const snapshot = computed(() => energyStore.emsSnapshot)

const statusText = (s: 'normal' | 'warning' | 'error') =>
  s === 'normal' ? '正常' : s === 'warning' ? '告警' : '故障'

const focusTo = async () => {
  const sec = String(route.query.section ?? '')
  if (!sec) return
  await nextTick()
  const el = document.getElementById(`ems-${sec}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  void focusTo()
})
</script>

<style scoped>
.ems {
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
  max-width: 980px;
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
  font-weight: 900;
  color: #2d3748;
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

.panel.wide {
  grid-column: 1 / -1;
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
  font-weight: 800;
}

.kv-item span {
  font-size: 14px;
  color: #2d3748;
  font-weight: 900;
}

.strong {
  font-weight: 1000;
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

.pill.hot {
  background: #fed7d7;
  color: #742a2a;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 10px;
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

.list {
  margin: 0;
  padding-left: 18px;
  color: #2d3748;
  font-weight: 800;
  font-size: 13px;
}

.three {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.mini {
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f7fafc;
}

.mini h4 {
  margin: 0 0 8px 0;
  color: #2d3748;
  font-size: 13px;
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
  .three {
    grid-template-columns: 1fr;
  }
}
</style>
