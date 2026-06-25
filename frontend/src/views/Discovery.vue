<template>
  <div>
    <div class="page-header">
      <h1>目标发现</h1>
      <p>扫描局域网或指定 Portal 发现 iSCSI 目标</p>
    </div>

    <div class="card">
      <div class="card-title">发现目标</div>

      <div class="scan-tabs">
        <button class="scan-tab" :class="{ active: mode === 'auto' }" @click="mode = 'auto'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          自动扫描局域网
        </button>
        <button class="scan-tab" :class="{ active: mode === 'manual' }" @click="mode = 'manual'">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          手动输入 Portal
        </button>
      </div>

      <!-- 自动扫描 -->
      <div v-if="mode === 'auto'" style="margin-top: 14px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
          <button class="btn btn-primary" :disabled="scanning" @click="doScan">
            <svg v-if="!scanning" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {{ scanning ? '扫描中...' : '开始扫描' }}
          </button>
          <span v-if="scanning" class="scan-hint">
            <span class="scan-spinner"></span>
            正在扫描局域网端口 3260，请稍候...
          </span>
          <span v-if="!scanning && scanDone" style="font-size: 12px; color: var(--text-2);">
            发现 {{ scanHosts.length }} 个 iSCSI 主机，{{ autoTargets.length }} 个目标
          </span>
        </div>
      </div>

      <!-- 手动输入 -->
      <div v-if="mode === 'manual'" style="margin-top: 14px;">
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Portal 地址</label>
            <input v-model="portal" placeholder="192.168.1.100:3260" @keyup.enter="doDiscover" />
          </div>
          <button class="btn btn-primary" :disabled="discovering || !portal.trim()" @click="doDiscover">
            {{ discovering ? '发现中...' : '开始发现' }}
          </button>
        </div>
      </div>

      <div class="alert alert-error" v-if="error">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        {{ error }}
      </div>
      <div class="alert alert-success" v-if="success">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {{ success }}
      </div>

      <table v-if="currentTargets.length">
        <thead>
          <tr>
            <th>目标名称</th>
            <th>Portal</th>
            <th>TPGT</th>
            <th style="text-align: right;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in currentTargets" :key="t.target + t.portal">
            <td class="mono">{{ t.target }}</td>
            <td>{{ t.portal }}</td>
            <td><span class="badge badge-info">{{ t.tpgt }}</span></td>
            <td style="text-align: right;">
              <button class="btn btn-primary btn-sm" :disabled="loggingIn[t.target]" @click="showLogin(t)">
                登录
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" v-if="!currentTargets.length && !discovering && !scanning && !error">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <p>点击「自动扫描」或手动输入 Portal 地址</p>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <div class="modal-overlay" v-if="loginDialog" @click.self="loginDialog = null">
      <div class="card" style="width: 440px;">
        <div class="card-title">登录到目标</div>
        <p class="mono" style="color: var(--text-2); margin-bottom: 20px; word-break: break-all; font-size: 12.5px;">
          {{ loginDialog.target }}
        </p>
        <div class="form-group" style="margin-bottom: 14px;">
          <label>CHAP 用户名（可选）</label>
          <input v-model="chapUser" placeholder="留空跳过 CHAP 认证" />
        </div>
        <div class="form-group" style="margin-bottom: 16px;">
          <label>CHAP 密码（可选）</label>
          <input v-model="chapPassword" type="password" placeholder="留空跳过" />
        </div>
        <label class="toggle-row" style="margin-bottom: 24px;">
          <input type="checkbox" class="toggle" v-model="autoReconnect" />
          <span>开机自动连接</span>
        </label>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-outline" @click="loginDialog = null">取消</button>
          <button class="btn btn-primary" :disabled="loggingIn[loginDialog.target]" @click="doLogin">
            {{ loggingIn[loginDialog.target] ? '登录中...' : '确认登录' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { api } from '../api/index.js';

const mode = ref('auto');
const portal = ref('');
const autoTargets = ref([]);
const manualTargets = ref([]);
const discovering = ref(false);
const scanning = ref(false);
const scanDone = ref(false);
const scanHosts = ref([]);
const loggingIn = reactive({});
const error = ref('');
const success = ref('');

const loginDialog = ref(null);
const chapUser = ref('');
const chapPassword = ref('');
const autoReconnect = ref(true);

const currentTargets = computed(() =>
  mode.value === 'auto' ? autoTargets.value : manualTargets.value
);

async function doScan() {
  error.value = '';
  success.value = '';
  scanning.value = true;
  scanDone.value = false;
  try {
    const res = await api.scanNetwork();
    scanHosts.value = res.hosts || [];
    autoTargets.value = res.targets || [];
    scanDone.value = true;
    if (!autoTargets.value.length) {
      error.value = scanHosts.value.length
        ? `发现 ${scanHosts.value.length} 个主机，但未找到 iSCSI 目标`
        : '局域网内未发现开放 3260 端口的主机';
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    scanning.value = false;
  }
}

async function doDiscover() {
  error.value = '';
  success.value = '';
  discovering.value = true;
  try {
    const res = await api.discover(portal.value.trim());
    manualTargets.value = res.targets || [];
    if (!manualTargets.value.length) {
      error.value = '未发现任何目标';
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    discovering.value = false;
  }
}

function showLogin(target) {
  loginDialog.value = target;
  chapUser.value = '';
  chapPassword.value = '';
  autoReconnect.value = true;
}

async function doLogin() {
  const t = loginDialog.value;
  if (!t) return;
  error.value = '';
  success.value = '';
  loggingIn[t.target] = true;
  try {
    await api.loginTarget(
      t.target, t.portal,
      chapUser.value || undefined,
      chapPassword.value || undefined,
      autoReconnect.value
    );
    success.value = `已登录: ${t.target}`;
    loginDialog.value = null;
  } catch (err) {
    loginDialog.value = null;
    error.value = `登录失败: ${err.message}`;
  } finally {
    loggingIn[t.target] = false;
  }
}
</script>

<style scoped>
.scan-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.scan-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-2);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}
.scan-tab:hover { color: var(--text); }
.scan-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.scan-tab svg { opacity: 0.5; }
.scan-tab.active svg { opacity: 1; color: var(--primary); }

.scan-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.scan-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
