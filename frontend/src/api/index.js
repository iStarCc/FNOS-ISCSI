const BASE = '/app/fnnas-iscsi/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  discover: (portal) => request('/discover', { method: 'POST', body: { portal } }),
  scanNetwork: () => request('/scan', { method: 'POST' }),
  getTargets: () => request('/targets'),
  loginTarget: (target, portal, chapUser, chapPassword, autoReconnect) =>
    request(`/targets/${encodeURIComponent(target)}/login`, {
      method: 'POST', body: { portal, chapUser, chapPassword, autoReconnect },
    }),
  logoutTarget: (target, portal, removeAutoReconnect) =>
    request(`/targets/${encodeURIComponent(target)}/logout`, {
      method: 'POST', body: { portal, removeAutoReconnect },
    }),

  getSessions: () => request('/sessions'),
  deleteSession: (sid) => request(`/sessions/${sid}`, { method: 'DELETE' }),

  getDevices: () => request('/devices'),
  getMounts: () => request('/mounts'),
  getIoStats: () => request('/io-stats'),
  mount: (device, mountPoint, fsType) =>
    request('/mount', { method: 'POST', body: { device, mountPoint, fsType } }),
  unmount: (mountPoint) =>
    request('/unmount', { method: 'POST', body: { mountPoint } }),
  format: (device, fsType) =>
    request('/format', { method: 'POST', body: { device, fsType } }),

  getConfig: () => request('/config'),
  updateConfig: (config) => request('/config', { method: 'PUT', body: config }),
};
