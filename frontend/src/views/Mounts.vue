<template>
  <div>
    <div class="page-header">
      <h1>挂载管理</h1>
      <p>管理 iSCSI 块设备的挂载与卸载</p>
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
        <div class="card-title" style="margin-bottom: 0;">iSCSI 块设备</div>
        <button class="btn btn-outline btn-sm" @click="loadAll">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          刷新
        </button>
      </div>

      <div class="loading" v-if="loading">加载中...</div>

      <table v-if="!loading && devices.length">
        <thead>
          <tr>
            <th>设备</th>
            <th>容量</th>
            <th>文件系统</th>
            <th>状态</th>
            <th style="text-align: right;">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="d in devices" :key="d.name">
            <tr>
              <td class="mono">/dev/{{ d.name }}</td>
              <td>{{ formatSize(d.size) }}</td>
              <td>
                <span class="badge badge-info" v-if="d.fstype">{{ d.fstype }}</span>
                <span v-else-if="d.partitions?.length" style="color: var(--text-3);">已分区</span>
                <span class="badge badge-warning" v-else>未格式化</span>
              </td>
              <td>
                <template v-if="d.managed">
                  <span class="badge badge-success badge-dot">空间管理已使用</span>
                </template>
                <template v-else-if="d.mountpoint">
                  <span class="mono">{{ d.mountpoint }}</span>
                </template>
                <template v-else-if="!d.partitions?.length">
                  <span style="color: var(--text-3);">未挂载</span>
                </template>
                <template v-else>
                  <span style="color: var(--text-4);">—</span>
                </template>
              </td>
              <td style="text-align: right;">
                <div class="action-cell">
                  <template v-if="d.managed">
                    <span class="action-hint">请在空间管理中操作</span>
                  </template>
                  <template v-else-if="d.mountpoint">
                    <button class="btn btn-danger btn-sm" @click="doUnmount(d.mountpoint)">卸载</button>
                  </template>
                  <template v-else-if="!d.partitions?.length">
                    <button class="btn btn-primary btn-sm" @click="showMountDialog(d)">挂载</button>
                    <button v-if="!d.fstype" class="btn btn-outline btn-sm" @click="showFormatDialog(d)">格式化</button>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-for="p in d.partitions" :key="p.name" class="sub-row">
              <td class="mono"><span class="tree-icon">└</span>/dev/{{ p.name }}</td>
              <td>{{ formatSize(p.size) }}</td>
              <td>
                <span class="badge badge-info" v-if="p.fstype">{{ p.fstype }}</span>
                <span class="badge badge-warning" v-else>未格式化</span>
              </td>
              <td>
                <template v-if="p.managed">
                  <span class="badge badge-success badge-dot">空间管理已使用</span>
                </template>
                <template v-else-if="p.mountpoint">
                  <span class="mono">{{ p.mountpoint }}</span>
                </template>
                <template v-else>
                  <span style="color: var(--text-3);">未挂载</span>
                </template>
              </td>
              <td style="text-align: right;">
                <div class="action-cell">
                  <template v-if="p.managed">
                    <span class="action-hint">请在空间管理中操作</span>
                  </template>
                  <template v-else-if="p.mountpoint">
                    <button class="btn btn-danger btn-sm" @click="doUnmount(p.mountpoint)">卸载</button>
                  </template>
                  <template v-else>
                    <button class="btn btn-primary btn-sm" @click="showMountDialog(p)">挂载</button>
                  </template>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div class="empty-state" v-if="!loading && !devices.length">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
        </div>
        <div class="empty-title">未检测到 iSCSI 块设备</div>
        <p>登录 iSCSI 目标后，设备将显示在此处</p>
        <p style="margin-top: 14px;">
          <router-link to="/discovery" class="btn btn-primary btn-sm">去发现目标</router-link>
        </p>
      </div>
    </div>

    <div class="modal-overlay" v-if="mountDialog" @click.self="mountDialog = null">
      <div class="card" style="width: 440px;">
        <div class="card-title">挂载设备</div>
        <p class="mono" style="color: var(--text-2); margin-bottom: 20px; font-size: 12.5px;">
          /dev/{{ mountDialog.name }} · {{ formatSize(mountDialog.size) }}
        </p>
        <div class="form-group" style="margin-bottom: 14px;">
          <label>挂载路径</label>
          <input v-model="mountPoint" placeholder="/mnt/iscsi-data" />
        </div>
        <div class="form-group" style="margin-bottom: 24px;">
          <label>文件系统类型</label>
          <select v-model="mountFsType">
            <option value="">自动检测</option>
            <option value="ext4">ext4</option>
            <option value="xfs">xfs</option>
            <option value="btrfs">btrfs</option>
            <option value="ntfs">ntfs</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-outline" @click="mountDialog = null">取消</button>
          <button class="btn btn-primary" :disabled="!mountPoint.trim()" @click="doMount">确认挂载</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="formatDialog" @click.self="formatDialog = null">
      <div class="card" style="width: 440px;">
        <div class="card-title">格式化设备</div>
        <div class="alert alert-error" style="margin-bottom: 16px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          格式化将清除设备上的所有数据！此操作不可逆！
        </div>
        <p class="mono" style="color: var(--text-2); margin-bottom: 20px; font-size: 12.5px;">
          /dev/{{ formatDialog.name }} · {{ formatSize(formatDialog.size) }}
        </p>
        <div class="form-group" style="margin-bottom: 24px;">
          <label>文件系统类型</label>
          <select v-model="formatFsType">
            <option value="ext4">ext4</option>
            <option value="xfs">xfs</option>
            <option value="btrfs">btrfs</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-outline" @click="formatDialog = null">取消</button>
          <button class="btn btn-danger" @click="doFormat">确认格式化</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api/index.js';

const devices = ref([]);
const loading = ref(true);
const error = ref('');
const success = ref('');

const mountDialog = ref(null);
const mountPoint = ref('');
const mountFsType = ref('');

const formatDialog = ref(null);
const formatFsType = ref('ext4');

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return bytes || '—';
  const n = Number(bytes);
  if (n < 1024) return n + ' B';
  if (n < 1024 ** 2) return (n / 1024).toFixed(1) + ' K';
  if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(1) + ' M';
  if (n < 1024 ** 4) return (n / 1024 ** 3).toFixed(1) + ' G';
  return (n / 1024 ** 4).toFixed(2) + ' T';
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.getDevices().catch(() => ({ devices: [] }));
    devices.value = res.devices || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function showMountDialog(device) {
  mountDialog.value = device;
  mountPoint.value = '';
  mountFsType.value = device.fstype || '';
}

function showFormatDialog(device) {
  formatDialog.value = device;
  formatFsType.value = 'ext4';
}

async function doMount() {
  error.value = '';
  success.value = '';
  try {
    await api.mount(
      `/dev/${mountDialog.value.name}`,
      mountPoint.value.trim(),
      mountFsType.value || undefined
    );
    success.value = `已挂载 /dev/${mountDialog.value.name} → ${mountPoint.value}`;
    mountDialog.value = null;
    await loadAll();
  } catch (err) {
    error.value = err.message;
  }
}

async function doUnmount(target) {
  error.value = '';
  success.value = '';
  try {
    await api.unmount(target);
    success.value = `已卸载 ${target}`;
    await loadAll();
  } catch (err) {
    error.value = err.message;
  }
}

async function doFormat() {
  error.value = '';
  success.value = '';
  try {
    await api.format(`/dev/${formatDialog.value.name}`, formatFsType.value);
    success.value = `已格式化 /dev/${formatDialog.value.name} 为 ${formatFsType.value}`;
    formatDialog.value = null;
    await loadAll();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadAll);
</script>
