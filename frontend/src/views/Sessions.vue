<template>
  <div>
    <div class="page-header">
      <h1>会话管理</h1>
      <p>查看和管理当前 iSCSI 会话</p>
    </div>

    <div class="alert alert-error" v-if="error">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      {{ error }}
    </div>
    <div class="alert alert-success" v-if="success">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      {{ success }}
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title" style="margin-bottom: 0;">活跃会话</div>
        <button class="btn btn-outline btn-sm" @click="loadSessions">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          刷新
        </button>
      </div>

      <div class="loading" v-if="loading">加载中...</div>

      <table v-if="!loading && sessions.length">
        <thead>
          <tr>
            <th>SID</th>
            <th>目标名称</th>
            <th>Portal</th>
            <th>传输协议</th>
            <th>关联设备</th>
            <th>自动重连</th>
            <th style="text-align: right;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.sid">
            <td><span class="badge badge-primary">{{ s.sid }}</span></td>
            <td class="mono">{{ s.target }}</td>
            <td>{{ s.portal }}</td>
            <td><span class="badge badge-info">{{ s.transport }}</span></td>
            <td class="mono">{{ s.devices?.join(', ') || '—' }}</td>
            <td>
              <input
                type="checkbox"
                class="toggle"
                :checked="isAutoReconnect(s)"
                @change="toggleAutoReconnect(s, $event)"
              />
            </td>
            <td style="text-align: right;">
              <button
                class="btn btn-danger btn-sm"
                :disabled="loggingOut[s.sid]"
                @click="doLogout(s)"
              >
                {{ loggingOut[s.sid] ? '登出中...' : '登出' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" v-if="!loading && !sessions.length">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="empty-title">暂无活跃会话</div>
        <p>发现并登录目标后，会话将显示在此处</p>
        <p style="margin-top: 14px;">
          <router-link to="/discovery" class="btn btn-primary btn-sm">去发现目标</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api/index.js';

const sessions = ref([]);
const config = ref({ autoReconnect: [], targets: [] });
const loading = ref(true);
const loggingOut = reactive({});
const error = ref('');
const success = ref('');

async function loadSessions() {
  loading.value = true;
  error.value = '';
  try {
    const [sessRes, configRes] = await Promise.all([
      api.getSessions(),
      api.getConfig().catch(() => ({ autoReconnect: [], targets: [] })),
    ]);
    sessions.value = sessRes.sessions || [];
    config.value = configRes;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function normalizeTarget(t) {
  return (t || '').replace(/\s*\(.*\)\s*$/, '').trim();
}

function isAutoReconnect(session) {
  const sn = normalizeTarget(session.target);
  return (config.value.autoReconnect || []).some(
    (e) => normalizeTarget(e.target) === sn
  );
}

async function toggleAutoReconnect(session, event) {
  const checked = event.target.checked;
  const list = [...(config.value.autoReconnect || [])];

  if (checked) {
    list.push({ target: session.target, portal: session.portal });
  } else {
    const idx = list.findIndex(
      (e) => e.target === session.target && e.portal === session.portal
    );
    if (idx !== -1) list.splice(idx, 1);
  }

  try {
    await api.updateConfig({ ...config.value, autoReconnect: list });
    config.value.autoReconnect = list;
  } catch (err) {
    error.value = err.message;
    event.target.checked = !checked;
  }
}

async function doLogout(session) {
  error.value = '';
  success.value = '';
  loggingOut[session.sid] = true;
  try {
    const wasAutoReconnect = isAutoReconnect(session);
    await api.logoutTarget(session.target, session.portal, wasAutoReconnect);
    success.value = `已登出: ${session.target}`;
    await loadSessions();
  } catch (err) {
    error.value = err.message;
  } finally {
    loggingOut[session.sid] = false;
  }
}

onMounted(loadSessions);
</script>
