<template>
  <div class="status-indicator">
    <div class="status-item">
      <span class="status-label">系统状态</span>
      <span class="status-badge" :class="systemStatus.status">
        {{ systemStatus.status === 'normal' ? '正常' : systemStatus.status === 'warning' ? '警告' : '异常' }}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">负载</span>
      <span class="status-value">{{ systemStatus.load }}%</span>
    </div>
    <div class="status-item">
      <span class="status-label">功率</span>
      <span class="status-value">{{ systemStatus.totalPower }}kW</span>
    </div>
    <div class="status-item">
      <span class="status-label">当前时间</span>
      <span class="status-value">{{ currentTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useEnergyStore } from '../stores/energyStore'

const energyStore = useEnergyStore()
const currentTime = ref('')
let timeInterval: ReturnType<typeof setInterval> | null = null

const systemStatus = computed(() => energyStore.systemStatus)

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})
</script>

<style scoped>
.status-indicator {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.normal {
  background: #c6f6d5;
  color: #22543d;
}

.status-badge.warning {
  background: #fef5e7;
  color: #744210;
}

.status-badge.error {
  background: #fed7d7;
  color: #742a2a;
}

.status-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}
</style>