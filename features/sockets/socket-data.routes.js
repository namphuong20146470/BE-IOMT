// features/sockets/socket-data.routes.js
import express from 'express';
import socketDataController from './socket-data.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Socket Data API Routes - MVP Implementation
 * Base path: /api/v1/sockets
 */

// Get latest socket data (optimized for dashboard)
router.get('/:id/data/latest', 
    requirePermission('device.read'), 
    socketDataController.getLatestSocketData
);

// Get socket data history with pagination
router.get('/:id/data/history', 
    requirePermission('device.read'), 
    socketDataController.getSocketDataHistory
);

// Get socket statistics
router.get('/:id/statistics', 
    requirePermission('device.read'), 
    socketDataController.getSocketStatistics
);

// Generic socket data endpoint (backward compatibility)
router.get('/:id/data', 
    requirePermission('device.read'), 
    socketDataController.getSocketData
);

// Insert socket data (for MQTT/IoT integration)
router.post('/:id/data', 
    requirePermission('device.manage'), 
    socketDataController.insertSocketData
);

// Bulk socket data endpoint (for PDU overview)
router.get('/bulk/data', 
    requirePermission('device.read'), 
    socketDataController.getBulkSocketData
);

export default router;