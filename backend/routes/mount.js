const { Router } = require('express');
const mounter = require('../services/mounter');

const router = Router();

router.get('/devices', async (req, res) => {
  try {
    const devices = await mounter.getIscsiDevices();
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.get('/mounts', async (req, res) => {
  try {
    const mounts = await mounter.getIscsiMounts();
    res.json({ mounts });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.get('/io-stats', async (req, res) => {
  try {
    const stats = await mounter.getIoStats();
    res.json({ stats });
  } catch {
    res.json({ stats: [] });
  }
});

router.post('/mount', async (req, res) => {
  try {
    const { device, mountPoint, fsType } = req.body;
    if (!device || !mountPoint) {
      return res.status(400).json({ error: '请提供 device 和 mountPoint' });
    }
    await mounter.mount(device, mountPoint, fsType);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.post('/unmount', async (req, res) => {
  try {
    const { mountPoint } = req.body;
    if (!mountPoint) {
      return res.status(400).json({ error: '请提供 mountPoint' });
    }
    await mounter.unmount(mountPoint);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

router.post('/format', async (req, res) => {
  try {
    const { device, fsType } = req.body;
    if (!device) {
      return res.status(400).json({ error: '请提供 device' });
    }
    await mounter.formatDevice(device, fsType || 'ext4');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || err.stderr });
  }
});

module.exports = router;
