<template>
  <div class="fs">
    <div class="header">
      <div>
        <h1>前置服务器（数据采集 / 协议转换）</h1>
        <p class="sub">
          面向调度主站侧：IEC 60870-5-104；面向站内设备侧：IEC 61850。此页面模拟“站内采集→点表映射→上送/下发”的全过程展示。
        </p>
      </div>
      <div class="meta" v-if="snapshot">
        <div class="mi">
          <span class="k">时间</span>
          <span class="v">{{ snapshot.timestamp }}</span>
        </div>
        <div class="mi">
          <span class="k">104 链路</span>
          <span class="v badge" :class="snapshot.masterSide.endpoint.linkStatus">{{ statusText(snapshot.masterSide.endpoint.linkStatus) }}</span>
        </div>
        <div class="mi">
          <span class="k">61850 质量</span>
          <span class="v">{{ snapshot.stationSide.stats.badQualityPct }}%</span>
        </div>
      </div>
    </div>

    <div v-if="snapshot" class="grid">
      <section class="panel">
        <div class="ph">
          <div class="t">站内侧采集（IEC 61850）</div>
          <div class="s">IED 列表 · MMS/GOOSE/SV 采样 · 质量统计</div>
        </div>
        <div class="body">
          <div class="kpis">
            <div class="kpi">
              <span class="k">MMS/min</span>
              <span class="v">{{ snapshot.stationSide.stats.mmsRxPerMin }}</span>
            </div>
            <div class="kpi">
              <span class="k">GOOSE/min</span>
              <span class="v">{{ snapshot.stationSide.stats.gooseRxPerMin }}</span>
            </div>
            <div class="kpi">
              <span class="k">SV/min</span>
              <span class="v">{{ snapshot.stationSide.stats.svRxPerMin }}</span>
            </div>
            <div class="kpi">
              <span class="k">坏质量</span>
              <span class="v">{{ snapshot.stationSide.stats.badQualityPct }}%</span>
            </div>
          </div>

          <div class="split">
            <div>
              <div class="h">IED 列表</div>
              <div class="list">
                <div v-for="d in snapshot.stationSide.ieds" :key="d.name" class="row">
                  <span class="name">{{ d.name }}</span>
                  <span class="type">{{ d.type }}</span>
                  <span class="ip">{{ d.ip }}</span>
                  <span class="badge" :class="d.status">{{ statusText(d.status) }}</span>
                </div>
              </div>
            </div>

            <div>
              <div class="h">采集样本（最近）</div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>IED</th>
                      <th>服务</th>
                      <th>方向</th>
                      <th>状态</th>
                      <th>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, idx) in snapshot.stationSide.samples" :key="idx">
                      <td>{{ p.timestamp }}</td>
                      <td>{{ p.ied }}</td>
                      <td>{{ p.service }}</td>
                      <td>{{ p.direction }}</td>
                      <td><span class="badge" :class="p.status">{{ statusText(p.status) }}</span></td>
                      <td class="mono">{{ p.payload }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="ph">
          <div class="t">协议转换（点表映射 / 质量处理）</div>
          <div class="s">IEC61850 数据对象 ↔ IEC104 IOA/ASDU，展示映射表与转换日志</div>
        </div>
        <div class="body">
          <div class="kpis">
            <div class="kpi">
              <span class="k">点表</span>
              <span class="v">{{ snapshot.mapping.total }}</span>
            </div>
            <div class="kpi">
              <span class="k">GOOD</span>
              <span class="v">{{ snapshot.mapping.ok }}</span>
            </div>
            <div class="kpi">
              <span class="k">QUESTIONABLE</span>
              <span class="v">{{ snapshot.mapping.questionable }}</span>
            </div>
            <div class="kpi">
              <span class="k">INVALID</span>
              <span class="v">{{ snapshot.mapping.invalid }}</span>
            </div>
            <div class="kpi">
              <span class="k">队列积压</span>
              <span class="v">{{ snapshot.conversion.backlog }}</span>
            </div>
            <div class="kpi">
              <span class="k">P95延迟</span>
              <span class="v">{{ snapshot.conversion.latencyMsP95 }}ms</span>
            </div>
          </div>

          <div class="split">
            <div>
              <div class="h">点表映射（节选）</div>
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>点名</th>
                      <th>61850</th>
                      <th>FC</th>
                      <th>104</th>
                      <th>Q</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in snapshot.mapping.table" :key="m.id">
                      <td>{{ m.id }}</td>
                      <td>{{ m.name }}</td>
                      <td class="mono">{{ m.iedName }} {{ m.ld }}/{{ m.ln }}.{{ m.doName }}.{{ m.daName }}</td>
                      <td>{{ m.fc }}</td>
                      <td class="mono">IOA {{ m.ioa }} / {{ m.asduType }}</td>
                      <td>
                        <span class="q" :class="m.quality">{{ m.quality }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div class="h">转换日志（最近）</div>
              <div class="list">
                <div v-for="(l, idx) in snapshot.conversion.logs" :key="idx" class="log" :class="l.status">
                  <div class="log-top">
                    <span class="ts">{{ l.timestamp }}</span>
                    <span class="dir">{{ l.direction }}</span>
                    <span class="mid">{{ l.mappingId }}</span>
                    <span class="badge" :class="l.status">{{ statusText(l.status) }}</span>
                  </div>
                  <div class="log-sum">{{ l.summary }}</div>
                  <div class="log-det mono">{{ l.detail }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel wide">
        <div class="ph">
          <div class="t">调度主站侧（IEC 104 上送/下发）</div>
          <div class="s">I帧/ASDU 解析展示：上送遥测/遥信、下发 AGC/AVC/控制命令</div>
        </div>
        <div class="body">
          <div class="kpis">
            <div class="kpi">
              <span class="k">TX ASDU/min</span>
              <span class="v">{{ snapshot.masterSide.stats.txAsduPerMin }}</span>
            </div>
            <div class="kpi">
              <span class="k">RX CMD/min</span>
              <span class="v">{{ snapshot.masterSide.stats.rxCmdPerMin }}</span>
            </div>
            <div class="kpi">
              <span class="k">Keepalive</span>
              <span class="v">{{ snapshot.masterSide.stats.linkKeepalive }}</span>
            </div>
            <div class="kpi">
              <span class="k">Last ACK</span>
              <span class="v">{{ snapshot.masterSide.stats.lastAck }}</span>
            </div>
          </div>

          <div class="endpoint">
            <div class="e-item">
              <span class="k">Endpoint</span>
              <span class="v mono">{{ snapshot.masterSide.endpoint.host }}:{{ snapshot.masterSide.endpoint.port }}</span>
            </div>
            <div class="e-item">
              <span class="k">链路状态</span>
              <span class="v badge" :class="snapshot.masterSide.endpoint.linkStatus">{{ statusText(snapshot.masterSide.endpoint.linkStatus) }}</span>
            </div>
          </div>

          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>方向</th>
                  <th>状态</th>
                  <th>APCI</th>
                  <th>ASDU</th>
                  <th>IOA</th>
                  <th>COT</th>
                  <th>值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, idx) in snapshot.masterSide.frames" :key="idx">
                  <td>{{ f.timestamp }}</td>
                  <td>{{ f.direction }}</td>
                  <td><span class="badge" :class="f.status">{{ statusText(f.status) }}</span></td>
                  <td class="mono">{{ f.apci }}</td>
                  <td class="mono">{{ f.asdu }}</td>
                  <td>{{ f.ioa }}</td>
                  <td>{{ f.cot }}</td>
                  <td class="mono">{{ f.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="empty">
      暂无前置服务器数据（等待刷新）。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEnergyStore } from '../stores/energyStore'

defineOptions({ name: 'FrontServerView' })

const energyStore = useEnergyStore()
const snapshot = computed(() => energyStore.frontServerSnapshot)

const statusText = (s: 'normal' | 'warning' | 'error') => (s === 'normal' ? '正常' : s === 'warning' ? '告警' : '故障')
</script>

<style scoped>
.fs {
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

.mi {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mi .k {
  font-size: 12px;
  color: #718096;
}
.mi .v {
  font-size: 14px;
  font-weight: 900;
  color: #2d3748;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel.wide {
  grid-column: 1 / -1;
}

.ph {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}
.ph .t {
  font-weight: 900;
  color: #1a202c;
}
.ph .s {
  margin-top: 2px;
  color: #718096;
  font-size: 12px;
}

.body {
  padding: 12px 14px 14px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.kpi {
  background: #0b1220;
  color: #e8f0ff;
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
}
.kpi .k {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.65);
  font-weight: 800;
}
.kpi .v {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 1000;
  color: #00d4ff;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.h {
  font-weight: 900;
  color: #2d3748;
  margin-bottom: 8px;
}

.list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
  padding-right: 6px;
}

.row {
  display: grid;
  grid-template-columns: 1.2fr 0.6fr 0.9fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
}
.row .name {
  font-weight: 900;
  color: #1a202c;
}
.row .type,
.row .ip {
  color: #4a5568;
  font-weight: 700;
  font-size: 12px;
}

.table-wrap {
  overflow: auto;
  max-height: 320px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
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
}
.tbl td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
  white-space: nowrap;
}
.tbl tr:hover td {
  background: #f7fafc;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 1000;
  border: 1px solid #e2e8f0;
  background: white;
  color: #2d3748;
}
.badge.normal {
  background: #c6f6d5;
  border-color: #9ae6b4;
  color: #22543d;
}
.badge.warning {
  background: #fefcbf;
  border-color: #faf089;
  color: #744210;
}
.badge.error {
  background: #fed7d7;
  border-color: #feb2b2;
  color: #742a2a;
}

.q {
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 1000;
  font-size: 12px;
  border: 1px solid #e2e8f0;
  background: white;
}
.q.GOOD {
  border-color: #9ae6b4;
  color: #22543d;
}
.q.QUESTIONABLE {
  border-color: #faf089;
  color: #744210;
}
.q.INVALID {
  border-color: #feb2b2;
  color: #742a2a;
}

.log {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #0b1220;
  color: #e8f0ff;
  padding: 10px 12px;
}
.log-top {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.log .ts {
  color: rgba(232, 240, 255, 0.75);
  font-weight: 900;
  font-size: 12px;
}
.log .dir {
  font-weight: 1000;
  color: #2dd4bf;
}
.log .mid {
  font-weight: 900;
  color: rgba(232, 240, 255, 0.7);
}
.log .log-sum {
  font-weight: 1000;
}
.log .log-det {
  margin-top: 6px;
  color: rgba(232, 240, 255, 0.75);
}

.endpoint {
  display: flex;
  gap: 16px;
  margin: 10px 0 12px;
  padding: 10px 12px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.e-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.e-item .k {
  font-size: 12px;
  color: #718096;
  font-weight: 800;
}
.e-item .v {
  font-weight: 1000;
  color: #2d3748;
}

.empty {
  padding: 18px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  color: #718096;
  font-weight: 800;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .split {
    grid-template-columns: 1fr;
  }
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>


