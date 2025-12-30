<template>
  <div class="command-controls">
    <div class="control-tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'agc' }" @click="activeTab = 'agc'">
        AGC 控制
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'avc' }" @click="activeTab = 'avc'">
        AVC 控制
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'manual' }"
        @click="activeTab = 'manual'"
      >
        手动控制
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'params' }"
        @click="activeTab = 'params'"
      >
        系统参数
      </button>
    </div>

    <div class="control-content">
      <!-- AGC 控制面板 -->
      <div v-if="activeTab === 'agc'" class="control-panel">
        <div class="panel-header">
          <h3>自动发电控制 (AGC)</h3>
          <div class="status-indicator" :class="{ active: controlCommands.agc.enabled }">
            {{ controlCommands.agc.enabled ? '已启用' : '已禁用' }}
          </div>
        </div>

        <div class="control-form">
          <div class="form-group">
            <label class="switch-label">
              <input
                type="checkbox"
                v-model="controlCommands.agc.enabled"
                @change="
                  energyStore.setAgcCommand({
                    enabled: controlCommands.agc.enabled,
                    targetPower: controlCommands.agc.targetPower,
                    rampRate: controlCommands.agc.rampRate,
                    deadband: controlCommands.agc.deadband,
                  })
                "
              />
              <span class="switch-slider"></span>
              启用 AGC
            </label>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>目标功率 (kW)</label>
              <input
                type="number"
                :value="controlCommands.agc.targetPower"
                @input="
                  energyStore.setAgcCommand({
                    enabled: controlCommands.agc.enabled,
                    targetPower: parseFloat(($event.target as HTMLInputElement).value) || 0,
                  })
                "
                :min="-systemParams.maxDischargePower"
                :max="systemParams.maxChargePower"
                step="10"
              />
            </div>

            <div class="form-group">
              <label>爬坡率 (kW/min)</label>
              <input
                type="number"
                :value="controlCommands.agc.rampRate"
                @input="
                  energyStore.setAgcCommand({
                    enabled: controlCommands.agc.enabled,
                    rampRate: parseFloat(($event.target as HTMLInputElement).value) || 10,
                  })
                "
                min="1"
                max="100"
                step="5"
              />
            </div>

            <div class="form-group">
              <label>死区带宽 (kW)</label>
              <input
                type="number"
                :value="controlCommands.agc.deadband"
                @input="
                  energyStore.setAgcCommand({
                    enabled: controlCommands.agc.enabled,
                    deadband: parseFloat(($event.target as HTMLInputElement).value) || 5,
                  })
                "
                min="0"
                max="50"
                step="1"
              />
            </div>
          </div>

          <div class="current-status">
            <div class="status-item">
              <span class="label">当前功率:</span>
              <span class="value"
                >{{
                  Math.trunc((telemetryData.averageVoltage * telemetryData.totalCurrent) / 1000)
                }}
                kW</span
              >
            </div>
            <div class="status-item">
              <span class="label">目标偏差:</span>
              <span
                class="value"
                :class="{
                  positive: Math.abs(currentPowerDeviation) < controlCommands.agc.deadband,
                  warning: Math.abs(currentPowerDeviation) >= controlCommands.agc.deadband,
                }"
              >
                {{ currentPowerDeviation.toFixed(1) }} kW
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- AVC 控制面板 -->
      <div v-else-if="activeTab === 'avc'" class="control-panel">
        <div class="panel-header">
          <h3>自动电压控制 (AVC)</h3>
          <div class="status-indicator" :class="{ active: controlCommands.avc.enabled }">
            {{ controlCommands.avc.enabled ? '已启用' : '已禁用' }}
          </div>
        </div>

        <div class="control-form">
          <div class="form-group">
            <label class="switch-label">
              <input
                type="checkbox"
                v-model="controlCommands.avc.enabled"
                @change="
                  energyStore.setAvcCommand({
                    enabled: controlCommands.avc.enabled,
                    targetVoltage: controlCommands.avc.targetVoltage,
                    voltageRange: controlCommands.avc.voltageRange,
                  })
                "
              />
              <span class="switch-slider"></span>
              启用 AVC
            </label>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>目标电压 (V)</label>
              <input
                type="number"
                :value="controlCommands.avc.targetVoltage"
                @input="
                  energyStore.setAvcCommand({
                    enabled: controlCommands.avc.enabled,
                    targetVoltage: parseFloat(($event.target as HTMLInputElement).value) || 400,
                  })
                "
                min="300"
                max="500"
                step="5"
              />
            </div>

            <div class="form-group">
              <label>电压范围 (V)</label>
              <div class="range-inputs">
                <input
                  type="number"
                  :value="controlCommands.avc.voltageRange.min"
                  @input="
                    updateAvcVoltageRange(
                      parseFloat(($event.target as HTMLInputElement).value) || 380,
                      controlCommands.avc.voltageRange.max,
                    )
                  "
                  min="300"
                  max="450"
                  step="5"
                />
                <span>-</span>
                <input
                  type="number"
                  :value="controlCommands.avc.voltageRange.max"
                  @input="
                    updateAvcVoltageRange(
                      controlCommands.avc.voltageRange.min,
                      parseFloat(($event.target as HTMLInputElement).value) || 420,
                    )
                  "
                  min="350"
                  max="500"
                  step="5"
                />
              </div>
            </div>
          </div>

          <div class="current-status">
            <div class="status-item">
              <span class="label">当前电压:</span>
              <span class="value">{{ telemetryData.averageVoltage.toFixed(1) }} V</span>
            </div>
            <div class="status-item">
              <span class="label">目标偏差:</span>
              <span
                class="value"
                :class="{
                  positive: Math.abs(currentVoltageDeviation) <= 2,
                  warning: Math.abs(currentVoltageDeviation) > 2,
                }"
              >
                {{ currentVoltageDeviation.toFixed(1) }} V
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 手动控制面板 -->
      <div v-else-if="activeTab === 'manual'" class="control-panel">
        <div class="panel-header">
          <h3>手动功率控制</h3>
          <div class="status-indicator" :class="{ active: controlCommands.manualPower.enabled }">
            {{ controlCommands.manualPower.enabled ? '已启用' : '已禁用' }}
          </div>
        </div>

        <div class="control-form">
          <div class="form-group">
            <label class="switch-label">
              <input
                type="checkbox"
                v-model="controlCommands.manualPower.enabled"
                @change="
                  energyStore.setManualPowerCommand({
                    enabled: controlCommands.manualPower.enabled,
                    targetPower: controlCommands.manualPower.targetPower,
                  })
                "
              />
              <span class="switch-slider"></span>
              启用手动控制
            </label>
          </div>

          <div class="form-group">
            <label>目标功率 (kW)</label>
            <div class="power-slider">
              <input
                type="range"
                :value="controlCommands.manualPower.targetPower"
                @input="
                  energyStore.setManualPowerCommand({
                    enabled: controlCommands.manualPower.enabled,
                    targetPower: parseFloat(($event.target as HTMLInputElement).value),
                  })
                "
                :min="-systemParams.maxDischargePower"
                :max="systemParams.maxChargePower"
                step="10"
              />
              <div class="slider-value">{{ controlCommands.manualPower.targetPower }} kW</div>
            </div>
          </div>

          <div class="quick-buttons">
            <button class="quick-btn" @click="setQuickPower(0)">待机</button>
            <button class="quick-btn" @click="setQuickPower(200)">200kW</button>
            <button class="quick-btn" @click="setQuickPower(400)">400kW</button>
            <button class="quick-btn" @click="setQuickPower(600)">600kW</button>
            <button class="quick-btn" @click="setQuickPower(-200)">-200kW</button>
            <button class="quick-btn" @click="setQuickPower(-400)">-400kW</button>
          </div>
        </div>
      </div>

      <!-- 系统参数面板 -->
      <div v-else-if="activeTab === 'params'" class="control-panel">
        <div class="panel-header">
          <h3>系统参数配置</h3>
        </div>

        <div class="control-form">
          <div class="form-row">
            <div class="form-group">
              <label>最大充电功率 (kW)</label>
              <input
                type="number"
                :value="systemParams.maxChargePower"
                @input="
                  updateSystemParams({
                    maxChargePower: parseFloat(($event.target as HTMLInputElement).value) || 800,
                  })
                "
                min="100"
                max="2000"
                step="50"
              />
            </div>

            <div class="form-group">
              <label>最大放电功率 (kW)</label>
              <input
                type="number"
                :value="systemParams.maxDischargePower"
                @input="
                  updateSystemParams({
                    maxDischargePower: parseFloat(($event.target as HTMLInputElement).value) || 800,
                  })
                "
                min="100"
                max="2000"
                step="50"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>系统效率 (%)</label>
              <input
                type="number"
                :value="systemParams.efficiency"
                @input="
                  updateSystemParams({
                    efficiency: parseFloat(($event.target as HTMLInputElement).value) || 95,
                  })
                "
                min="80"
                max="100"
                step="0.1"
              />
            </div>

            <div class="form-group">
              <label>响应时间 (秒)</label>
              <input
                type="number"
                :value="systemParams.responseTime"
                @input="
                  updateSystemParams({
                    responseTime: parseFloat(($event.target as HTMLInputElement).value) || 5,
                  })
                "
                min="1"
                max="30"
                step="0.5"
              />
            </div>

            <div class="form-group">
              <label>安全裕度 (%)</label>
              <input
                type="number"
                :value="systemParams.safetyMargin"
                @input="
                  updateSystemParams({
                    safetyMargin: parseFloat(($event.target as HTMLInputElement).value) || 10,
                  })
                "
                min="0"
                max="50"
                step="1"
              />
            </div>
          </div>

          <div class="param-actions">
            <button class="reset-btn" @click="resetAllCommands">重置所有控制</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEnergyStore } from '../stores/energyStore'

const energyStore = useEnergyStore()

const activeTab = ref<'agc' | 'avc' | 'manual' | 'params'>('agc')

const controlCommands = computed(() => energyStore.getControlCommands)
const systemParams = computed(() => energyStore.getSystemParams)
const telemetryData = computed(() => energyStore.getTelemetryData)

const currentPowerDeviation = computed(() => {
  const currentPower =
    (telemetryData.value.averageVoltage * telemetryData.value.totalCurrent) / 1000
  return currentPower - controlCommands.value.agc.targetPower
})

const currentVoltageDeviation = computed(() => {
  return telemetryData.value.averageVoltage - controlCommands.value.avc.targetVoltage
})

const updateAvcVoltageRange = (min: number, max: number) => {
  energyStore.setAvcCommand({
    enabled: controlCommands.value.avc.enabled,
    voltageRange: { min, max },
  })
}

const setQuickPower = (power: number) => {
  energyStore.setManualPowerCommand({ enabled: true, targetPower: power })
}

// 系统参数更新
const updateSystemParams = (params: Partial<typeof energyStore.systemParams>) => {
  energyStore.updateSystemParams(params)
}

// 重置所有控制
const resetAllCommands = () => {
  energyStore.resetAllCommands()
}
</script>

<style scoped>
.command-controls {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.control-tabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.tab-btn {
  flex: 1;
  padding: 16px 20px;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

.tab-btn.active {
  background: white;
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.control-content {
  padding: 24px;
}

.control-panel {
  min-height: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.status-indicator {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #e2e8f0;
  color: #64748b;
}

.status-indicator.active {
  background: #dbeafe;
  color: #1d4ed8;
}

.control-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.switch-label input[type='checkbox'] {
  display: none;
}

.switch-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #e2e8f0;
  border-radius: 12px;
  transition: background-color 0.2s ease;
}

.switch-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.switch-label input:checked + .switch-slider {
  background: #2563eb;
}

.switch-label input:checked + .switch-slider::before {
  transform: translateX(20px);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-inputs input {
  flex: 1;
}

.power-slider {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.power-slider input[type='range'] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  appearance: none;
}

.power-slider input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.slider-value {
  align-self: center;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 8px;
}

.quick-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.quick-btn {
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.quick-btn:active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

.current-status {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-item .label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.status-item .value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.status-item .value.positive {
  color: #059669;
}

.status-item .value.warning {
  color: #d97706;
}

.param-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.reset-btn {
  padding: 10px 20px;
  border: 1px solid #ef4444;
  border-radius: 8px;
  background: white;
  color: #ef4444;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: #fef2f2;
  border-color: #dc2626;
}
</style>
