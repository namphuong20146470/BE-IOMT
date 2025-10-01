import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';

import {
    getAllAuoDisplay,
    getLatestAuoDisplay,
    addAuoDisplay,
    getAuoDisplay1Hour,
    getAuoDisplay6Hours,
    getAuoDisplay24Hours,
    getAuoDisplay7Days,
    getAuoDisplay30Days,
    getAuoDisplayByDateRange
} from '../controllers/auoDisplay/auoDisplay.controller.js';

import {
    getAllCameraControl,
    getLatestCameraControl,
    addCameraControl,
    getCameraControl7Days,
    getCameraControl30Days,
    getCameraControlByDateRange,
    getCameraControl1Hour,
    getCameraControl6Hours,
    getCameraControl24Hours
} from '../controllers/cameraControl/cameraControl.controller.js';

import {
    getAllElectronic,
    getLatestElectronic,
    addElectronic,
    getElectronic1Hour,
    getElectronic6Hours,
    getElectronic24Hours,
    getElectronic7Days,
    getElectronic30Days,
    getElectronicByDateRange
} from '../controllers/electronic/electronic.controller.js';

import {
    getAllLedNova,
    getLatestLedNova,
    addLedNova,
    getLedNova1Hour,
    getLedNova6Hours,
    getLedNova24Hours,
    getLedNova7Days,
    getLedNova30Days,
    getLedNovaByDateRange
} from '../controllers/ledNova/ledNova.controller.js';

import {
    getAllIotEnv,
    getLatestIotEnv,
    addIotEnv,
    getIotEnv1Hour,
    getIotEnv6Hours,
    getIotEnv24Hours,
    getIotEnv7Days,
    getIotEnv30Days,
    getIotEnvByDateRange
} from '../controllers/iotEnv/iotEnv.controller.js';

import {
    getAllWarningLogs,
    getLatestWarningLogs,
    getActiveWarnings,
    acknowledgeWarning,
    resolveWarning,
    getWarningStatistics,
    checkDeviceWarnings,
    deleteAllWarningLogs,
    deleteWarningById,
    testCheckWarnings
} from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
import { updateWarningStatus } from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';



// Add this import at the top with the other imports

const router = express.Router();

// AUO Display routes
router.get('/auo-display', getAllAuoDisplay);
router.get('/auo-display/latest', getLatestAuoDisplay);
router.get('/auo-display/1hour', getAuoDisplay1Hour);
router.get('/auo-display/6hours', getAuoDisplay6Hours);
router.get('/auo-display/24hours', getAuoDisplay24Hours);
router.get('/auo-display/7days', getAuoDisplay7Days);
router.get('/auo-display/30days', getAuoDisplay30Days);
router.get('/auo-display/range', getAuoDisplayByDateRange);
router.post('/auo-display', addAuoDisplay);

// Camera Control Unit routes
router.get('/camera-control', getAllCameraControl);
router.get('/camera-control/latest', getLatestCameraControl);
router.get('/camera-control/1hour', getCameraControl1Hour);
router.get('/camera-control/6hours', getCameraControl6Hours);
router.get('/camera-control/24hours', getCameraControl24Hours);
router.get('/camera-control/7days', getCameraControl7Days);
router.get('/camera-control/30days', getCameraControl30Days);
router.get('/camera-control/range', getCameraControlByDateRange);
router.post('/camera-control', addCameraControl);

// Electronic Endoflator routes
router.get('/electronic', getAllElectronic);
router.get('/electronic/latest', getLatestElectronic);
router.get('/electronic/1hour', getElectronic1Hour);
router.get('/electronic/6hours', getElectronic6Hours);
router.get('/electronic/24hours', getElectronic24Hours);
router.get('/electronic/7days', getElectronic7Days);
router.get('/electronic/30days', getElectronic30Days);
router.get('/electronic/range', getElectronicByDateRange);
router.post('/electronic', addElectronic);

// LED Nova 100 routes
router.get('/led-nova', getAllLedNova);
router.get('/led-nova/latest', getLatestLedNova);
router.get('/led-nova/1hour', getLedNova1Hour);
router.get('/led-nova/6hours', getLedNova6Hours);
router.get('/led-nova/24hours', getLedNova24Hours);
router.get('/led-nova/7days', getLedNova7Days);
router.get('/led-nova/30days', getLedNova30Days);
router.get('/led-nova/range', getLedNovaByDateRange);
router.post('/led-nova', addLedNova);

// IoT Environment Status routes
router.get('/iot-env', getAllIotEnv);
router.get('/iot-env/latest', getLatestIotEnv);
router.get('/iot-env/1hour', getIotEnv1Hour);
router.get('/iot-env/6hours', getIotEnv6Hours);
router.get('/iot-env/24hours', getIotEnv24Hours);
router.get('/iot-env/7days', getIotEnv7Days);
router.get('/iot-env/30days', getIotEnv30Days);
router.get('/iot-env/range', getIotEnvByDateRange);
router.post('/iot-env', addIotEnv);

// ========================================
// WARNING LOGS ROUTES WITH RBAC
// ========================================

// GET /warnings - Get all warning logs (with filters)
router.get('/warnings',  
    getAllWarningLogs
);

// GET /warnings/latest - Get latest warning logs
router.get('/warnings/latest', 
    authMiddleware, 
    requirePermission('device.read'), 
    getLatestWarningLogs
);

// GET /warnings/active - Get active warnings only
router.get('/warnings/active', 
    authMiddleware, 
    requirePermission('device.read'), 
    getActiveWarnings
);

// GET /warnings/statistics - Get warning statistics
router.get('/warnings/statistics', 
    authMiddleware, 
    requirePermission('device.read'), 
    getWarningStatistics
);

// PATCH /warnings/:id/status - Update warning status (MAIN ENDPOINT) ⭐
router.patch('/warnings/:id/status', 
    authMiddleware, 
    requirePermission('device.update'), 
    updateWarningStatus
);

// PUT /warnings/:id/acknowledge - Acknowledge warning (legacy)
router.put('/warnings/:id/acknowledge', 
    authMiddleware, 
    requirePermission('device.update'), 
    acknowledgeWarning
);

// PUT /warnings/:id/resolve - Resolve warning (legacy)
router.put('/warnings/:id/resolve', 
    authMiddleware, 
    requirePermission('device.update'), 
    resolveWarning
);

// POST /warnings/test - Test warning system manually
router.post('/warnings/test', 
    authMiddleware, 
    requirePermission('device.create'), 
    testCheckWarnings
);

// DELETE /warnings/:id - Delete specific warning by ID
router.delete('/warnings/:id', 
    authMiddleware, 
    requirePermission('device.delete'), 
    deleteWarningById
);

// POST /warnings/delete-all - Delete all warnings (admin only)
router.post('/warnings/delete-all', 
    authMiddleware, 
    requirePermission('system.admin'), 
    deleteAllWarningLogs
);




export default router;