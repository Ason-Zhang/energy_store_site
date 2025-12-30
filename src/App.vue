<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useEnergyStore } from './stores/energyStore'

const route = useRoute()
const energyStore = useEnergyStore()

// 导航菜单项 - 顶部固定菜单
const topMenuItems = [
  { path: '/scada', name: 'Scada', label: 'SCADA' },
  { path: '/dashboard', name: 'Dashboard', label: '全站概览' },
  { path: '/communication', name: 'CommunicationStatus', label: '通信状态' },
  { path: '/data-summary', name: 'DataSummary', label: '数据汇总' },
]

// 实地站控子菜单项
const stationControlItems = [
  { path: '/front-server', name: 'FrontServer', label: '前置服务器' },
  { path: '/data-server', name: 'DataServer', label: '数据服务器' },
  { path: '/alarm-log', name: 'AlarmLog', label: '告警记录' },
  { path: '/ems', name: 'EMS', label: 'EMS' },
  { path: '/protection-safety-devices', name: 'ProtectionSafetyDevices', label: '保护/安全装置' },
  { path: '/coordination-control', name: 'CoordinationControl', label: '协控' },
  { path: '/battery-groups', name: 'BatteryGroups', label: '电池组' },
]

// 实地站控展开状态
const stationControlExpanded = ref(false)

const isRemoteExecuting = () => {
  const s = energyStore.getControlCommandsStatus
  const cmd = energyStore.getControlCommands
  const hasMode = Boolean(cmd?.agc?.enabled || cmd?.avc?.enabled || cmd?.manualPower?.enabled)
  return Boolean(s?.actor === 'remote' && hasMode)
}

const remoteExecLabel = () => {
  const s = energyStore.getControlCommandsStatus
  const u = s?.username ? String(s.username) : '远端'
  return `远端指令执行中（${u}）`
}

// 检查当前路由是否激活
const isActive = (path: string): boolean => {
  return route.path === path
}

// 检查是否在实地站控子项中
const isInStationControl = (path: string): boolean => {
  return stationControlItems.some((item) => item.path === path)
}

// 初始化数据和启动实时更新
onMounted(() => {
  energyStore.initData()
  energyStore.startRealTimeUpdate()
})

// 组件卸载时停止实时更新
onUnmounted(() => {
  energyStore.stopRealTimeUpdate()
})
</script>

<template>
  <div class="app-container">
    <!-- 左侧导航栏 -->
    <nav class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">储能监控系统</h1>
        <div v-if="isRemoteExecuting()" class="remote-flag">{{ remoteExecLabel() }}</div>
      </div>
      <div class="sidebar-menu">
        <!-- 顶部固定菜单 -->
        <router-link
          v-for="item in topMenuItems"
          :key="item.path"
          :to="item.path"
          class="menu-item"
          :class="{ active: isActive(item.path) }"
        >
          <span class="menu-icon">📊</span>
          <span class="menu-label">{{ item.label }}</span>
        </router-link>

        <!-- 实地站控可展开菜单 -->
        <div class="menu-group">
          <button
            class="menu-group-header"
            @click="stationControlExpanded = !stationControlExpanded"
            :class="{ active: isInStationControl(route.path) }"
          >
            <span class="menu-icon">🏭</span>
            <span class="menu-label">实地站控</span>
            <span class="expand-icon" :class="{ expanded: stationControlExpanded }">▾</span>
          </button>
          <div v-show="stationControlExpanded" class="menu-group-items">
            <router-link
              v-for="item in stationControlItems"
              :key="item.path"
              :to="item.path"
              class="menu-item submenu-item"
              :class="{ active: isActive(item.path) }"
            >
              <span class="menu-icon">•</span>
              <span class="menu-label">{{ item.label }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
    'Helvetica Neue', sans-serif;
  background-color: #f5f7fa;
  color: #1a202c;
  line-height: 1.6;
}
</style>

<style scoped>
.app-container {
  display: flex;
  min-height: 100vh;
}

/* 左侧导航栏样式 */
.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  color: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  z-index: 1000;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #334155;
}

.remote-flag {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.55);
  background: rgba(245, 158, 11, 0.12);
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin: 0;
}

.sidebar-menu {
  flex: 1;
  padding: 20px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  color: #cbd5e1;
  text-decoration: none;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.menu-item:hover {
  background: #334155;
  color: white;
}

.menu-item.active {
  background: #475569;
  color: white;
  border-left-color: #4299e1;
}

.menu-icon {
  font-size: 20px;
  margin-right: 12px;
}

.menu-label {
  font-size: 16px;
  font-weight: 500;
}

/* 菜单组样式 */
.menu-group {
  margin-top: 8px;
}

.menu-group-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  color: #cbd5e1;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
  position: relative;
}

.menu-group-header:hover {
  background: #334155;
  color: white;
}

.menu-group-header.active {
  background: #475569;
  color: white;
  border-left-color: #4299e1;
}

.expand-icon {
  font-size: 14px;
  font-weight: bold;
  margin-left: auto;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.menu-group-items {
  margin-left: 12px;
  border-left: 2px solid #475569;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.submenu-item {
  padding: 12px 24px 12px 36px;
  font-size: 14px;
  border-left: 4px solid transparent !important;
}

.submenu-item .menu-icon {
  font-size: 16px;
  margin-right: 10px;
  color: #94a3b8;
}

.submenu-item.active .menu-icon {
  color: #4299e1;
}

/* 主内容区域样式 */
.main-content {
  flex: 1;
  margin-left: 260px;
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style>
