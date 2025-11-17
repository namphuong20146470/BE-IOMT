import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requirePermission } from '../shared/middleware/rbacMiddleware.js';

// Socket 1 Data (Tang 3 PKT - Socket 1)
import {
    getAllSocket1,
    getLatestSocket1,
    addSocket1,
    getSocket11Hour,
    getSocket16Hours,
    getSocket124Hours,
    getSocket17Days,
    getSocket130Days,
    getSocket1ByDateRange
} from '../controllers/socket1/socket1.controller.js';

// Socket 2 Data (Tang 3 PKT - Socket 2)
import {
    getAllSocket2,
    getLatestSocket2,
    addSocket2,
    getSocket27Days,
    getSocket230Days,
    getSocket2ByDateRange,
    getSocket21Hour,
    getSocket26Hours,
    getSocket224Hours
} from '../controllers/socket2/socket2.controller.js';

// Socket 3 Data (Tang 3 PKT - Socket 3)
import {
    getAllSocket3,
    getLatestSocket3,
    addSocket3,
    getSocket31Hour,
    getSocket36Hours,
    getSocket324Hours,
    getSocket37Days,
    getSocket330Days,
    getSocket3ByDateRange
} from '../controllers/socket3/socket3.controller.js';

// Socket 4 Data (Tang 3 PKT - Socket 4)
import {
    getAllSocket4,
    getLatestSocket4,
    addSocket4,
    getSocket41Hour,
    getSocket46Hours,
    getSocket424Hours,
    getSocket47Days,
    getSocket430Days,
    getSocket4ByDateRange
} from '../controllers/socket4/socket4.controller.js';

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

// Socket 1 routes (Tang 3 PKT - Socket 1)
router.get('/socket1', getAllSocket1);
router.get('/socket1/latest', getLatestSocket1);
router.get('/socket1/1hour', getSocket11Hour);
router.get('/socket1/6hours', getSocket16Hours);
router.get('/socket1/24hours', getSocket124Hours);
router.get('/socket1/7days', getSocket17Days);
router.get('/socket1/30days', getSocket130Days);
router.get('/socket1/range', getSocket1ByDateRange);
router.post('/socket1', addSocket1);

// Socket 2 routes (Tang 3 PKT - Socket 2)
router.get('/socket2', getAllSocket2);
router.get('/socket2/latest', getLatestSocket2);
router.get('/socket2/1hour', getSocket21Hour);
router.get('/socket2/6hours', getSocket26Hours);
router.get('/socket2/24hours', getSocket224Hours);
router.get('/socket2/7days', getSocket27Days);
router.get('/socket2/30days', getSocket230Days);
router.get('/socket2/range', getSocket2ByDateRange);
router.post('/socket2', addSocket2);

// Socket 4 routes (Tang 3 PKT - Socket 4)
router.get('/socket4', getAllSocket4);
router.get('/socket4/latest', getLatestSocket4);
router.get('/socket4/1hour', getSocket41Hour);
router.get('/socket4/6hours', getSocket46Hours);
router.get('/socket4/24hours', getSocket424Hours);
router.get('/socket4/7days', getSocket47Days);
router.get('/socket4/30days', getSocket430Days);
router.get('/socket4/range', getSocket4ByDateRange);
router.post('/socket4', addSocket4);

// Socket 3 routes (Tang 3 PKT - Socket 3)
router.get('/socket3', getAllSocket3);
router.get('/socket3/latest', getLatestSocket3);
router.get('/socket3/1hour', getSocket31Hour);
router.get('/socket3/6hours', getSocket36Hours);
router.get('/socket3/24hours', getSocket324Hours);
router.get('/socket3/7days', getSocket37Days);
router.get('/socket3/30days', getSocket330Days);
router.get('/socket3/range', getSocket3ByDateRange);
router.post('/socket3', addSocket3);

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