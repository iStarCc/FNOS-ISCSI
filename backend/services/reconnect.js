const fs = require('fs');
const path = require('path');
const iscsiadm = require('./iscsiadm');
const mounter = require('./mounter');

function readConfig(pkgetc) {
  const configFile = path.join(pkgetc, 'targets.json');
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch {
    return { autoReconnect: [], targets: [] };
  }
}

async function autoReconnect(pkgetc) {
  const config = readConfig(pkgetc);
  const entries = config.autoReconnect || [];

  if (entries.length === 0) {
    console.log('No auto-reconnect targets configured');
    return;
  }

  for (const entry of entries) {
    const { portal, target, mountPoint, chapUser, chapPassword } = entry;
    try {
      console.log(`Reconnecting: ${target} @ ${portal}`);

      await iscsiadm.discover(portal);
      await iscsiadm.login(target, portal, chapUser, chapPassword);

      if (mountPoint) {
        const sessions = await iscsiadm.getSessions();
        const session = sessions.find(
          (s) => s.target === target && s.portal.startsWith(portal.split(':')[0])
        );
        if (session) {
          const devices = await iscsiadm.getSessionDevices(session.sid);
          if (devices.length > 0) {
            await mounter.mount(devices[0], mountPoint);
            console.log(`Mounted ${devices[0]} -> ${mountPoint}`);
          }
        }
      }

      console.log(`Reconnected: ${target}`);
    } catch (err) {
      console.error(`Failed to reconnect ${target}: ${err.message}`);
    }
  }
}

module.exports = { autoReconnect };
