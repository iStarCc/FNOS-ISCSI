<template>
  <div>
    <div class="page-header">
      <h1>仪表盘</h1>
      <p>iSCSI 连接与存储状态总览</p>
    </div>

    <!-- 健康告警 -->
    <div v-if="alerts.length" style="margin-bottom: 14px;">
      <div v-for="(a, i) in alerts" :key="i" class="alert" :class="'alert-' + a.type">
        <svg v-if="a.type === 'error'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        {{ a.msg }}
      </div>
    </div>

    <!-- 上方：统计(左) + 性能(右) 等高 -->
    <div class="top-row">
      <div class="stat-2x2">
        <div class="mini-stat">
          <div class="mini-stat-icon icon-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div class="mini-stat-val">{{ sessions.length }}</div>
            <div class="mini-stat-label">活跃会话</div>
          </div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-icon icon-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div>
            <div class="mini-stat-val">{{ targets.length }}</div>
            <div class="mini-stat-label">已发现目标</div>
          </div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-icon icon-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <div>
            <div class="mini-stat-val">{{ mounts.length }}</div>
            <div class="mini-stat-label">挂载点</div>
          </div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-icon icon-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </div>
          <div>
            <div class="mini-stat-val">{{ autoReconnectCount }}</div>
            <div class="mini-stat-label">自动重连</div>
          </div>
        </div>
      </div>

      <div class="card perf-card">
        <div class="perf-header">
          <span class="perf-title">I/O 性能监控</span>
          <select v-if="diskNames.length" v-model="selectedDisk" class="disk-select">
            <option v-for="d in diskNames" :key="d" :value="d">/dev/{{ d }}</option>
          </select>
        </div>
        <template v-if="diskNames.length">
          <div class="chart-wrap">
            <canvas ref="chartEl"></canvas>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot legend-read"></span>读取</span>
              <span class="legend-item"><span class="legend-dot legend-write"></span>写入</span>
            </div>
          </div>
          <div class="perf-metrics">
            <div class="perf-metric">
              <div class="perf-metric-val">{{ formatSpeed(curRead) }}</div>
              <div class="perf-metric-label">读取</div>
            </div>
            <div class="perf-metric">
              <div class="perf-metric-val">{{ formatSpeed(curWrite) }}</div>
              <div class="perf-metric-label">写入</div>
            </div>
            <div class="perf-metric">
              <div class="perf-metric-val">{{ curIops }}</div>
              <div class="perf-metric-label">IOPS</div>
            </div>
            <div class="perf-metric">
              <div class="perf-metric-val">{{ curQueue }}</div>
              <div class="perf-metric-label">队列</div>
            </div>
          </div>
        </template>
        <div v-else class="perf-empty">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>连接目标后显示</span>
        </div>
      </div>
    </div>

    <!-- 下方：已连接目标（整行） -->
    <div class="card" v-if="sessions.length" style="margin-top: 14px;">
      <div class="card-header">
        <div class="card-title" style="margin-bottom: 0;">已连接目标</div>
        <span class="badge badge-primary badge-dot">{{ sessions.length }} 个会话</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>目标名称</th>
            <th>Portal</th>
            <th>SID</th>
            <th>传输</th>
            <th>关联设备</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.sid">
            <td class="mono" style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ s.target }}</td>
            <td>{{ s.portal }}</td>
            <td><span class="badge badge-info">{{ s.sid }}</span></td>
            <td><span class="badge badge-primary">{{ s.transport }}</span></td>
            <td class="mono">{{ s.devices?.join(', ') || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 存储用量 -->
    <div class="card" v-if="mounts.length" style="margin-top: 14px;">
      <div class="card-title">存储用量</div>
      <div class="storage-list">
        <div v-for="m in mounts" :key="m.target" class="storage-item">
          <div class="storage-head">
            <span class="mono" style="font-size: 12px;">{{ m.source }}</span>
            <span style="color: var(--text-2); font-size: 11px;">{{ m.target }}</span>
          </div>
          <div class="storage-bar-wrap">
            <div class="storage-bar"><div class="storage-bar-fill" :class="usageClass(m)" :style="{ width: m['use%'] || '0%' }"></div></div>
            <span class="storage-pct" :class="usageClass(m)">{{ m['use%'] || '0%' }}</span>
          </div>
          <div class="storage-detail">
            <span>{{ m.size || '—' }} 总计</span>
            <span>{{ m.avail || '—' }} 可用</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="card" v-if="!loading && !sessions.length" style="margin-top: 14px;">
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        </div>
        <div class="empty-title">暂无 iSCSI 连接</div>
        <p>前往发现页面连接目标</p>
        <p style="margin-top: 12px;"><router-link to="/discovery" class="btn btn-primary btn-sm">发现目标</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { api } from '../api/index.js';

const sessions = ref([]);
const targets = ref([]);
const mounts = ref([]);
const config = ref({ autoReconnect: [] });
const loading = ref(true);

const diskNames = ref([]);
const selectedDisk = ref('');
const chartEl = ref(null);

const MAX_POINTS = 30;
const history = ref({});
let pollTimer = null;

const autoReconnectCount = computed(() => config.value.autoReconnect?.length || 0);

const curData = computed(() => {
  const h = history.value[selectedDisk.value];
  return h?.length ? h[h.length - 1] : null;
});
const curRead = computed(() => curData.value?.readSpeed || 0);
const curWrite = computed(() => curData.value?.writeSpeed || 0);
const curIops = computed(() => curData.value?.iops || 0);
const curQueue = computed(() => curData.value?.iosInProgress || 0);

function normalizeTarget(t) {
  return (t || '').replace(/\s*\(.*\)\s*$/, '').trim();
}

const alerts = computed(() => {
  const list = [];
  for (const ar of config.value.autoReconnect || []) {
    const arName = normalizeTarget(ar.target);
    if (!sessions.value.some((s) => normalizeTarget(s.target) === arName)) {
      list.push({ type: 'warning', msg: `自动重连目标未连接: ${arName}` });
    }
  }
  for (const m of mounts.value) {
    const pct = parseInt(m['use%']);
    if (pct >= 90) list.push({ type: 'error', msg: `${m.target} 使用率 ${m['use%']}，空间不足` });
    else if (pct >= 80) list.push({ type: 'warning', msg: `${m.target} 使用率 ${m['use%']}，请注意` });
  }
  return list;
});

function usageClass(m) {
  const pct = parseInt(m['use%']);
  if (pct >= 90) return 'usage-danger';
  if (pct >= 70) return 'usage-warning';
  return 'usage-ok';
}

function formatSpeed(b) {
  if (!b) return '0 B/s';
  if (b < 1024) return b + ' B/s';
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB/s';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB/s';
  return (b / 1024 ** 3).toFixed(2) + ' GB/s';
}

function formatAxisLabel(b) {
  if (b < 1024) return b + 'B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(0) + 'K';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(0) + 'M';
  return (b / 1024 ** 3).toFixed(1) + 'G';
}

function drawChart() {
  const canvas = chartEl.value;
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const chartW = Math.floor(rect.width);
  const chartH = 130;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = chartW * dpr;
  canvas.height = chartH * dpr;
  canvas.style.width = chartW + 'px';
  canvas.style.height = chartH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, chartW, chartH);

  const pts = history.value[selectedDisk.value] || [];
  const pad = { top: 8, right: 8, bottom: 14, left: 42 };
  const w = chartW - pad.left - pad.right;
  const h = chartH - pad.top - pad.bottom;

  let maxVal = 1024;
  for (const p of pts) maxVal = Math.max(maxVal, p.readSpeed, p.writeSpeed);
  maxVal = Math.ceil(maxVal * 1.15);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
    const val = maxVal - (maxVal / gridLines) * i;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatAxisLabel(val) + '/s', pad.left - 4, y + 3);
  }

  if (!pts.length) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('等待数据...', chartW / 2, chartH / 2);
    return;
  }

  const stepX = w / (MAX_POINTS - 1);

  function drawLine(key, color, fillColor) {
    const startIdx = Math.max(0, MAX_POINTS - pts.length);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pad.left + (startIdx + i) * stepX;
      const y = pad.top + h - (pts[i][key] / maxVal) * h;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = pad.left + (startIdx + i - 1) * stepX;
        const prevY = pad.top + h - (pts[i - 1][key] / maxVal) * h;
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const lastX = pad.left + (startIdx + pts.length - 1) * stepX;
    ctx.lineTo(lastX, pad.top + h);
    ctx.lineTo(pad.left + startIdx * stepX, pad.top + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  drawLine('readSpeed', '#3B82F6', 'rgba(59,130,246,0.1)');
  drawLine('writeSpeed', '#10B981', 'rgba(16,185,129,0.1)');
}

async function pollIo() {
  try {
    const res = await api.getIoStats();
    const stats = res.stats || [];
    const h = { ...history.value };
    for (const s of stats) {
      if (!h[s.name]) h[s.name] = [];
      h[s.name] = [...h[s.name].slice(-(MAX_POINTS - 1)), s];
    }
    history.value = h;
    const names = stats.map((s) => s.name);
    if (names.length && !diskNames.value.length) {
      diskNames.value = names;
      selectedDisk.value = names[0];
    }
    await nextTick();
    drawChart();
  } catch { /* ignore */ }
}

watch(selectedDisk, () => nextTick(drawChart));

async function loadData() {
  loading.value = true;
  try {
    const [sessRes, targetRes, mountRes, configRes] = await Promise.all([
      api.getSessions().catch(() => ({ sessions: [] })),
      api.getTargets().catch(() => ({ targets: [] })),
      api.getMounts().catch(() => ({ mounts: [] })),
      api.getConfig().catch(() => ({ autoReconnect: [] })),
    ]);
    sessions.value = sessRes.sessions || [];
    targets.value = targetRes.targets || [];
    mounts.value = mountRes.mounts || [];
    config.value = configRes;

    if (sessions.value.length) {
      const devs = sessions.value.flatMap((s) => (s.devices || []).map((d) => d.replace('/dev/', '')));
      if (devs.length) {
        diskNames.value = devs;
        selectedDisk.value = devs[0];
      }
      pollIo();
      pollTimer = setInterval(pollIo, 3000);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
/* 上方：左统计 + 右性能，等高 */
.top-row {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 14px;
  align-items: stretch;
}
@media (max-width: 700px) {
  .top-row { grid-template-columns: 1fr; }
}

/* 2×2 统计卡片 */
.stat-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
}
.mini-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  transition: box-shadow 180ms ease, transform 180ms ease;
}
.mini-stat:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.mini-stat-icon {
  width: 36px; height: 36px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mini-stat-icon svg { width: 18px; height: 18px; }
.mini-stat-val { font-size: 22px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.mini-stat-label { font-size: 11.5px; color: var(--text-2); margin-top: 2px; }

/* 性能监控卡片 */
.perf-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}
.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.perf-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.disk-select {
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-family: 'SF Mono', 'Consolas', monospace;
  color: var(--text);
  background: var(--surface);
  cursor: pointer;
  outline: none;
}
.disk-select:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }

.chart-wrap { flex: 1; min-height: 0; }
.chart-wrap canvas {
  width: 100%;
  border-radius: var(--radius-xs);
  background: var(--hover);
}
.chart-legend {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 6px 0 8px;
  font-size: 10px;
  color: var(--text-2);
}
.legend-item { display: flex; align-items: center; gap: 3px; }
.legend-dot { width: 8px; height: 2.5px; border-radius: 2px; }
.legend-read { background: #3B82F6; }
.legend-write { background: #10B981; }

.perf-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.perf-metric {
  padding: 6px 4px;
  background: var(--hover);
  border-radius: var(--radius-xs);
  text-align: center;
}
.perf-metric-val {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.perf-metric-label {
  font-size: 9.5px;
  color: var(--text-3);
  margin-top: 1px;
}

.perf-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-3);
  font-size: 12px;
}

/* 存储用量 */
.storage-list { display: flex; flex-direction: column; gap: 12px; }
.storage-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
.storage-bar-wrap { display: flex; align-items: center; gap: 8px; }
.storage-bar { flex: 1; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
.storage-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.usage-ok .storage-bar-fill, .storage-bar-fill.usage-ok { background: var(--success); }
.usage-warning .storage-bar-fill, .storage-bar-fill.usage-warning { background: var(--warning); }
.usage-danger .storage-bar-fill, .storage-bar-fill.usage-danger { background: var(--danger); }
.storage-pct { font-size: 12px; font-weight: 600; min-width: 32px; text-align: right; }
.storage-pct.usage-ok { color: var(--success); }
.storage-pct.usage-warning { color: var(--warning); }
.storage-pct.usage-danger { color: var(--danger); }
.storage-detail { display: flex; gap: 10px; margin-top: 3px; font-size: 11px; color: var(--text-3); }
</style>
