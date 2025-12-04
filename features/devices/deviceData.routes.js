import express from 'express';
import {
  getDeviceData,
  getDeviceDataStats,
  getDeviceDataStream,
  getDeviceCurrentState,
  simulateDeviceData,
  getMqttConnectionStatus,
  refreshMqttConnections,
  getAvailableDataTables
} from '../../controllers/deviceDataProcessor/deviceDataProcessor.controller.js';

const router = express.Router();

// Device Data Routes - RESTful structure: /devices/{deviceId}/data
router.get('/devices/:deviceId/data', getDeviceData);
router.get('/devices/:deviceId/data/stats', getDeviceDataStats);
router.get('/devices/:deviceId/data/stream', getDeviceDataStream);
router.get('/devices/:deviceId/data/current-state', getDeviceCurrentState);
router.post('/devices/:deviceId/data/simulate', simulateDeviceData);

// Alternative endpoints for different data types
router.get('/devices/:deviceId/metrics', getDeviceData);
router.get('/devices/:deviceId/logs', (req, res, next) => {
  req.query.tableName = 'device_data_logs';
  getDeviceData(req, res, next);
});

// MQTT Management Routes
router.get('/devices/mqtt/status', getMqttConnectionStatus);
router.post('/devices/mqtt/refresh', refreshMqttConnections);

// System Info Routes  
router.get('/devices/data/tables', getAvailableDataTables);

export default router;
