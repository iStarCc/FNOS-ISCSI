const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ISCSIADM = 'iscsiadm';

function parseKeyValueOutput(stdout) {
  const result = {};
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.substring(0, idx).trim();
    const value = line.substring(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

function parseTargetRecords(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // 格式: portal,tpgt target_name
      const match = line.match(/^(.+?),(\d+)\s+(.+)$/);
      if (!match) return null;
      return { portal: match[1], tpgt: match[2], target: match[3] };
    })
    .filter(Boolean);
}

function parseSessionList(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // 格式: transport_name: [sid] portal,tpgt target_name
      const match = line.match(
        /^(\w+):\s+\[(\d+)\]\s+(.+?),(\d+)\s+(.+)$/
      );
      if (!match) return null;
      return {
        transport: match[1],
        sid: match[2],
        portal: match[3],
        tpgt: match[4],
        target: match[5].replace(/\s*\(.*\)\s*$/, '').trim(),
      };
    })
    .filter(Boolean);
}

async function discover(portal) {
  const { stdout } = await execFileAsync(ISCSIADM, [
    '-m', 'discovery', '-t', 'sendtargets', '-p', portal,
  ]);
  return parseTargetRecords(stdout);
}

async function listTargets() {
  try {
    const { stdout } = await execFileAsync(ISCSIADM, ['-m', 'node']);
    return parseTargetRecords(stdout);
  } catch (err) {
    if (err.code === 21) return []; // No records found
    throw err;
  }
}

async function login(target, portal, chapUser, chapPassword) {
  const args = ['-m', 'node', '-T', target, '-p', portal];

  if (chapUser && chapPassword) {
    await execFileAsync(ISCSIADM, [
      ...args, '-o', 'update',
      '-n', 'node.session.auth.authmethod', '-v', 'CHAP',
    ]);
    await execFileAsync(ISCSIADM, [
      ...args, '-o', 'update',
      '-n', 'node.session.auth.username', '-v', chapUser,
    ]);
    await execFileAsync(ISCSIADM, [
      ...args, '-o', 'update',
      '-n', 'node.session.auth.password', '-v', chapPassword,
    ]);
  }

  await execFileAsync(ISCSIADM, [...args, '--login']);
  return true;
}

async function logout(target, portal) {
  await execFileAsync(ISCSIADM, [
    '-m', 'node', '-T', target, '-p', portal, '--logout',
  ]);
  return true;
}

async function logoutAll() {
  try {
    await execFileAsync(ISCSIADM, ['-m', 'node', '--logoutall=all']);
  } catch {
    // 没有活跃会话时会报错，忽略
  }
}

async function getSessions() {
  try {
    const { stdout } = await execFileAsync(ISCSIADM, ['-m', 'session']);
    return parseSessionList(stdout);
  } catch (err) {
    if (err.code === 21) return [];
    throw err;
  }
}

async function getSessionDetail(sid) {
  const { stdout } = await execFileAsync(ISCSIADM, [
    '-m', 'session', '-r', String(sid), '-P', '3',
  ]);
  return stdout;
}

async function getSessionDevices(sid) {
  const detail = await getSessionDetail(sid);
  const devices = [];
  const regex = /Attached scsi disk (\w+)/g;
  let match;
  while ((match = regex.exec(detail)) !== null) {
    devices.push(`/dev/${match[1]}`);
  }
  return devices;
}

async function deleteNode(target, portal) {
  try {
    await execFileAsync(ISCSIADM, [
      '-m', 'node', '-T', target, '-p', portal, '-o', 'delete',
    ]);
  } catch {
    // 节点不存在时忽略
  }
}

module.exports = {
  discover,
  listTargets,
  login,
  logout,
  logoutAll,
  getSessions,
  getSessionDetail,
  getSessionDevices,
  deleteNode,
  parseKeyValueOutput,
};
