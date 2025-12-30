<template>
  <div class="scada">
    <div class="bg-grid" />
    <div class="bg-glow" />
    <!-- 中央数字孪生“伪三维”背景（SVG 等距风格） -->
    <div class="twin-bg" aria-hidden="true">
      <svg class="twin-svg" viewBox="0 0 1200 700">
        <defs>
          <linearGradient id="tg" x1="0" x2="1">
            <stop offset="0" stop-color="#00d4ff" stop-opacity="0.95" />
            <stop offset="1" stop-color="#7c3aed" stop-opacity="0.95" />
          </linearGradient>
          <linearGradient id="tg2" x1="0" x2="1">
            <stop offset="0" stop-color="#2dd4bf" stop-opacity="0.75" />
            <stop offset="1" stop-color="#00d4ff" stop-opacity="0.75" />
          </linearGradient>
          <filter id="tGlow">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="tGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(45,212,191,0.18)"
              stroke-width="1"
            />
          </pattern>
        </defs>

        <!-- Base isometric floor -->
        <path
          d="M200 420 L600 210 L1000 420 L600 630 Z"
          fill="rgba(11,16,32,0.55)"
          stroke="rgba(0,212,255,0.22)"
          stroke-width="2"
        />
        <path
          d="M200 420 L600 210 L1000 420"
          stroke="url(#tg)"
          stroke-width="3"
          opacity="0.8"
          filter="url(#tGlow)"
        />
        <path
          d="M200 420 L600 630 L1000 420"
          stroke="rgba(124,58,237,0.35)"
          stroke-width="2"
          opacity="0.65"
        />
        <path d="M230 430 L600 240 L970 430 L600 610 Z" fill="url(#tGrid)" opacity="0.65" />

        <!-- Containers (battery cabins) -->
        <g filter="url(#tGlow)">
          <g
            v-for="i in 6"
            :key="'cL' + i"
            :transform="`translate(${290 + (i - 1) * 78}, ${405 + (i - 1) * 18})`"
          >
            <path
              d="M0 0 L70 -40 L140 0 L70 40 Z"
              fill="rgba(6,10,24,0.55)"
              stroke="rgba(0,212,255,0.35)"
            />
            <path
              d="M70 -40 L70 -95 L140 -55 L140 0 Z"
              fill="rgba(20,28,60,0.55)"
              stroke="rgba(0,212,255,0.25)"
            />
            <path
              d="M0 0 L0 -55 L70 -95 L70 -40 Z"
              fill="rgba(11,16,32,0.65)"
              stroke="rgba(124,58,237,0.22)"
            />
            <path d="M18 -18 L52 -38" stroke="rgba(45,212,191,0.55)" />
            <path d="M24 -10 L58 -30" stroke="rgba(45,212,191,0.35)" />
          </g>
        </g>

        <!-- PCS/Inverter block -->
        <g filter="url(#tGlow)" transform="translate(650,330)">
          <path
            d="M0 0 L120 -70 L240 0 L120 70 Z"
            fill="rgba(6,10,24,0.62)"
            stroke="url(#tg)"
            stroke-width="2"
          />
          <path
            d="M120 -70 L120 -170 L240 -100 L240 0 Z"
            fill="rgba(20,28,60,0.55)"
            stroke="rgba(0,212,255,0.25)"
          />
          <path
            d="M0 0 L0 -100 L120 -170 L120 -70 Z"
            fill="rgba(11,16,32,0.68)"
            stroke="rgba(124,58,237,0.22)"
          />
          <text x="120" y="-18" text-anchor="middle" fill="#e8f0ff" font-weight="900">PCS</text>
          <text
            x="120"
            y="8"
            text-anchor="middle"
            fill="rgba(232,240,255,0.70)"
            font-size="12"
            font-weight="800"
          >
            Inverter Cluster
          </text>
        </g>

        <!-- Transformer / Grid interface -->
        <g filter="url(#tGlow)" transform="translate(420,275)">
          <path
            d="M0 0 L90 -52 L180 0 L90 52 Z"
            fill="rgba(6,10,24,0.55)"
            stroke="rgba(45,212,191,0.35)"
          />
          <path
            d="M90 -52 L90 -120 L180 -68 L180 0 Z"
            fill="rgba(20,28,60,0.50)"
            stroke="rgba(0,212,255,0.22)"
          />
          <path
            d="M0 0 L0 -68 L90 -120 L90 -52 Z"
            fill="rgba(11,16,32,0.62)"
            stroke="rgba(124,58,237,0.18)"
          />
          <text x="90" y="-10" text-anchor="middle" fill="#e8f0ff" font-weight="900">TR</text>
        </g>

        <!-- Energy flow lines -->
        <g filter="url(#tGlow)">
          <path d="M520 250 L610 300" stroke="url(#tg2)" stroke-width="4" opacity="0.9" />
          <path d="M620 360 L620 405" stroke="url(#tg2)" stroke-width="4" opacity="0.9" />
          <path d="M520 250 L360 330" stroke="url(#tg2)" stroke-width="3" opacity="0.65" />
          <circle cx="610" cy="300" r="6" fill="#00d4ff" />
          <circle cx="620" cy="405" r="6" fill="#2dd4bf" />
        </g>

        <!-- HUD rings -->
        <g opacity="0.85">
          <circle
            cx="600"
            cy="380"
            r="230"
            fill="none"
            stroke="rgba(0,212,255,0.18)"
            stroke-width="2"
          />
          <circle
            cx="600"
            cy="380"
            r="300"
            fill="none"
            stroke="rgba(124,58,237,0.14)"
            stroke-width="2"
          />
          <circle
            cx="600"
            cy="380"
            r="360"
            fill="none"
            stroke="rgba(45,212,191,0.10)"
            stroke-width="2"
          />
          <path d="M600 30 V120" stroke="rgba(0,212,255,0.18)" />
          <path d="M600 640 V700" stroke="rgba(0,212,255,0.18)" />
          <path d="M140 380 H240" stroke="rgba(0,212,255,0.18)" />
          <path d="M960 380 H1060" stroke="rgba(0,212,255,0.18)" />
        </g>

        <!-- Labels -->
        <g opacity="0.9">
          <text x="260" y="270" fill="rgba(232,240,255,0.7)" font-size="12" font-weight="800">
            Battery Containers
          </text>
          <text x="720" y="250" fill="rgba(232,240,255,0.7)" font-size="12" font-weight="800">
            PCS / Inverter
          </text>
          <text x="400" y="210" fill="rgba(232,240,255,0.7)" font-size="12" font-weight="800">
            Transformer
          </text>
        </g>
      </svg>
    </div>

    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">
          <div class="dot" />
          <div class="dot" />
          <div class="dot" />
        </div>
        <div class="brand-text">
          <div class="title">数字孪生 · SCADA 大屏</div>
          <div class="subtitle">储能电站协同调度与智能决策可视化（模拟）</div>
        </div>
      </div>

      <div class="top-metrics">
        <div class="tm">
          <span class="k">时间</span>
          <span class="v">{{ snapshot?.inputs.timestamp ?? '--' }}</span>
        </div>
        <div class="tm">
          <span class="k">就绪</span>
          <span class="v pill" :class="snapshot?.outputs.toScada.kpis.ready ? 'ok' : 'hot'">
            {{ snapshot?.outputs.toScada.kpis.ready ? 'READY' : 'NOT READY' }}
          </span>
        </div>
        <div class="tm">
          <span class="k">策略</span>
          <span class="v chip">{{ snapshot?.outputs.toScada.kpis.mode ?? '--' }}</span>
        </div>
        <div class="tm">
          <span class="k">目标/实际(kW)</span>
          <span class="v">
            {{ snapshot?.outputs.toScada.kpis.targetPowerKw ?? '--' }} /
            <span class="neon">{{ snapshot?.outputs.toScada.kpis.actualPowerKw ?? '--' }}</span>
          </span>
        </div>
      </div>
    </header>

    <main class="layout" v-if="snapshot">
      <!-- Left rail -->
      <section class="rail left">
        <div class="panel alarms">
          <div class="ph">
            <div class="ph-title">实时报警</div>
            <div class="ph-sub">来自 EMS 输出（toScada.alarms）</div>
          </div>
          <div class="alarm-list scroll">
            <div v-for="(a, idx) in displayAlarms" :key="idx" class="alarm" :class="a.level">
              <div class="alarm-left">
                <div class="alarm-level">{{ a.level.toUpperCase() }}</div>
                <div class="alarm-title">{{ a.title }}</div>
                <div class="alarm-detail">{{ a.detail }}</div>
              </div>
              <div class="alarm-time">{{ a.at }}</div>
            </div>
            <div v-if="displayAlarms.length === 0" class="empty-row">暂无报警</div>
            <div v-if="moreAlarmCount > 0" class="more-row">
              还有 {{ moreAlarmCount }} 条（已折叠）
            </div>
          </div>
        </div>

        <div class="panel collapsible" :class="{ collapsed: !leftOpen.fire }">
          <button class="ph ph-btn" type="button" @click="leftOpen.fire = !leftOpen.fire">
            <div class="ph-left">
              <div class="ph-title">消防系统</div>
              <div class="ph-sub">联动状态 · 火灾确认 · 说明</div>
            </div>
            <span class="chev" :class="{ on: leftOpen.fire }">▾</span>
          </button>
          <div v-show="leftOpen.fire" class="panel-body fire">
            <div
              class="fire-badge"
              :class="snapshot.outputs.toScada.fireSystem.fireConfirmed ? 'hot' : 'ok'"
            >
              {{ snapshot.outputs.toScada.fireSystem.fireConfirmed ? 'FIRE CONFIRMED' : 'NO FIRE' }}
            </div>
            <div class="kv2">
              <div class="kv2i">
                <span class="k">联动模块</span>
                <span class="v">
                  <span
                    class="chip"
                    :class="snapshot.outputs.toScada.fireSystem.fireLinkageModuleStatus"
                  >
                    {{ statusText(snapshot.outputs.toScada.fireSystem.fireLinkageModuleStatus) }}
                  </span>
                </span>
              </div>
              <div class="kv2i">
                <span class="k">说明</span>
                <span class="v">{{ snapshot.outputs.toScada.fireSystem.note }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel collapsible" :class="{ collapsed: !leftOpen.strategy }">
          <button class="ph ph-btn" type="button" @click="leftOpen.strategy = !leftOpen.strategy">
            <div class="ph-left">
              <div class="ph-title">当前策略</div>
              <div class="ph-sub">决策摘要 · 动作 · 依据</div>
            </div>
            <span class="chev" :class="{ on: leftOpen.strategy }">▾</span>
          </button>
          <div v-show="leftOpen.strategy" class="panel-body strategy">
            <div class="digest">{{ snapshot.outputs.toScada.decisionDigest }}</div>
            <div class="cols">
              <div class="col">
                <div class="h">动作</div>
                <ul class="list">
                  <li v-for="(x, idx) in snapshot.decision.actions" :key="idx">{{ x }}</li>
                  <li v-if="snapshot.decision.actions.length === 0">—</li>
                </ul>
              </div>
              <div class="col">
                <div class="h">依据</div>
                <ul class="list">
                  <li v-for="(x, idx) in snapshot.decision.rationale" :key="idx">{{ x }}</li>
                  <li v-if="snapshot.decision.rationale.length === 0">—</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Center stage -->
      <section class="stage">
        <!-- 中间留白：让数字孪生背景成为视觉中心 -->
        <div class="stage-spacer" />

        <!-- 底部 Dock：保留底部 Tab，中央留白给数字孪生 -->
        <div class="stage-dock">
          <div class="panel bottom bottom-dock">
            <div class="bottom-head">
              <div class="tabs">
                <button
                  class="tab"
                  :class="{ active: bottomTab === 'trend' }"
                  @click="bottomTab = 'trend'"
                >
                  曲线
                </button>
                <button
                  class="tab"
                  :class="{ active: bottomTab === 'heat' }"
                  @click="bottomTab = 'heat'"
                >
                  云图
                </button>
                <button
                  class="tab"
                  :class="{ active: bottomTab === 'cons' }"
                  @click="bottomTab = 'cons'"
                >
                  一致性
                </button>
                <button
                  class="tab"
                  :class="{ active: bottomTab === 'reports' }"
                  @click="bottomTab = 'reports'"
                >
                  报表
                </button>
                <button
                  class="tab"
                  :class="{ active: bottomTab === 'video' }"
                  @click="bottomTab = 'video'"
                >
                  视频
                </button>
              </div>
              <div class="bottom-hint">底部 Tab</div>
            </div>

            <div class="bottom-body">
              <div v-if="bottomTab === 'trend'" class="tab-body">
                <div class="sparks">
                  <div class="spark">
                    <div class="spark-title">功率(kW)：目标 vs 实际</div>
                    <svg viewBox="0 0 360 90" class="spark-svg">
                      <path
                        :d="sparkPath(history, (p) => p.targetKw, 360, 90)"
                        class="spark-line a"
                      />
                      <path
                        :d="sparkPath(history, (p) => p.actualKw, 360, 90)"
                        class="spark-line b"
                      />
                    </svg>
                  </div>
                  <div class="spark">
                    <div class="spark-title">SOC(%)</div>
                    <svg viewBox="0 0 360 90" class="spark-svg">
                      <path
                        :d="sparkPath(history, (p) => p.avgSocPct, 360, 90)"
                        class="spark-line c"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div v-else-if="bottomTab === 'heat'" class="tab-body">
                <div class="heat">
                  <div class="heat-grid">
                    <div
                      v-for="p in snapshot.outputs.toScada.temperatureCloud.points"
                      :key="p.groupId"
                      class="cell"
                      :style="{
                        background: heatColor(p.temperatureC),
                        borderColor: borderByStatus(p.status),
                      }"
                      :title="`${p.label}：${p.temperatureC}°C`"
                    >
                      <span class="cell-id">{{ p.groupId }}</span>
                      <span class="cell-t">{{ p.temperatureC }}°</span>
                    </div>
                  </div>
                  <div class="heat-legend">
                    <span class="lg"
                      >MIN {{ snapshot.outputs.toScada.temperatureCloud.minC }}°C</span
                    >
                    <div class="bar" />
                    <span class="lg"
                      >MAX {{ snapshot.outputs.toScada.temperatureCloud.maxC }}°C</span
                    >
                  </div>
                </div>
              </div>

              <div v-else-if="bottomTab === 'cons'" class="tab-body">
                <div class="cons">
                  <div class="cons-kpi">
                    <div class="ck">
                      <span class="k">最差ΔV</span>
                      <span class="v neon"
                        >{{ snapshot.outputs.toScada.consistencyAnalysis.worstDeltaMv }} mV</span
                      >
                    </div>
                    <div class="ck">
                      <span class="k">Top风险组</span>
                      <span class="v">{{
                        snapshot.outputs.toScada.consistencyAnalysis.worstGroups.length
                      }}</span>
                    </div>
                  </div>
                  <div class="table-wrap scroll">
                    <table class="tbl small">
                      <thead>
                        <tr>
                          <th>组</th>
                          <th>ΔV(mV)</th>
                          <th>绝缘(kΩ)</th>
                          <th>评分</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="g in snapshot.outputs.toScada.consistencyAnalysis.all"
                          :key="g.groupId"
                        >
                          <td>{{ g.groupId }}</td>
                          <td>{{ g.deltaCellVoltageMv }}</td>
                          <td>{{ g.insulationResistanceKohm }}</td>
                          <td class="mono">{{ g.score }}</td>
                          <td>
                            <span class="chip" :class="g.status">{{ statusText(g.status) }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div v-else-if="bottomTab === 'reports'" class="tab-body scroll">
                <div class="reports">
                  <div
                    v-for="(r, idx) in snapshot.outputs.toScada.reports"
                    :key="idx"
                    class="report"
                  >
                    <div class="rt">{{ r.title }}</div>
                    <div class="rs">{{ r.summary }}</div>
                    <div class="ra">{{ r.at }}</div>
                  </div>
                </div>
              </div>

              <div v-else class="tab-body">
                <div class="video">
                  <div class="video-frame">
                    <div class="video-overlay">
                      <div class="vo-title">CAM-01</div>
                      <div class="vo-sub">请在后续接入真实视频流地址</div>
                    </div>
                  </div>
                  <div class="video-ports">
                    <div class="port">rtsp://...</div>
                    <div class="port">http(s)://...</div>
                    <div class="port">ws://...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Right rail -->
      <section class="rail right">
        <div class="panel">
          <div class="ph">
            <div class="ph-title">全站关键性能指标</div>
            <div class="ph-sub">来自 EMS：toScada.kpis</div>
          </div>
          <div class="kpi-grid">
            <div class="kpi">
              <div class="k">目标功率</div>
              <div class="v neon">
                {{ snapshot.outputs.toScada.kpis.targetPowerKw }} <span class="u">kW</span>
              </div>
            </div>
            <div class="kpi">
              <div class="k">实际功率</div>
              <div class="v">
                {{ snapshot.outputs.toScada.kpis.actualPowerKw }} <span class="u">kW</span>
              </div>
            </div>
            <div class="kpi">
              <div class="k">跟踪误差</div>
              <div class="v">
                {{ snapshot.outputs.toScada.kpis.trackingErrorKw }} <span class="u">kW</span>
              </div>
            </div>
            <div class="kpi">
              <div class="k">可用容量</div>
              <div class="v">
                {{ snapshot.outputs.toScada.kpis.availableCapacityKwh }} <span class="u">kWh</span>
              </div>
            </div>
            <div class="kpi">
              <div class="k">平均SOC</div>
              <div class="v">
                {{ snapshot.outputs.toScada.kpis.avgSocPct }} <span class="u">%</span>
              </div>
            </div>
            <div class="kpi">
              <div class="k">可用功率上限</div>
              <div class="v">
                {{ snapshot.outputs.toScada.kpis.availablePowerUpperLimitKw }}
                <span class="u">kW</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel collapsible" :class="{ collapsed: !rightOpen.ccu }">
          <button class="ph ph-btn" type="button" @click="rightOpen.ccu = !rightOpen.ccu">
            <div class="ph-left">
              <div class="ph-title">协控单元状态</div>
              <div class="ph-sub">3个协控单元 · 通信与就绪</div>
            </div>
            <span class="chev" :class="{ on: rightOpen.ccu }">▾</span>
          </button>
          <div v-show="rightOpen.ccu" class="panel-body scroll">
            <div class="ccu-list">
              <div v-for="u in coordUnits" :key="u.unitId" class="ccu">
                <div class="ccu-left">
                  <div class="ccu-name">CCU {{ u.unitId }}</div>
                  <div class="ccu-sub">
                    状态：<span class="chip" :class="u.status">{{ statusText(u.status) }}</span>
                  </div>
                </div>
                <div class="ccu-right">
                  <div class="ccu-mini">
                    <span class="k">联锁</span>
                    <span class="v pill" :class="u.inputs.safety.interlockActive ? 'hot' : 'ok'">
                      {{ u.inputs.safety.interlockActive ? 'ON' : 'OFF' }}
                    </span>
                  </div>
                  <div class="ccu-mini">
                    <span class="k">对端通信</span>
                    <span class="v">{{
                      u.inputs.peerSignals.map((p) => statusText(p.commStatus)).join(' / ')
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel collapsible" :class="{ collapsed: !rightOpen.suggestions }">
          <button
            class="ph ph-btn"
            type="button"
            @click="rightOpen.suggestions = !rightOpen.suggestions"
          >
            <div class="ph-left">
              <div class="ph-title">优化建议</div>
              <div class="ph-sub">来自 EMS：toScada.optimizationSuggestions</div>
            </div>
            <span class="chev" :class="{ on: rightOpen.suggestions }">▾</span>
          </button>
          <div v-show="rightOpen.suggestions" class="panel-body scroll">
            <ul class="list">
              <li v-for="(s, idx) in snapshot.outputs.toScada.optimizationSuggestions" :key="idx">
                {{ s }}
              </li>
              <li v-if="snapshot.outputs.toScada.optimizationSuggestions.length === 0">—</li>
            </ul>
          </div>
        </div>
      </section>
    </main>

    <div v-else class="empty">暂无 SCADA 数据（等待 EMS 快照刷新）。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEnergyStore } from '../stores/energyStore'

defineOptions({ name: 'ScadaView' })

const energyStore = useEnergyStore()

const snapshot = computed(() => energyStore.emsSnapshot)
const history = computed(() => energyStore.emsHistory.slice(-60))
const coordUnits = computed(() => energyStore.coordinationUnits)

const bottomTab = ref<'trend' | 'heat' | 'cons' | 'reports' | 'video'>('trend')

// 折叠面板：默认收起（减少冗余，保持单屏）
const leftOpen = ref({ fire: false, strategy: false })
const rightOpen = ref({ ccu: false, suggestions: false })

const displayAlarms = computed(() => snapshot.value?.outputs.toScada.alarms.slice(0, 6) ?? [])
const moreAlarmCount = computed(() => {
  const total = snapshot.value?.outputs.toScada.alarms.length ?? 0
  return Math.max(0, total - displayAlarms.value.length)
})

const statusText = (s: 'normal' | 'warning' | 'error') =>
  s === 'normal' ? '正常' : s === 'warning' ? '告警' : '故障'

const borderByStatus = (s: 'normal' | 'warning' | 'error') =>
  s === 'normal'
    ? 'rgba(45, 212, 191, 0.65)'
    : s === 'warning'
      ? 'rgba(250, 204, 21, 0.7)'
      : 'rgba(244, 63, 94, 0.7)'

const heatColor = (t: number) => {
  const cloud = snapshot.value?.outputs.toScada.temperatureCloud
  const min = cloud?.minC ?? 20
  const max = cloud?.maxC ?? 60
  const p = max === min ? 0.5 : Math.min(1, Math.max(0, (t - min) / (max - min)))
  // 蓝→青→黄→红
  const r = Math.round(30 + p * 225)
  const g = Math.round(200 - p * 90)
  const b = Math.round(255 - p * 210)
  return `rgba(${r}, ${g}, ${b}, 0.85)`
}

const sparkPath = <T,>(arr: T[], getY: (t: T) => number, w: number, h: number) => {
  if (!arr.length) return ''
  const ys = arr.map(getY)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const step = w / Math.max(1, arr.length - 1)
  return ys
    .map((y, i) => {
      const x = i * step
      const yy = h - 6 - ((y - min) / span) * (h - 12)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)}`
    })
    .join(' ')
}
</script>

<style scoped>
.scada {
  position: relative;
  height: 100vh;
  padding: 14px;
  color: #e8f0ff;
  background:
    radial-gradient(1200px 700px at 50% 10%, rgba(124, 58, 237, 0.18), transparent 60%),
    radial-gradient(900px 600px at 20% 40%, rgba(0, 212, 255, 0.14), transparent 55%),
    radial-gradient(900px 600px at 80% 70%, rgba(45, 212, 191, 0.1), transparent 55%),
    linear-gradient(180deg, #060a18 0%, #050817 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.08) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(600px 320px at 50% 10%, rgba(0, 0, 0, 1), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.bg-glow {
  position: absolute;
  inset: -100px;
  background: radial-gradient(500px 200px at 50% 0%, rgba(0, 212, 255, 0.25), transparent 70%);
  filter: blur(24px);
  pointer-events: none;
  z-index: 0;
}

.twin-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.twin-svg {
  width: min(980px, 78vw);
  height: auto;
  opacity: 0.42;
  filter: drop-shadow(0 0 26px rgba(0, 212, 255, 0.16))
    drop-shadow(0 0 18px rgba(124, 58, 237, 0.1));
  mix-blend-mode: screen;
  animation: floaty 8s ease-in-out infinite;
}

.twin-svg text {
  letter-spacing: 0.4px;
}

.twin-svg path,
.twin-svg rect,
.twin-svg circle {
  shape-rendering: geometricPrecision;
}

.topbar {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  /* 顶栏也保持玻璃态 */
  background: rgba(6, 10, 24, 0.28);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.35);
  background: radial-gradient(circle at 30% 30%, rgba(0, 212, 255, 0.25), rgba(124, 58, 237, 0.1));
  box-shadow: 0 0 18px rgba(0, 212, 255, 0.22);
  display: grid;
  place-items: center;
  grid-auto-flow: column;
  gap: 4px;
}

.brand-mark .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4ff;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
}

.title {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0.6px;
}

.subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.7);
}

.top-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
}

.tm {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.tm .k {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.62);
  font-weight: 700;
}

.tm .v {
  font-size: 13px;
  font-weight: 900;
}

.neon {
  color: #00d4ff;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.45);
}

.layout {
  position: relative;
  z-index: 2;
  margin-top: 14px;
  display: grid;
  grid-template-columns: 340px minmax(520px, 1fr) 340px;
  gap: 12px;
  /* 关键：让三列区域拉伸占满剩余高度，stage-spacer 才能把 dock 推到底部 */
  align-items: stretch;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.rail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.stage-spacer {
  flex: 1;
  min-height: 0;
  pointer-events: none;
}

.stage-dock {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 0;
  pointer-events: auto;
}

.panel.bottom.bottom-dock {
  flex: 0 0 260px;
}

/* 让左右栏“上/下”更均衡：顶部 KPI/报警固定高度，其余面板自然落到底部 */
.rail.left .panel.alarms {
  flex: 0 0 310px;
}

.rail.right .panel:first-child {
  flex: 0 0 270px;
}

/* 左侧：报警在上，把第一个折叠面板推到底部（第二个会跟随） */
.rail.left > .panel.collapsible:nth-child(2) {
  margin-top: auto;
}

/* 右侧：KPI 在上，把第一个折叠面板推到底部 */
.rail.right > .panel.collapsible:nth-child(2) {
  margin-top: auto;
}

.panel {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  /* 玻璃态：统一半透明（给中央数字孪生背景留出可视空间） */
  background: rgba(6, 10, 24, 0.32);
  backdrop-filter: blur(14px);
  box-shadow: 0 0 22px rgba(0, 212, 255, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel.bottom {
  padding: 0;
}

.panel.alarms {
  flex: 1;
}

.scroll {
  overflow: auto;
  min-height: 0;
}

.more-row {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.18);
  color: rgba(232, 240, 255, 0.62);
  font-weight: 900;
  font-size: 12px;
}

.bottom-head {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.bottom-hint {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.55);
  font-weight: 900;
  white-space: nowrap;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(11, 16, 32, 0.55);
  color: rgba(232, 240, 255, 0.82);
  font-weight: 1000;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab:hover {
  border-color: rgba(0, 212, 255, 0.35);
}

.tab.active {
  background: rgba(0, 212, 255, 0.1);
  border-color: rgba(0, 212, 255, 0.45);
}

.bottom-body {
  padding: 8px 10px 10px;
  flex: 1;
  min-height: 0;
}

.tab-body {
  height: 100%;
  min-height: 0;
}

.ph {
  padding: 12px 12px 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.ph-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
}

.ph-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chev {
  font-size: 14px;
  font-weight: 1000;
  color: rgba(232, 240, 255, 0.62);
  transform: rotate(-90deg);
  transition:
    transform 0.15s ease,
    color 0.15s ease;
  user-select: none;
}

.chev.on {
  transform: rotate(0deg);
  color: rgba(0, 212, 255, 0.85);
}

.panel-body {
  padding: 10px 12px 12px;
}

.panel.collapsible .panel-body {
  max-height: 200px;
  overflow: auto;
}

.ph-title {
  font-weight: 1000;
  font-size: 14px;
  letter-spacing: 0.4px;
}

.ph-sub {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.62);
}

.alarm-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.alarm {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  padding: 10px 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  background: rgba(11, 16, 32, 0.65);
}

.alarm.critical {
  border-color: rgba(244, 63, 94, 0.35);
  box-shadow: 0 0 16px rgba(244, 63, 94, 0.12);
}
.alarm.warning {
  border-color: rgba(250, 204, 21, 0.35);
  box-shadow: 0 0 16px rgba(250, 204, 21, 0.1);
}
.alarm.info {
  border-color: rgba(0, 212, 255, 0.25);
}

.alarm-level {
  font-size: 11px;
  font-weight: 1000;
  color: rgba(232, 240, 255, 0.75);
}

.alarm-title {
  font-size: 13px;
  font-weight: 1000;
  margin-top: 2px;
}

.alarm-detail {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.68);
}

.alarm-time {
  font-size: 11px;
  color: rgba(232, 240, 255, 0.55);
  white-space: nowrap;
}

.empty-row {
  padding: 14px 10px;
  color: rgba(232, 240, 255, 0.55);
  font-weight: 800;
}

.fire,
.strategy {
  padding: 0;
}

.fire-badge {
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 1000;
  text-align: center;
  letter-spacing: 0.8px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(11, 16, 32, 0.65);
}

.kv2 {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.kv2i {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  align-items: baseline;
}

.kv2i .k {
  color: rgba(232, 240, 255, 0.62);
  font-weight: 900;
  font-size: 12px;
}

.kv2i .v {
  font-weight: 900;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.88);
}

.digest {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.18);
  background: rgba(11, 16, 32, 0.65);
  color: rgba(232, 240, 255, 0.88);
  font-weight: 900;
  font-size: 12px;
}

.cols {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.col {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 14px;
  padding: 10px;
  background: rgba(11, 16, 32, 0.55);
}

.col .h {
  font-weight: 1000;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.85);
  margin-bottom: 6px;
}

.list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(232, 240, 255, 0.78);
}

/* bottom-grid / mini-panel 已改为底部Tab布局 */

.sparks {
  padding: 10px;
  display: grid;
  gap: 10px;
}

.spark-title {
  font-size: 12px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.78);
  margin-bottom: 6px;
}

.spark-svg {
  width: 100%;
  height: 90px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(6, 10, 24, 0.35);
}

.spark-line {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.95;
  filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.22));
}

.spark-line.a {
  stroke: rgba(124, 58, 237, 0.95);
}
.spark-line.b {
  stroke: rgba(0, 212, 255, 0.95);
}
.spark-line.c {
  stroke: rgba(45, 212, 191, 0.95);
}

.heat {
  padding: 10px;
}

.heat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.cell {
  height: 56px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  position: relative;
  overflow: hidden;
  box-shadow:
    inset 0 0 16px rgba(0, 0, 0, 0.25),
    0 0 14px rgba(0, 212, 255, 0.06);
}

.cell-id {
  position: absolute;
  left: 10px;
  top: 10px;
  font-weight: 1000;
  font-size: 12px;
  color: rgba(6, 10, 24, 0.86);
}

.cell-t {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-weight: 1000;
  font-size: 12px;
  color: rgba(6, 10, 24, 0.86);
}

.heat-legend {
  margin-top: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}

.heat-legend .lg {
  font-size: 11px;
  color: rgba(232, 240, 255, 0.62);
  font-weight: 900;
}

.heat-legend .bar {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(30, 200, 255, 0.85),
    rgba(45, 212, 191, 0.85),
    rgba(250, 204, 21, 0.85),
    rgba(244, 63, 94, 0.85)
  );
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.cons {
  padding: 10px;
}

.cons-kpi {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.ck {
  flex: 1;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(6, 10, 24, 0.35);
  padding: 10px;
}

.ck .k {
  font-size: 11px;
  color: rgba(232, 240, 255, 0.62);
  font-weight: 900;
}

.ck .v {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 1000;
}

.reports {
  padding: 10px;
  display: grid;
  gap: 8px;
}

.report {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(6, 10, 24, 0.35);
  padding: 10px;
}

.rt {
  font-weight: 1000;
  font-size: 12px;
}

.rs {
  margin-top: 4px;
  font-weight: 900;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.78);
}

.ra {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(232, 240, 255, 0.55);
}

.video {
  padding: 10px;
  display: grid;
  gap: 10px;
}

.video-frame {
  height: 150px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background:
    radial-gradient(220px 140px at 30% 30%, rgba(0, 212, 255, 0.1), transparent 70%),
    linear-gradient(180deg, rgba(6, 10, 24, 0.45), rgba(11, 16, 32, 0.75));
  position: relative;
  overflow: hidden;
}

.video-frame::after {
  content: '';
  position: absolute;
  inset: -40px;
  background: linear-gradient(120deg, transparent 40%, rgba(0, 212, 255, 0.1), transparent 60%);
  transform: rotate(10deg);
  animation: sweep 4.8s ease-in-out infinite;
}

.video-overlay {
  position: absolute;
  inset: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.vo-title {
  font-weight: 1000;
  letter-spacing: 0.8px;
}

.vo-sub {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.62);
  font-weight: 900;
}

.video-ports {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.port {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(6, 10, 24, 0.35);
  font-size: 11px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.7);
}

.kpi-grid {
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kpi {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(11, 16, 32, 0.55);
  padding: 12px;
}

.kpi .k {
  font-size: 12px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.62);
}

.kpi .v {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 1000;
}

.kpi .u {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.55);
  margin-left: 4px;
}

.ccu-list {
  padding: 10px;
  display: grid;
  gap: 10px;
}

.ccu {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(11, 16, 32, 0.55);
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ccu-name {
  font-weight: 1000;
}

.ccu-sub {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.7);
}

.ccu-right {
  display: grid;
  gap: 8px;
}

.ccu-mini {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 8px;
  align-items: center;
}

.ccu-mini .k {
  font-size: 12px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.62);
}

.ccu-mini .v {
  font-size: 12px;
  font-weight: 900;
  color: rgba(232, 240, 255, 0.78);
}

.pill {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  font-size: 12px;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.chip {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  font-size: 12px;
  font-weight: 1000;
  background: rgba(11, 16, 32, 0.55);
}

.ok {
  background: rgba(45, 212, 191, 0.14);
  border-color: rgba(45, 212, 191, 0.35);
  color: rgba(232, 240, 255, 0.88);
}

.hot {
  background: rgba(244, 63, 94, 0.14);
  border-color: rgba(244, 63, 94, 0.35);
  color: rgba(232, 240, 255, 0.92);
}

.chip.normal {
  border-color: rgba(45, 212, 191, 0.35);
}
.chip.warning {
  border-color: rgba(250, 204, 21, 0.35);
}
.chip.error {
  border-color: rgba(244, 63, 94, 0.35);
}

.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.table-wrap {
  overflow-x: auto;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.tbl th {
  text-align: left;
  padding: 8px 8px;
  color: rgba(232, 240, 255, 0.62);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(6, 10, 24, 0.35);
  white-space: nowrap;
  font-weight: 1000;
}

.tbl td {
  padding: 8px 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: rgba(232, 240, 255, 0.78);
  white-space: nowrap;
  font-weight: 900;
}

.tbl.small th,
.tbl.small td {
  padding: 7px 7px;
}

.empty {
  position: relative;
  z-index: 2;
  margin-top: 14px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(6, 10, 24, 0.55);
  color: rgba(232, 240, 255, 0.7);
  font-weight: 900;
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes floaty {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-8px) scale(1.01);
  }
}

@keyframes sweep {
  0% {
    transform: translateX(-50%) rotate(10deg);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: translateX(50%) rotate(10deg);
    opacity: 0;
  }
}

@media (max-width: 1400px) {
  .layout {
    grid-template-columns: 320px minmax(520px, 1fr) 320px;
  }
}

@media (max-width: 1160px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
