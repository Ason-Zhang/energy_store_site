<template>
  <div class="ad">
    <div class="header">
      <div>
        <h1>告警详情</h1>
        <p class="sub">用于解释告警/故障出现原因（含触发时上下文快照）。</p>
      </div>
      <div class="actions">
        <router-link class="btn ghost" to="/alarm-log">返回列表</router-link>
        <button v-if="event && !event.acknowledged" class="btn" @click="ack(event.id)">确认</button>
      </div>
    </div>

    <div v-if="!event" class="panel empty">未找到该记录（可能已被清理）。</div>

    <div v-else class="panel">
      <div class="top">
        <span class="badge" :class="event.level">{{ event.level === 'error' ? '故障' : '告警' }}</span>
        <span class="src">{{ event.source }}</span>
        <span class="ts">{{ fmt(event.ts) }}</span>
        <span v-if="event.acknowledged" class="ack-badge">已确认</span>
      </div>

      <div class="msg">{{ event.message }}</div>

      <div class="section">
        <div class="st">为什么出现</div>
        <div class="why">
          <div v-if="event.level === 'warning'">
            告警通常由指标越限/一致性偏差/绝缘偏低/通信抖动等引起。以下为触发时关键指标快照：
          </div>
          <div v-else>
            故障为锁存事件，出现后需要人工复位才能恢复。以下为触发时关键指标快照：
          </div>
        </div>
      </div>

      <div class="section">
        <div class="st">触发时上下文</div>
        <div v-if="contextEntries.length === 0" class="muted">（无上下文快照）</div>
        <div v-else class="kv">
          <div v-for="[k, v] in contextEntries" :key="k" class="kv-item">
            <span class="k">{{ k }}</span>
            <span class="v mono">{{ v }}</span>
          </div>
        </div>
      </div>

      <div class="section" v-if="linkedGroupId">
        <div class="st">快速定位</div>
        <div class="links">
          <router-link class="btn" :to="`/battery-groups?focus=${linkedGroupId}`">跳转到电池组 {{ linkedGroupId }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEnergyStore } from '../stores/energyStore'

defineOptions({ name: 'AlarmDetailView' })

const route = useRoute()
const store = useEnergyStore()

const id = computed(() => String(route.params.id ?? ''))
const event = computed(() => store.getEventById(id.value))

const fmt = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const contextEntries = computed(() => {
  const ctx = event.value?.context ?? {}
  return Object.entries(ctx).map(([k, v]) => [k, String(v)] as const)
})

const linkedGroupId = computed(() => {
  const src = event.value?.source ?? ''
  const m = /^BAT-(\d+)$/.exec(src)
  return m ? Number(m[1]) : null
})

const ack = (eventId: string) => store.acknowledgeEvent(eventId)
</script>

<style scoped>
.ad {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 14px;
}
h1 {
  margin: 0 0 6px 0;
  font-size: 28px;
  color: #1a202c;
}
.sub {
  margin: 0;
  color: #718096;
  font-size: 14px;
}
.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  padding: 16px;
}
.empty {
  color: #718096;
  font-weight: 800;
}
.top {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 1000;
  border: 1px solid #e2e8f0;
  background: #f7fafc;
}
.badge.warning {
  border-color: rgba(245, 158, 11, 0.35);
  color: #92400e;
  background: rgba(245, 158, 11, 0.12);
}
.badge.error {
  border-color: rgba(239, 68, 68, 0.35);
  color: #991b1b;
  background: rgba(239, 68, 68, 0.12);
}
.src {
  font-weight: 1000;
  color: #1a202c;
}
.ts {
  color: #718096;
  font-weight: 800;
  font-size: 12px;
}
.ack-badge {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}
.msg {
  color: #2d3748;
  font-weight: 1000;
  font-size: 16px;
  margin-bottom: 14px;
}
.section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #edf2f7;
}
.st {
  font-weight: 1000;
  color: #1a202c;
  margin-bottom: 8px;
}
.why {
  color: #4a5568;
  font-weight: 700;
  line-height: 1.7;
}
.kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.kv-item {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f7fafc;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.kv-item .k {
  color: #718096;
  font-weight: 900;
}
.kv-item .v {
  color: #2d3748;
  font-weight: 1000;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
.muted {
  color: #718096;
  font-weight: 800;
}
.actions {
  display: flex;
  gap: 10px;
}
.btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.35);
  background: #0b1220;
  color: #e8f0ff;
  font-weight: 1000;
  cursor: pointer;
  text-decoration: none;
}
.btn.ghost {
  background: white;
  color: #0b1220;
}
.links {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
@media (max-width: 900px) {
  .kv {
    grid-template-columns: 1fr;
  }
}
</style>


