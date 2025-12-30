<template>
  <div class="communication-status">
    <h1>设备通信状态</h1>

    <div class="device-selection">
      <h2>选择设备</h2>
      <div class="device-tabs">
        <button
          class="device-tab"
          :class="{ active: selectedDevice?.type === 'frontServer' }"
          @click="selectDevice({ id: 1, type: 'frontServer', name: '前置服务器' })"
        >
          前置服务器
        </button>
        <button
          class="device-tab"
          :class="{ active: selectedDevice?.type === 'ems' }"
          @click="selectDevice({ id: 'ems', type: 'ems', name: 'EMS' })"
        >
          EMS
        </button>
        <button
          class="device-tab"
          :class="{ active: selectedDevice?.type === 'remote' }"
          @click="selectDevice({ id: 1, type: 'remote', name: '远端主站' })"
        >
          远端主站
        </button>
        <div class="tab-group">
          <span class="tab-label">CCU</span>
          <button
            v-for="i in ccuCount"
            :key="'ccu-' + i"
            class="device-tab small"
            :class="{ active: selectedDevice?.type === 'ccu' && selectedDevice?.id === i }"
            @click="selectDevice({ id: i, type: 'ccu', name: 'CCU ' + i })"
          >
            {{ i }}
          </button>
        </div>
        <div class="tab-group">
          <span class="tab-label">PCS</span>
          <button
            v-for="i in pcsCount"
            :key="'pcs-' + i"
            class="device-tab small"
            :class="{ active: selectedDevice?.type === 'pcs' && selectedDevice?.id === i }"
            @click="selectDevice({ id: i, type: 'pcs', name: 'PCS ' + i })"
          >
            {{ i }}
          </button>
        </div>
        <div class="tab-group">
          <span class="tab-label">BMS</span>
          <button
            v-for="i in bmsCount"
            :key="'bms-' + i"
            class="device-tab small"
            :class="{ active: selectedDevice?.type === 'bms' && selectedDevice?.id === i }"
            @click="selectDevice({ id: i, type: 'bms', name: 'BMS ' + i })"
          >
            {{ i }}
          </button>
        </div>
        <div class="tab-group">
          <span class="tab-label">Battery</span>
          <button
            v-for="i in batteryCount"
            :key="'battery-' + i"
            class="device-tab small"
            :class="{ active: selectedDevice?.type === 'battery' && selectedDevice?.id === i }"
            @click="selectDevice({ id: i, type: 'battery', name: '电池仓 ' + i })"
          >
            {{ i }}
          </button>
        </div>
      </div>
    </div>

    <div class="communication-detail" v-if="selectedDevice">
      <h2>{{ selectedDevice.name }} 通信信息</h2>

      <div class="device-info">
        <div class="info-item">
          <label>设备类型</label>
          <span>{{ selectedDevice.type.toUpperCase() }}</span>
        </div>
        <div class="info-item">
          <label>通信状态</label>
          <span :class="['status-badge', communicationData.status]">
            {{ communicationData.status === 'normal' ? '正常' : '异常' }}
          </span>
        </div>
        <div class="info-item">
          <label>最后通信时间</label>
          <span>{{ communicationData.lastCommTime }}</span>
        </div>
        <div class="info-item">
          <label>通信协议</label>
          <span>Modbus TCP</span>
        </div>
      </div>

      <div class="modbus-info">
        <h3>Modbus 通信包信息</h3>
        <div class="modbus-table-container">
          <table class="modbus-table">
            <thead>
              <tr>
                <th>时间戳</th>
                <th>功能码</th>
                <th>寄存器地址</th>
                <th>数据长度</th>
                <th>数据值</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(packet, index) in communicationData.modbusPackets" :key="index">
                <td>{{ packet.timestamp }}</td>
                <td>{{ packet.functionCode }}</td>
                <td>{{ packet.registerAddr }}</td>
                <td>{{ packet.dataLength }}</td>
                <td>{{ packet.dataValue }}</td>
                <td>
                  <span :class="['status-dot', packet.status]"></span>
                  {{ packet.status }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="frames-info">
        <h3>协议帧流水（真实链路）</h3>
        <div class="frames-pager">
          <div class="pager-left">
            <span class="pager-label">每页</span>
            <select v-model.number="framesPageSize" class="pager-select">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
            <span class="pager-label">条</span>
          </div>

          <div class="pager-right">
            <span class="pager-meta">{{ framesPagerMeta }}</span>
            <button class="pager-btn" :disabled="framesPage <= 1" @click="framesPage--">
              上一页
            </button>
            <button
              class="pager-btn"
              :disabled="framesPage >= framesTotalPages"
              @click="framesPage++"
            >
              下一页
            </button>
          </div>
        </div>
        <div class="frames-table-container">
          <table class="frames-table">
            <thead>
              <tr>
                <th>时间戳</th>
                <th>协议</th>
                <th>方向</th>
                <th>From</th>
                <th>To</th>
                <th>延迟</th>
                <th>字节</th>
                <th>状态</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(f, idx) in pagedFrames" :key="idx">
                <td>{{ f.timestamp }}</td>
                <td>{{ f.protocol }}</td>
                <td>{{ f.direction }}</td>
                <td>{{ f.from }}</td>
                <td>{{ f.to }}</td>
                <td>{{ f.latencyMs }}ms</td>
                <td>{{ f.bytes }}</td>
                <td>
                  <span :class="['status-dot', f.status]"></span>
                  {{ f.status }}
                </td>
                <td class="mono" :title="f.payloadHex">{{ f.summary }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="interaction-graph">
        <h3>通信拓扑状态图</h3>
        <div class="graph-container">
          <!-- SVG 连接线 -->
          <div class="topology-wrap">
            <svg class="topology" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid meet">
              <line
                v-for="e in topologyEdges"
                :key="e.key"
                :x1="e.x1"
                :y1="e.y1"
                :x2="e.x2"
                :y2="e.y2"
                :class="['connection-line', e.status]"
              />

              <g
                v-for="n in topologyNodes"
                :key="n.key"
                class="topology-node"
                :class="[{ selected: selectedDeviceKey === n.key, clickable: true }, n.status]"
                @click="selectDevice(n.device)"
              >
                <circle :cx="n.x" :cy="n.y" :r="n.r" />
                <text :x="n.x" :y="n.y" text-anchor="middle" dominant-baseline="central">
                  {{ n.label }}
                </text>
                <title>{{ n.title }}</title>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div class="interaction-graph">
        <h3>控制拓扑状态图</h3>
        <div class="graph-container">
          <div class="topology-wrap">
            <svg class="topology" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid meet">
              <line
                v-for="e in controlTopologyEdges"
                :key="e.key"
                :x1="e.x1"
                :y1="e.y1"
                :x2="e.x2"
                :y2="e.y2"
                :class="['connection-line', 'control-line', e.status]"
              />

              <g
                v-for="n in controlTopologyNodes"
                :key="n.key"
                class="topology-node"
                :class="[
                  {
                    selected: !!n.device && selectedDeviceKey === n.key,
                    clickable:
                      !!n.device ||
                      n.key === 'pcs-group' ||
                      n.key === 'bms-group' ||
                      n.key === 'battery-group' ||
                      n.key.startsWith('ccu-'),
                  },
                  n.status,
                ]"
                @click="n.device ? selectDevice(n.device) : selectControlNode(n.key)"
              >
                <circle :cx="n.x" :cy="n.y" :r="n.r" />
                <text :x="n.x" :y="n.y" text-anchor="middle" dominant-baseline="central">
                  {{ n.label }}
                </text>
                <title>{{ n.title }}</title>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEnergyStore } from '../stores/energyStore'
import type { CoordinationUnit, Device, CommunicationData } from '../services/mockDataService'

const energyStore = useEnergyStore()
const selectedDevice = ref<Device | null>(null)

const bmsCount = computed(() => Math.max(1, energyStore.getDeviceCounts?.bms ?? 10))
const batteryCount = computed(() => Math.max(1, energyStore.getDeviceCounts?.batteryBins ?? 10))
const ccuCount = computed(() => 3)
const pcsCount = computed(() =>
  Math.max(
    1,
    (energyStore.getDeviceCounts as unknown as { pcs?: number } | undefined)?.pcs ?? bmsCount.value,
  ),
)

const devices = computed<Device[]>(() => {
  const out: Device[] = [
    { id: 1, type: 'frontServer', name: '前置服务器' },
    { id: 'ems', type: 'ems', name: 'EMS' },
    { id: 1, type: 'remote', name: '远端主站' },
  ]
  for (let i = 1; i <= pcsCount.value; i++) out.push({ id: i, type: 'pcs', name: `PCS ${i}` })
  for (let i = 1; i <= bmsCount.value; i++) out.push({ id: i, type: 'bms', name: `BMS ${i}` })
  for (let i = 1; i <= batteryCount.value; i++)
    out.push({ id: i, type: 'battery', name: `电池仓 ${i}` })
  return out
})

const selectedDeviceKey = computed(() =>
  selectedDevice.value ? `${selectedDevice.value.type}-${selectedDevice.value.id}` : null,
)

const communicationData = computed<CommunicationData>(() => {
  if (!selectedDevice.value) {
    // 返回一个默认的CommunicationData对象，避免类型错误
    return {
      status: 'normal',
      lastCommTime: '',
      modbusPackets: [],
      connectedDevices: [],
      protocolFrames: [],
    }
  }
  return energyStore.getCommunicationData(selectedDevice.value)
})

const framesPage = ref(1)
const framesPageSize = ref(10)

const allFrames = computed(() => communicationData.value.protocolFrames ?? [])

const framesTotalPages = computed(() =>
  Math.max(1, Math.ceil(allFrames.value.length / Math.max(1, framesPageSize.value))),
)

const framesPagerMeta = computed(() => {
  const total = allFrames.value.length
  const page = framesPage.value
  const size = Math.max(1, framesPageSize.value)
  const start = total === 0 ? 0 : (page - 1) * size + 1
  const end = Math.min(total, page * size)
  return `${start}-${end} / ${total}`
})

const pagedFrames = computed(() => {
  const size = Math.max(1, framesPageSize.value)
  const start = (framesPage.value - 1) * size
  return allFrames.value.slice(start, start + size)
})

const selectDevice = (device: Device) => {
  selectedDevice.value = device
}

watch(
  () => selectedDeviceKey.value,
  () => {
    framesPage.value = 1
  },
)

watch(
  () => framesPageSize.value,
  () => {
    framesPage.value = 1
  },
)

watch(
  () => framesTotalPages.value,
  (tp) => {
    if (framesPage.value > tp) framesPage.value = tp
  },
)

const statusText = (s: 'normal' | 'warning' | 'error' | 'none') => {
  if (s === 'normal') return '正常'
  if (s === 'warning') return '告警'
  if (s === 'error') return '故障'
  return '无连接'
}

const parseNameToKey = (name: string): string | null => {
  const n = String(name ?? '').trim()
  if (!n) return null
  if (n.toUpperCase() === 'EMS') return 'ems-ems'

  if (n === '前置服务器') return 'frontServer-1'
  if (n === '远端主站' || n === '远端') return 'remote-1'

  const pcs = n.match(/^PCS\s*(\d+)$/i)
  if (pcs) return `pcs-${Number(pcs[1])}`

  const ccu = n.match(/^CCU\s*(\d+)$/i)
  if (ccu) return `ccu-${Number(ccu[1])}`

  const bms = n.match(/^BMS\s*(\d+)$/i)
  if (bms) return `bms-${Number(bms[1])}`

  const batCn = n.match(/^电池仓\s*(\d+)$/)
  if (batCn) return `battery-${Number(batCn[1])}`

  const batEn = n.match(/^Battery\s*(\d+)$/i)
  if (batEn) return `battery-${Number(batEn[1])}`

  return null
}

const rank = (s: 'normal' | 'warning' | 'error' | 'none') => {
  if (s === 'error') return 3
  if (s === 'warning') return 2
  if (s === 'normal') return 1
  return 0
}

const deviceFromKey = (key: string): Device => {
  const [t, raw] = key.split('-')
  const type = t as Device['type']
  if (type === 'ems') return { id: 'ems', type: 'ems', name: 'EMS' }
  if (type === 'frontServer')
    return { id: Number(raw) || 1, type: 'frontServer', name: '前置服务器' }
  if (type === 'remote') return { id: Number(raw) || 1, type: 'remote', name: '远端主站' }
  if (type === 'ccu') return { id: Number(raw), type: 'ccu', name: `CCU ${raw}` }
  if (type === 'pcs') return { id: Number(raw), type: 'pcs', name: `PCS ${raw}` }
  if (type === 'bms') return { id: Number(raw), type: 'bms', name: `BMS ${raw}` }
  return { id: Number(raw), type: 'battery', name: `电池仓 ${raw}` }
}

const getLinkStatusDirected = (
  fromKey: string,
  toKey: string,
): 'normal' | 'warning' | 'error' | 'none' => {
  const from = deviceFromKey(fromKey)
  const cd = energyStore.getCommunicationData(from)
  const found = cd.connectedDevices.find((x) => parseNameToKey(x.name) === toKey)
  return (found?.status as 'normal' | 'warning' | 'error' | undefined) ?? 'none'
}

const getPairStatus = (a: string, b: string): 'normal' | 'warning' | 'error' | 'none' => {
  if (a === b) return 'none'
  const ab = getLinkStatusDirected(a, b)
  const ba = getLinkStatusDirected(b, a)
  return rank(ab) >= rank(ba) ? ab : ba
}

const selectControlNode = (key: string) => {
  if (key === 'pcs-group') {
    const id = Math.max(1, pcsCount.value > 0 ? 1 : 1)
    selectDevice({ id, type: 'pcs', name: `PCS ${id}` })
    return
  }
  if (key === 'bms-group') {
    const id = Math.max(1, bmsCount.value > 0 ? 1 : 1)
    selectDevice({ id, type: 'bms', name: `BMS ${id}` })
    return
  }
  if (key === 'battery-group') {
    const id = Math.max(1, batteryCount.value > 0 ? 1 : 1)
    selectDevice({ id, type: 'battery', name: `电池仓 ${id}` })
    return
  }
  if (key.startsWith('ccu-')) {
    // CCU 是逻辑节点，暂时跳转到 EMS（决策中心）
    selectDevice({ id: 'ems', type: 'ems', name: 'EMS' })
    return
  }
}

type TopologyNode = {
  key: string
  device: Device
  x: number
  y: number
  r: number
  label: string
  title: string
  status: 'normal' | 'warning' | 'error'
}

type TopologyEdge = {
  key: string
  a: string
  b: string
  x1: number
  y1: number
  x2: number
  y2: number
  status: 'normal' | 'warning' | 'error' | 'none'
}

type ControlTopologyNode = {
  key: string
  device?: Device
  x: number
  y: number
  r: number
  label: string
  title: string
  status: 'normal' | 'warning' | 'error'
}

type ControlTopologyEdge = {
  key: string
  a: string
  b: string
  x1: number
  y1: number
  x2: number
  y2: number
  status: 'normal' | 'warning' | 'error' | 'none'
}

// 计算连接设备的位置，使其围绕中心节点均匀分布
const getNodePosition = (index: number, total: number) => {
  const angle = (index / total) * 2 * Math.PI
  const radius = 150 // 围绕中心节点的半径
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius

  return {
    left: `calc(50% + ${x}px - 40px)`, // 40px是节点宽度的一半
    top: `calc(50% + ${y}px - 40px)`, // 40px是节点高度的一半
  }
}

void getNodePosition

const topologyNodes = computed<TopologyNode[]>(() => {
  const cx = 500
  const cy = 320

  const fs = devices.value.find((d) => d.type === 'frontServer') ?? {
    id: 1,
    type: 'frontServer',
    name: '前置服务器',
  }
  const ems = devices.value.find((d) => d.type === 'ems') ?? { id: 'ems', type: 'ems', name: 'EMS' }
  const remote = devices.value.find((d) => d.type === 'remote') ?? {
    id: 1,
    type: 'remote',
    name: '远端主站',
  }
  const pcs = devices.value.filter((d) => d.type === 'pcs')
  const bms = devices.value.filter((d) => d.type === 'bms')
  const bat = devices.value.filter((d) => d.type === 'battery')

  const out: TopologyNode[] = []

  const fsComm = energyStore.getCommunicationData(fs)
  out.push({
    key: `frontServer-${fs.id}`,
    device: fs,
    x: cx,
    y: cy,
    r: 60,
    label: 'FS',
    title: `${fs.name}\n状态: ${statusText(fsComm.status)}\n最后通信: ${fsComm.lastCommTime}`,
    status: fsComm.status,
  })

  const emsComm = energyStore.getCommunicationData(ems)
  out.push({
    key: `ems-ems`,
    device: ems,
    x: cx,
    y: 90,
    r: 55,
    label: 'EMS',
    title: `EMS\n状态: ${statusText(emsComm.status)}\n最后通信: ${emsComm.lastCommTime}`,
    status: emsComm.status,
  })

  const remoteComm = energyStore.getCommunicationData(remote)
  out.push({
    key: `remote-${remote.id}`,
    device: remote,
    x: 890,
    y: cy,
    r: 50,
    label: 'REMOTE',
    title: `${remote.name}\n状态: ${statusText(remoteComm.status)}\n最后通信: ${remoteComm.lastCommTime}`,
    status: remoteComm.status,
  })

  const ringPcs = 150
  const ringBms = 230
  const ringBat = 320

  {
    let idx = 0
    for (const d of pcs) {
      const angle = (idx / Math.max(1, pcs.length)) * 2 * Math.PI + Math.PI / 6
      idx++
      const x = cx + Math.cos(angle) * ringPcs
      const y = cy + Math.sin(angle) * ringPcs
      const cd = energyStore.getCommunicationData(d)
      out.push({
        key: `${d.type}-${d.id}`,
        device: d,
        x,
        y,
        r: 34,
        label: `PCS ${d.id}`,
        title: `${d.name}\n状态: ${statusText(cd.status)}\n最后通信: ${cd.lastCommTime}`,
        status: cd.status,
      })
    }
  }

  {
    let idx = 0
    for (const d of bms) {
      const angle = (idx / Math.max(1, bms.length)) * 2 * Math.PI - Math.PI / 2
      idx++
      const x = cx + Math.cos(angle) * ringBms
      const y = cy + Math.sin(angle) * ringBms
      const cd = energyStore.getCommunicationData(d)
      out.push({
        key: `${d.type}-${d.id}`,
        device: d,
        x,
        y,
        r: 32,
        label: `BMS ${d.id}`,
        title: `${d.name}\n状态: ${statusText(cd.status)}\n最后通信: ${cd.lastCommTime}`,
        status: cd.status,
      })
    }
  }

  {
    let idx = 0
    for (const d of bat) {
      const angle = (idx / Math.max(1, bat.length)) * 2 * Math.PI - Math.PI / 2
      idx++
      const x = cx + Math.cos(angle) * ringBat
      const y = cy + Math.sin(angle) * ringBat
      const cd = energyStore.getCommunicationData(d)
      out.push({
        key: `${d.type}-${d.id}`,
        device: d,
        x,
        y,
        r: 26,
        label: `BAT ${d.id}`,
        title: `${d.name}\n状态: ${statusText(cd.status)}\n最后通信: ${cd.lastCommTime}`,
        status: cd.status,
      })
    }
  }

  return out
})

const nodeByKey = computed(() => new Map(topologyNodes.value.map((n) => [n.key, n])))

const topologyEdges = computed<TopologyEdge[]>(() => {
  const uniq = new Map<string, TopologyEdge>()
  const nMap = nodeByKey.value
  for (const a of topologyNodes.value) {
    const cd = energyStore.getCommunicationData(a.device)
    for (const to of cd.connectedDevices) {
      const bKey = parseNameToKey(to.name)
      if (!bKey) continue
      const b = nMap.get(bKey)
      if (!b) continue
      const k = [a.key, bKey].sort().join('--')
      const status = getPairStatus(a.key, bKey)
      const existing = uniq.get(k)
      if (!existing || rank(status) > rank(existing.status)) {
        uniq.set(k, {
          key: k,
          a: a.key,
          b: bKey,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          status,
        })
      }
    }
  }
  return Array.from(uniq.values())
})

const worst = (
  arr: Array<'normal' | 'warning' | 'error' | 'none'>,
): 'normal' | 'warning' | 'error' | 'none' => {
  let w: 'normal' | 'warning' | 'error' | 'none' = 'none'
  for (const s of arr) {
    if (rank(s) > rank(w)) w = s
  }
  return w
}

const toNodeStatus = (
  s: 'normal' | 'warning' | 'error' | 'none',
): 'normal' | 'warning' | 'error' => (s === 'none' ? 'normal' : s)

const controlTopologyNodes = computed<ControlTopologyNode[]>(() => {
  const ems: Device = { id: 'ems', type: 'ems', name: 'EMS' }
  const fs: Device = { id: 1, type: 'frontServer', name: '前置服务器' }
  const remote: Device = { id: 1, type: 'remote', name: '远端主站' }

  const emsComm = energyStore.getCommunicationData(ems)
  const fsComm = energyStore.getCommunicationData(fs)
  const remoteComm = energyStore.getCommunicationData(remote)

  const ccus = energyStore.getCoordinationUnits as CoordinationUnit[]

  const pcsWorst = worst(
    Array.from({ length: pcsCount.value }, (_, i) =>
      getPairStatus('frontServer-1', `pcs-${i + 1}`),
    ),
  )
  const bmsWorst = worst(
    Array.from({ length: bmsCount.value }, (_, i) =>
      getPairStatus('frontServer-1', `bms-${i + 1}`),
    ),
  )
  const batWorst = worst(
    Array.from({ length: Math.min(bmsCount.value, batteryCount.value) }, (_, i) =>
      getPairStatus(`bms-${i + 1}`, `battery-${i + 1}`),
    ),
  )

  const out: ControlTopologyNode[] = []

  out.push({
    key: 'ems-ems',
    device: ems,
    x: 500,
    y: 110,
    r: 60,
    label: 'EMS',
    title: `EMS\n状态: ${statusText(emsComm.status)}\n最后通信: ${emsComm.lastCommTime}`,
    status: emsComm.status,
  })

  out.push({
    key: 'frontServer-1',
    device: fs,
    x: 500,
    y: 300,
    r: 60,
    label: 'FS',
    title: `${fs.name}\n状态: ${statusText(fsComm.status)}\n最后通信: ${fsComm.lastCommTime}`,
    status: fsComm.status,
  })

  out.push({
    key: 'remote-1',
    device: remote,
    x: 880,
    y: 110,
    r: 52,
    label: 'REMOTE',
    title: `${remote.name}\n状态: ${statusText(remoteComm.status)}\n最后通信: ${remoteComm.lastCommTime}`,
    status: remoteComm.status,
  })

  const ccuPos = [
    { x: 180, y: 210 },
    { x: 180, y: 330 },
    { x: 180, y: 450 },
  ]

  for (let i = 0; i < 3; i++) {
    const unitId = i + 1
    const u = ccus.find((x) => x.unitId === unitId)
    const st = (u?.status ?? 'normal') as 'normal' | 'warning' | 'error'
    const p = ccuPos[i]!
    out.push({
      key: `ccu-${unitId}`,
      x: p.x,
      y: p.y,
      r: 44,
      label: `CCU ${unitId}`,
      title: u
        ? `${u.name}\n状态: ${statusText(u.status)}\n最后更新: ${u.lastUpdateTime}`
        : `CCU ${unitId}`,
      status: st,
    })
  }

  out.push({
    key: 'pcs-group',
    x: 780,
    y: 250,
    r: 46,
    label: `PCS(${pcsCount.value})`,
    title: `PCS 集群\n状态: ${statusText(pcsWorst)}`,
    status: toNodeStatus(pcsWorst),
  })

  out.push({
    key: 'bms-group',
    x: 780,
    y: 390,
    r: 46,
    label: `BMS(${bmsCount.value})`,
    title: `BMS 集群\n状态: ${statusText(bmsWorst)}`,
    status: toNodeStatus(bmsWorst),
  })

  out.push({
    key: 'battery-group',
    x: 780,
    y: 530,
    r: 46,
    label: `BAT(${batteryCount.value})`,
    title: `电池仓集群\n状态: ${statusText(batWorst)}`,
    status: toNodeStatus(batWorst),
  })

  return out
})

const controlNodeByKey = computed(() => new Map(controlTopologyNodes.value.map((n) => [n.key, n])))

const controlTopologyEdges = computed<ControlTopologyEdge[]>(() => {
  const nMap = controlNodeByKey.value
  const out: ControlTopologyEdge[] = []

  const link = (a: string, b: string, status: 'normal' | 'warning' | 'error' | 'none') => {
    const na = nMap.get(a)
    const nb = nMap.get(b)
    if (!na || !nb) return
    out.push({
      key: `${a}--${b}`,
      a,
      b,
      x1: na.x,
      y1: na.y,
      x2: nb.x,
      y2: nb.y,
      status,
    })
  }

  const sFsEms = getPairStatus('frontServer-1', 'ems-ems')
  const sFsRemote = getPairStatus('frontServer-1', 'remote-1')
  const sFsPcs = worst(
    Array.from({ length: pcsCount.value }, (_, i) =>
      getPairStatus('frontServer-1', `pcs-${i + 1}`),
    ),
  )
  const sFsBms = worst(
    Array.from({ length: bmsCount.value }, (_, i) =>
      getPairStatus('frontServer-1', `bms-${i + 1}`),
    ),
  )
  const sBmsBat = worst(
    Array.from({ length: Math.min(bmsCount.value, batteryCount.value) }, (_, i) =>
      getPairStatus(`bms-${i + 1}`, `battery-${i + 1}`),
    ),
  )

  link('frontServer-1', 'ems-ems', sFsEms)
  link('frontServer-1', 'remote-1', sFsRemote)
  link('frontServer-1', 'pcs-group', sFsPcs)
  link('frontServer-1', 'bms-group', sFsBms)
  link('bms-group', 'battery-group', sBmsBat)

  const ccus = energyStore.getCoordinationUnits as CoordinationUnit[]
  for (let unitId = 1; unitId <= 3; unitId++) {
    const ccuKey = `ccu-${unitId}`
    const ccuStatus = (ccus.find((x) => x.unitId === unitId)?.status ?? 'normal') as
      | 'normal'
      | 'warning'
      | 'error'

    link('ems-ems', ccuKey, worst([sFsEms, ccuStatus]))
    link(ccuKey, 'pcs-group', worst([ccuStatus, sFsPcs]))
    link(ccuKey, 'bms-group', worst([ccuStatus, sFsBms]))
  }

  return out
})

// 计算连接线终点的X坐标
const getLineEndX = (index: number, total: number) => {
  // 使用固定的中心位置和半径，避免依赖DOM元素
  const centerX = 200 // 图表容器中心X坐标
  const angle = (index / total) * 2 * Math.PI
  const radius = 150 // 与getNodePosition保持一致的半径

  return centerX + Math.cos(angle) * radius
}

void getLineEndX

// 计算连接线终点的Y坐标
const getLineEndY = (index: number, total: number) => {
  // 使用固定的中心位置和半径，避免依赖DOM元素
  const centerY = 200 // 图表容器中心Y坐标
  const angle = (index / total) * 2 * Math.PI
  const radius = 150 // 与getNodePosition保持一致的半径

  return centerY + Math.sin(angle) * radius
}

void getLineEndY

// 默认选择EMS
watch(
  () => energyStore.communicationData,
  (newData) => {
    if (newData && !selectedDevice.value) {
      selectDevice({ id: 'ems', type: 'ems', name: 'EMS' })
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.communication-status {
  padding: 20px;
}

.communication-status h1 {
  font-size: 28px;
  color: #1a202c;
  margin-bottom: 30px;
}

.device-selection h2 {
  font-size: 20px;
  color: #2d3748;
  margin-bottom: 20px;
}

.device-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tab-label {
  font-weight: 600;
  color: #4a5568;
  margin-right: 5px;
}

.device-tab {
  padding: 10px 20px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.device-tab.small {
  padding: 6px 12px;
  font-size: 14px;
}

.device-tab:hover {
  border-color: #4299e1;
  background: #ebf8ff;
}

.device-tab.active {
  background: #4299e1;
  border-color: #4299e1;
  color: white;
}

.communication-detail {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.communication-detail h2 {
  font-size: 24px;
  color: #2d3748;
  margin-bottom: 20px;
}

.device-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f7fafc;
  border-radius: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-item label {
  font-size: 14px;
  color: #718096;
  font-weight: 500;
}

.info-item span {
  font-size: 18px;
  color: #2d3748;
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.status-badge.normal {
  background: #c6f6d5;
  color: #22543d;
}

.status-badge.warning {
  background: #feebc8;
  color: #7b341e;
}

.status-badge.error {
  background: #fed7d7;
  color: #742a2a;
}

.status-badge.none {
  background: #edf2f7;
  color: #4a5568;
}

.status-badge.abnormal {
  background: #fed7d7;
  color: #742a2a;
}

.modbus-info h3 {
  font-size: 18px;
  color: #2d3748;
  margin-bottom: 20px;
}

.modbus-table-container {
  overflow-x: auto;
  margin-bottom: 30px;
}

.modbus-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.modbus-table th {
  background: #f7fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
}

.modbus-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
}

.modbus-table tr:hover {
  background: #f7fafc;
}

.frames-info h3 {
  font-size: 18px;
  color: #2d3748;
  margin: 20px 0;
}

.frames-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  margin-bottom: 10px;
}

.pager-left,
.pager-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pager-label {
  color: #4a5568;
  font-size: 14px;
}

.pager-meta {
  color: #4a5568;
  font-size: 14px;
}

.pager-select {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 10px;
  background: white;
}

.pager-btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f7fafc;
  cursor: pointer;
  color: #2d3748;
  font-weight: 600;
}

.pager-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.frames-table-container {
  overflow-x: auto;
  margin-bottom: 20px;
}

.frames-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.frames-table th {
  background: #f7fafc;
  padding: 10px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.frames-table td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  color: #2d3748;
  white-space: nowrap;
}

.frames-table tr:hover {
  background: #f7fafc;
}

.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 5px;
}

.status-dot.normal {
  background: #48bb78;
}

.status-dot.warning {
  background: #ed8936;
}

.status-dot.error {
  background: #f56565;
}

.interaction-graph h3 {
  font-size: 18px;
  color: #2d3748;
  margin-bottom: 20px;
}

.graph-container {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 12px 6px;
}

.topology-wrap {
  width: 100%;
  border-radius: 12px;
  background: radial-gradient(circle at 50% 20%, rgba(66, 153, 225, 0.18), rgba(255, 255, 255, 1));
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.topology {
  width: 100%;
  height: 460px;
  display: block;
}

.topology-node {
  cursor: default;
}

.topology-node.clickable {
  cursor: pointer;
}

.topology-node circle {
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2px;
}

.topology-node text {
  fill: #ffffff;
  font-weight: 700;
  font-size: 16px;
  pointer-events: none;
}

.topology-node.normal circle {
  fill: #38a169;
}

.topology-node.warning circle {
  fill: #dd6b20;
}

.topology-node.error circle {
  fill: #e53e3e;
}

.topology-node.selected circle {
  stroke: #1a202c;
  stroke-width: 3px;
}

.central-node {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #4299e1, #3182ce);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
  z-index: 2;
}

.connected-nodes {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.connected-node {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 500;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.connected-node.normal {
  background: linear-gradient(135deg, #48bb78, #38a169);
}

.connected-node.warning {
  background: linear-gradient(135deg, #ed8936, #dd6b20);
}

.connected-node.error {
  background: linear-gradient(135deg, #f56565, #e53e3e);
}

.connection-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.connection-line {
  stroke-width: 2.5px;
  stroke: #cbd5e0;
  fill: none;
  opacity: 0.85;
}

.connection-line.control-line {
  stroke-dasharray: 10 7;
}

.connection-line.normal {
  stroke: #48bb78;
}

.connection-line.warning {
  stroke: #ed8936;
}

.connection-line.error {
  stroke: #f56565;
}

.connection-line.none {
  stroke: #cbd5e0;
  opacity: 0.35;
}
</style>
