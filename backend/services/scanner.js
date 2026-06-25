const net = require('net');
const os = require('os');

function getLocalSubnets() {
  const ifaces = os.networkInterfaces();
  const subnets = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const parts = iface.address.split('.');
      if (parts.length === 4) {
        subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }
  return [...new Set(subnets)];
}

function checkPort(ip, port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(ip); });
    socket.once('timeout', () => { socket.destroy(); resolve(null); });
    socket.once('error', () => { socket.destroy(); resolve(null); });
    socket.connect(port, ip);
  });
}

async function scanSubnet(subnet, port = 3260, batchSize = 80) {
  const hosts = [];
  const ips = [];
  for (let i = 1; i <= 254; i++) ips.push(`${subnet}.${i}`);

  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((ip) => checkPort(ip, port)));
    for (const ip of results) {
      if (ip) hosts.push(ip);
    }
  }
  return hosts;
}

async function scanLocalNetwork(port = 3260) {
  const subnets = getLocalSubnets();
  if (!subnets.length) return [];

  const allHosts = [];
  for (const subnet of subnets) {
    const hosts = await scanSubnet(subnet, port);
    allHosts.push(...hosts);
  }
  return allHosts;
}

module.exports = { scanLocalNetwork, getLocalSubnets };
