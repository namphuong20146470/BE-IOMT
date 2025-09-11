import express from 'express';
import {
  getDeviceData,
  getDeviceDataStats,
  getDeviceDataStream,
  simulateDeviceData,
  getMqttConnectionStatus,
  refreshMqttConnections,
  getAvailableDataTables
} from '../controllers/deviceDataProcessor/deviceDataProcessor.controller.js';

const router = express.Router();

// Device Data Routes
router.get('/device-data/:deviceId', getDeviceData);
router.get('/device-data/:deviceId/stats', getDeviceDataStats);
router.get('/device-data/:deviceId/stream', getDeviceDataStream);
router.post('/device-data/:deviceId/simulate', simulateDeviceData);

// MQTT Management Routes
router.get('/mqtt/status', getMqttConnectionStatus);
router.post('/mqtt/refresh', refreshMqttConnections);

// System Info Routes
router.get('/tables', getAvailableDataTables);

export default router;
