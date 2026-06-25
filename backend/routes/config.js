const { Router } = require('express');
const fs = require('fs');
const path = require('path');

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

router.get('/config', (req, res) => {
  res.json(readConfig());
});

router.put('/config', (req, res) => {
  try {
    const config = req.body;
    writeConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
