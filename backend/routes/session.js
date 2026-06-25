const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const iscsiadm = require('../services/iscsiadm');

const router = Router();

const PKGETC = process.env.TRIM_PKGETC || path.join(__dirname, '..', 'etc');
const CONFIG_FILE = path.join(PKGETC, 'targets.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { autoReconnect: [], targets: [] };
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function addAutoReconnect(target, portal, chapUser, chapPassword) {
  const config = readConfig();
  const list = config.autoReconnect || [];
  const exists = list.some((e) => e.target === target && e.portal === portal);
  if (!exists) {
    list.push({ target, portal, chapUser, chapPassword });
    config.autoReconnect = list;
    writeConfig(config);
  }
}

function removeAutoReconnect(target, portal) {
  const config = readConfig();
  const list = config.autoReconnect || [];
  const idx = list.findIndex((e) => e.target === target && e.portal === portal);
  if (idx !== -1) {
    list.splice(idx, 1);
    config.autoReconnect = list;
    writeConfig(config);
  }
}

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await iscsiadm.getSessions();
    const detailed = await Promise.all(
      sessions.map(async (s) => {
        try {
          const devices = await iscsiadm.getSessionDevices(s.sid);
          return { ...s, devices };
        } catch {
          return { ...s, devices: [] };
        }
      })
    );
    res.json({ sessions: detailed });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.post('/targets/:target/login', async (req, res) => {
  try {
    const { target } = req.params;
    const { portal, chapUser, chapPassword, autoReconnect } = req.body;
    if (!portal) {
      return res.status(400).json({ error: '请提供 portal 地址' });
    }
    await iscsiadm.login(target, portal, chapUser, chapPassword);
    if (autoReconnect) {
      addAutoReconnect(target, portal, chapUser, chapPassword);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.post('/targets/:target/logout', async (req, res) => {
  try {
    const { target } = req.params;
    const { portal, removeAutoReconnect: removeAR } = req.body;
    if (!portal) {
      return res.status(400).json({ error: '请提供 portal 地址' });
    }
    await iscsiadm.logout(target, portal);
    if (removeAR) {
      removeAutoReconnect(target, portal);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.delete('/sessions/:sid', async (req, res) => {
  try {
    const sessions = await iscsiadm.getSessions();
    const session = sessions.find((s) => s.sid === req.params.sid);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    await iscsiadm.logout(session.target, session.portal);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

module.exports = router;
