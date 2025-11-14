// features/alerts/alerts.routes.js
import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/middleware/rbacMiddleware.js';
import * as alertsController from './alerts.controller.js';
import { validateUpdateAlertStatus } from './alerts.validation.js';

const router = express.Router();

// ====================================================================
// ALERTS ROUTES (Formalized Warning System)
// ====================================================================

// GET /alerts - Get all alerts with filtering
router.get('/alerts', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getAllAlerts
);

// GET /alerts/:id - Get alert by ID
router.get('/alerts/:id', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getAlertById
);

// GET /alerts/device/:deviceId - Get alerts for specific device
router.get('/alerts/device/:deviceId', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getAlertsByDevice
);

// GET /alerts/active - Get active alerts only
router.get('/alerts/active', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getActiveAlerts
);

// GET /alerts/statistics - Get alerts statistics
router.get('/alerts/statistics', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getAlertsStatistics
);

// PATCH /alerts/:id/status - Update alert status (acknowledge, resolve)
router.patch('/alerts/:id/status', 
    authMiddleware, 
    requirePermission('alert.update'), 
    validateUpdateAlertStatus,
    alertsController.updateAlertStatus
);

// POST /alerts/:id/acknowledge - Acknowledge alert (shorthand)
router.post('/alerts/:id/acknowledge', 
    authMiddleware, 
    requirePermission('alert.update'), 
    alertsController.acknowledgeAlert
);

// POST /alerts/:id/resolve - Resolve alert (shorthand)
router.post('/alerts/:id/resolve', 
    authMiddleware, 
    requirePermission('alert.update'), 
    alertsController.resolveAlert
);

// DELETE /alerts/:id - Delete alert (admin only)
router.delete('/alerts/:id', 
    authMiddleware, 
    requirePermission('alert.delete'), 
    alertsController.deleteAlert
);

// GET /alerts/dashboard - Get dashboard data for alerts
router.get('/alerts/dashboard', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getAlertsDashboard
);

// GET /alerts/critical - Get critical alerts requiring immediate attention
router.get('/alerts/critical', 
    authMiddleware, 
    requirePermission('alert.read'), 
    alertsController.getCriticalAlerts
);

export default router;