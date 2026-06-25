const { Router } = require('express');
const iscsiadm = require('../services/iscsiadm');
const scanner = require('../services/scanner');

const router = Router();

router.post('/discover', async (req, res) => {
  try {
    const { portal } = req.body;
    if (!portal) {
      return res.status(400).json({ error: '请提供 portal 地址' });
    }
    const targets = await iscsiadm.discover(portal);
    res.json({ targets });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.post('/scan', async (req, res) => {
  try {
    const hosts = await scanner.scanLocalNetwork();
    const results = await Promise.allSettled(
      hosts.map((ip) => iscsiadm.discover(`${ip}:3260`))
    );
    const allTargets = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);
    res.json({ hosts, targets: allTargets });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.get('/targets', async (req, res) => {
  try {
    const targets = await iscsiadm.listTargets();
    res.json({ targets });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

module.exports = router;
