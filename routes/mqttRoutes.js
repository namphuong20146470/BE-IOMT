import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';

// Import MQTT device controllers
import {
    getAllMqttDevices,
    getMqttDevice,
    createMqttDevice,
    updateMqttDevice,
    deleteMqttDevice,
    activateMqttDevice,
    deactivateMqttDevice,
    getMqttDeviceData,
    getMqttStatus,
    testPublishMessage,
    publishToDevice
} from '../features/devices/mqttDevice.controller.js';

// Note: deviceConnectivity.controller.js removed - MQTT config now handled via sockets

const router = express.Router();

// ====================================================================
// MQTT DEVICE MANAGEMENT ROUTES
// ====================================================================

// Device Discovery & Management
router.get('/devices', authMiddleware, getAllMqttDevices);                    // Get all MQTT enabled devices
router.get('/devices/:deviceId', authMiddleware, getMqttDevice);              // Get specific MQTT device
router.post('/devices', authMiddleware, createMqttDevice);                    // Create/Configure MQTT for existing device
router.put('/devices/:deviceId', authMiddleware, updateMqttDevice);           // Update MQTT device configuration
router.delete('/devices/:deviceId', authMiddleware, deleteMqttDevice);        // Remove MQTT configuration

// Device State Management
router.post('/devices/:deviceId/activate', authMiddleware, activateMqttDevice);     // Activate MQTT device
router.post('/devices/:deviceId/deactivate', authMiddleware, deactivateMqttDevice); // Deactivate MQTT device
router.post('/devices/:deviceId/publish', authMiddleware, publishToDevice);         // Publish data to device
// Note: Heartbeat/connectivity status is now managed through socket-based MQTT architecture

// Data & Analytics
router.get('/devices/:deviceId/data', authMiddleware, getMqttDeviceData);     // Get device data history

// System Status & Monitoring
router.get('/status', authMiddleware, getMqttStatus);                         // Get MQTT system status

// Testing & Debugging
router.post('/test-publish', authMiddleware, testPublishMessage);             // Test publish message to device

// ====================================================================
// MQTT CONNECTIVITY NOW HANDLED VIA PDU/SOCKET CONFIGURATION
// Legacy device_connectivity routes removed - use socket endpoints instead
// ====================================================================

export default router;