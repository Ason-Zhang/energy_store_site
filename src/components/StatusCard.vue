<template>
  <div class="status-card" :class="status">
    <div class="card-header">
      <h3>{{ title }}</h3>
      <div class="status-indicator" :class="status"></div>
    </div>
    <div class="card-value">
      {{ value }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  value: string | number
  status: 'normal' | 'warning' | 'error'
}

defineProps<Props>()
</script>

<style scoped>
.status-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.status-card.normal {
  border-left-color: #48bb78;
}

.status-card.warning {
  border-left-color: #ed8936;
}

.status-card.error {
  border-left-color: #f56565;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  font-size: 16px;
  color: #718096;
  font-weight: 500;
  margin: 0;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-indicator.normal {
  background: #48bb78;
}

.status-indicator.warning {
  background: #ed8936;
}

.status-indicator.error {
  background: #f56565;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  color: #2d3748;
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
</style>