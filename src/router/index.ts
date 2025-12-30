import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import BatteryGroups from '../views/BatteryGroups.vue'
import EMS from '../views/EMS.vue'
import Scada from '../views/Scada.vue'
import FrontServer from '../views/FrontServer.vue'
import DataServer from '../views/DataServer.vue'
import AlarmLog from '../views/AlarmLog.vue'
import AlarmDetail from '../views/AlarmDetail.vue'
import CommunicationStatus from '../views/CommunicationStatus.vue'
import DataSummary from '../views/DataSummary.vue'
import CoordinationControl from '../views/CoordinationControl.vue'
import ProtectionSafetyDevices from '../views/ProtectionSafetyDevices.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: Dashboard },
    { path: '/ems', name: 'EMS', component: EMS },
    { path: '/scada', name: 'Scada', component: Scada },
    { path: '/front-server', name: 'FrontServer', component: FrontServer },
    { path: '/data-server', name: 'DataServer', component: DataServer },
    { path: '/alarm-log', name: 'AlarmLog', component: AlarmLog },
    { path: '/alarm-log/:id', name: 'AlarmDetail', component: AlarmDetail },
    { path: '/communication', name: 'CommunicationStatus', component: CommunicationStatus },
    { path: '/data-summary', name: 'DataSummary', component: DataSummary },
    { path: '/battery-groups', name: 'BatteryGroups', component: BatteryGroups },
    { path: '/coordination-control', name: 'CoordinationControl', component: CoordinationControl },
    {
      path: '/protection-safety-devices',
      name: 'ProtectionSafetyDevices',
      component: ProtectionSafetyDevices,
    },
  ],
})

export default router
