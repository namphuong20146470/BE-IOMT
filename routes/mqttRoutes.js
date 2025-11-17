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
} from '../controllers/devices/mqttDevice.controller.js';

// Import device connectivity controllers (from features)
import {
    getDeviceConnectivity,
    getAllDeviceConnectivities,
    createDeviceConnectivity,
    updateDeviceConnectivity,
    updateLastConnected,
    deleteDeviceConnectivity,
    getConnectivityStatistics
} from '../features/devices/deviceConnectivity.controller.js';

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
router.put('/devices/:deviceId/heartbeat', authMiddleware, updateLastConnected);    // Update last connected timestamp

// Data & Analytics
router.get('/devices/:deviceId/data', authMiddleware, getMqttDeviceData);     // Get device data history

// System Status & Monitoring
router.get('/status', authMiddleware, getMqttStatus);                         // Get MQTT system status
router.get('/statistics', authMiddleware, getConnectivityStatistics);         // Get connectivity statistics

// Testing & Debugging
router.post('/test-publish', authMiddleware, testPublishMessage);             // Test publish message to device

// ====================================================================
// LEGACY DEVICE CONNECTIVITY ROUTES (for backward compatibility)
// ====================================================================

// Legacy connectivity endpoints
router.get('/connectivity', authMiddleware, getAllDeviceConnectivities);      // Get all connectivities
router.get('/connectivity/:deviceId', authMiddleware, getDeviceConnectivity); // Get device connectivity
router.post('/connectivity', authMiddleware, createDeviceConnectivity);       // Create connectivity
router.put('/connectivity/:id', authMiddleware, updateDeviceConnectivity);    // Update connectivity
router.delete('/connectivity/:id', authMiddleware, deleteDeviceConnectivity); // Delete connectivity

export default router;