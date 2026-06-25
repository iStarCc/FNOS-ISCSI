const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

async function getMounts() {
  try {
    const { stdout } = await execFileAsync('findmnt', [
      '-J', '-t', 'ext4,ext3,xfs,btrfs,ntfs,vfat', '-o',
      'SOURCE,TARGET,FSTYPE,SIZE,USED,AVAIL,USE%',
    ]);
    const data = JSON.parse(stdout);
    return (data.filesystems || []).filter(
      (f) => f.source && f.source.startsWith('/dev/')
    );
  } catch {
    return [];
  }
}

async function getIscsiDiskNames() {
  try {
    const entries = await fs.promises.readdir('/dev/disk/by-path');
    const iscsiLinks = entries.filter((e) => e.includes('iscsi'));
    const names = new Set();
    for (const link of iscsiLinks) {
      const target = await fs.promises.readlink(path.join('/dev/disk/by-path', link));
      const resolved = path.resolve('/dev/disk/by-path', target);
      const devName = path.basename(resolved);
      const diskName = devName.replace(/\d+$/, '');
      names.add(diskName);
    }
    return [...names];
  } catch {
    return [];
  }
}

function getMountpoint(d) {
  if (d.mountpoint) return d.mountpoint;
  if (Array.isArray(d.mountpoints)) return d.mountpoints.find(Boolean) || null;
  return null;
}

function collectAllMountpoints(node) {
  const mps = [];
  const mp = getMountpoint(node);
  if (mp) mps.push(mp);
  if (node.children) {
    for (const child of node.children) {
      mps.push(...collectAllMountpoints(child));
    }
  }
  return mps;
}

function findNode(nodes, name) {
  for (const node of nodes) {
    if (node.name === name) return node;
    if (node.children) {
      const found = findNode(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

async function getIscsiDevices() {
  const iscsiNames = await getIscsiDiskNames();
  if (!iscsiNames.length) return [];

  const { stdout } = await execFileAsync('lsblk', [
    '-J', '-b', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL',
  ]);
  const data = JSON.parse(stdout);
  const tree = data.blockdevices || [];

  const managedByFnos = (mp) => /^\/vol\d+/.test(mp);

  return iscsiNames.map((name) => {
    const disk = findNode(tree, name);
    if (!disk) return null;

    const diskMp = getMountpoint(disk);
    const allMps = collectAllMountpoints(disk);
    const parts = (disk.children || []).filter((c) => c.type === 'part');

    return {
      name: disk.name,
      size: disk.size,
      fstype: disk.fstype,
      mountpoint: diskMp || allMps[0] || null,
      model: disk.model,
      managed: allMps.some(managedByFnos),
      partitions: parts.map((p) => {
        const partMp = getMountpoint(p);
        const partMps = collectAllMountpoints(p);
        return {
          name: p.name,
          size: p.size,
          fstype: p.fstype,
          mountpoint: partMp || partMps[0] || null,
          managed: partMps.some(managedByFnos),
        };
      }),
    };
  }).filter(Boolean);
}

async function getIscsiMounts() {
  const iscsiNames = await getIscsiDiskNames();
  if (!iscsiNames.length) return [];

  const allMounts = await getMounts();
  return allMounts.filter((m) => {
    const src = (m.source || '').replace('/dev/', '');
    return iscsiNames.some((n) => src === n || src.startsWith(n));
  });
}

async function mount(device, mountPoint, fsType) {
  await fs.promises.mkdir(mountPoint, { recursive: true });
  const args = [device, mountPoint];
  if (fsType) args.unshift('-t', fsType);
  await execFileAsync('mount', args);
  return true;
}

async function unmount(mountPoint) {
  await execFileAsync('umount', [mountPoint]);
  return true;
}

async function formatDevice(device, fsType = 'ext4') {
  await execFileAsync(`mkfs.${fsType}`, [device]);
  return true;
}

async function getIoStats() {
  const iscsiNames = await getIscsiDiskNames();
  if (!iscsiNames.length) return [];

  const sample = async () => {
    const content = await fs.promises.readFile('/proc/diskstats', 'utf8');
    const stats = {};
    for (const line of content.split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p.length < 14 || !iscsiNames.includes(p[2])) continue;
      stats[p[2]] = {
        reads: parseInt(p[3]),
        sectorsRead: parseInt(p[5]),
        writes: parseInt(p[7]),
        sectorsWritten: parseInt(p[9]),
        iosInProgress: parseInt(p[11]),
      };
    }
    return stats;
  };

  const t1 = await sample();
  await new Promise((r) => setTimeout(r, 1000));
  const t2 = await sample();

  return iscsiNames.map((name) => {
    const a = t1[name], b = t2[name];
    if (!a || !b) return { name, readSpeed: 0, writeSpeed: 0, iops: 0, iosInProgress: 0 };
    return {
      name,
      readSpeed: (b.sectorsRead - a.sectorsRead) * 512,
      writeSpeed: (b.sectorsWritten - a.sectorsWritten) * 512,
      iops: (b.reads - a.reads) + (b.writes - a.writes),
      iosInProgress: b.iosInProgress,
    };
  });
}

module.exports = {
  getMounts,
  getIscsiMounts,
  getIscsiDevices,
  getIoStats,
  mount,
  unmount,
  formatDevice,
};
