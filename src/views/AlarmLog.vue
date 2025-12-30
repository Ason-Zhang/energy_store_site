<template>
  <div class="al">
    <div class="header">
      <div>
        <h1>告警记录</h1>
        <p class="sub">记录全站告警/故障事件（低概率触发），支持确认与清理已确认记录。</p>
      </div>
      <div class="actions">
        <button class="btn ghost" @click="ackAll">一键确认</button>
        <button class="btn ghost" @click="clearAcknowledged">清理已确认</button>
      </div>
    </div>

    <div class="filters">
      <button class="chip" :class="{ on: level === 'all' }" @click="level = 'all'">全部</button>
      <button class="chip" :class="{ on: level === 'warning' }" @click="level = 'warning'">告警</button>
      <button class="chip" :class="{ on: level === 'error' }" @click="level = 'error'">故障</button>
      <input v-model="keyword" class="search" placeholder="搜索：来源/内容…" />
    </div>

    <div class="panel">
      <div v-if="rows.length === 0" class="empty">暂无记录</div>
      <div v-else class="list">
        <router-link
          v-for="e in paginatedRows"
          :key="e.id"
          class="row link"
          :class="[e.level, e.acknowledged ? 'ack' : '']"
          :to="`/alarm-log/${e.id}`"
        >
          <div class="left">
            <div class="top">
              <span class="badge" :class="e.level">{{ e.level === 'error' ? '故障' : '告警' }}</span>
              <span class="src">{{ e.source }}</span>
              <span class="ts">{{ fmt(e.ts) }}</span>
              <span v-if="e.acknowledged" class="ack-badge">已确认</span>
            </div>
            <div class="msg">{{ e.message }}</div>
          </div>
          <div class="right">
            <button v-if="!e.acknowledged" class="btn" @click.stop.prevent="ack(e.id)">确认</button>
          </div>
        </router-link>
      </div>
    </div>

    <div v-if="rows.length > 0" class="pagination">
      <div class="page-size-selector">
        <span class="label">每页显示：</span>
        <select v-model.number="pageSize" class="page-size-select">
          <option :value="10">10 条</option>
          <option :value="20">20 条</option>
          <option :value="50">50 条</option>
          <option :value="100">100 条</option>
        </select>
      </div>
      <div class="page-info">
        共 {{ rows.length }} 条，第 {{ currentPage }} / {{ totalPages }} 页
      </div>
      <div class="page-controls">
        <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(1)">首页</button>
        <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">上一页</button>
        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-btn"
          :class="{ active: page === currentPage }"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">下一页</button>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(totalPages)">末页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEnergyStore } from '../stores/energyStore'

defineOptions({ name: 'AlarmLogView' })

const store = useEnergyStore()
const level = ref<'all' | 'warning' | 'error'>('all')
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const fmt = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.getEventLog
    .filter((e) => (level.value === 'all' ? true : e.level === level.value))
    .filter((e) => (!kw ? true : `${e.source} ${e.message}`.toLowerCase().includes(kw)))
})

// 总页数
const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize.value)))

// 当前页的数据
const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return rows.value.slice(start, end)
})

// 可见页码（显示当前页前后各2页）
const visiblePages = computed(() => {
  const pages: number[] = []
  const max = totalPages.value
  const current = currentPage.value
  
  let start = Math.max(1, current - 2)
  let end = Math.min(max, current + 2)
  
  // 确保始终显示5个页码（如果总页数>=5）
  if (end - start < 4) {
    if (start === 1) {
      end = Math.min(max, start + 4)
    } else if (end === max) {
      start = Math.max(1, end - 4)
    }
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// 跳转到指定页
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 监听筛选条件变化，重置到第一页
watch([level, keyword, pageSize], () => {
  currentPage.value = 1
})

const ack = (id: string) => store.acknowledgeEvent(id)
const ackAll = () => store.acknowledgeAllEvents()
const clearAcknowledged = () => store.clearAcknowledgedEvents()
</script>

<style scoped>
.al {
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
.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.chip {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #f7fafc;
  font-weight: 900;
  cursor: pointer;
}
.chip.on {
  background: #0b1220;
  color: #e8f0ff;
  border-color: rgba(0, 212, 255, 0.35);
}
.search {
  flex: 1;
  min-width: 220px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  font-weight: 800;
  color: #2d3748;
}
.panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.empty {
  padding: 18px;
  color: #718096;
  font-weight: 800;
}
.list {
  display: grid;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid #edf2f7;
  align-items: center;
}
.row.link {
  text-decoration: none;
  color: inherit;
}
.row.link:hover {
  background: rgba(0, 0, 0, 0.02);
}
.row:last-child {
  border-bottom: 0;
}
.row.warning {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.06), transparent);
}
.row.error {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.06), transparent);
}
.row.ack {
  opacity: 0.75;
}
.top {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
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
  font-weight: 800;
}
.btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.35);
  background: #0b1220;
  color: #e8f0ff;
  font-weight: 1000;
  cursor: pointer;
}
.btn.ghost {
  background: white;
  color: #0b1220;
}
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-size-selector .label {
  color: #718096;
  font-weight: 800;
  font-size: 14px;
}
.page-size-select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  font-weight: 900;
  color: #2d3748;
  cursor: pointer;
}
.page-info {
  color: #718096;
  font-weight: 800;
  font-size: 14px;
}
.page-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}
.page-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #2d3748;
  font-weight: 900;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  background: #f7fafc;
  border-color: #cbd5e1;
}
.page-btn.active {
  background: #0b1220;
  color: #e8f0ff;
  border-color: rgba(0, 212, 255, 0.35);
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
@media (max-width: 768px) {
  .pagination {
    justify-content: center;
  }
  .page-info {
    width: 100%;
    text-align: center;
  }
}
</style>


