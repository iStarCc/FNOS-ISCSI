import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
import Discovery from './views/Discovery.vue';
import Sessions from './views/Sessions.vue';
import Mounts from './views/Mounts.vue';

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard, meta: { title: '仪表盘' } },
  { path: '/discovery', name: 'Discovery', component: Discovery, meta: { title: '目标发现' } },
  { path: '/sessions', name: 'Sessions', component: Sessions, meta: { title: '会话管理' } },
  { path: '/mounts', name: 'Mounts', component: Mounts, meta: { title: '挂载管理' } },
];

const router = createRouter({
  history: createWebHistory('/app/fnnas-iscsi/'),
  routes,
});

export default router;
