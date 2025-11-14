// features/maintenance/maintenance.routes.js
import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/middleware/rbacMiddleware.js';
import * as maintenanceController from './maintenance.controller.js';
import { 
    validateCreateSchedule, 
    validateUpdateSchedule, 
    validateCreateRecord 
} from './maintenance.validation.js';

const router = express.Router();

// ====================================================================
// MAINTENANCE SCHEDULES ROUTES
// ====================================================================

// GET /maintenance/schedules - Get maintenance schedules
router.get('/maintenance/schedules', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceSchedules
);

// GET /maintenance/schedules/:id - Get schedule by ID
router.get('/maintenance/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceScheduleById
);

// GET /maintenance/schedules/device/:deviceId - Get schedules for specific device
router.get('/maintenance/schedules/device/:deviceId', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getSchedulesByDevice
);

// GET /maintenance/schedules/upcoming - Get upcoming maintenance schedules
router.get('/maintenance/schedules/upcoming', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getUpcomingSchedules
);

// GET /maintenance/schedules/overdue - Get overdue maintenance schedules
router.get('/maintenance/schedules/overdue', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getOverdueSchedules
);

// POST /maintenance/schedules - Create new maintenance schedule
router.post('/maintenance/schedules', 
    authMiddleware, 
    requirePermission('maintenance.create'), 
    validateCreateSchedule,
    maintenanceController.createMaintenanceSchedule
);

// PUT /maintenance/schedules/:id - Update maintenance schedule
router.put('/maintenance/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    validateUpdateSchedule,
    maintenanceController.updateMaintenanceSchedule
);

// DELETE /maintenance/schedules/:id - Delete maintenance schedule
router.delete('/maintenance/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.delete'), 
    maintenanceController.deleteMaintenanceSchedule
);

// POST /maintenance/schedules/:id/complete - Mark schedule as completed
router.post('/maintenance/schedules/:id/complete', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    maintenanceController.completeMaintenanceSchedule
);

// ====================================================================
// MAINTENANCE RECORDS ROUTES
// ====================================================================

// GET /maintenance/records - Get maintenance records
router.get('/maintenance/records', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceRecords
);

// GET /maintenance/records/:id - Get record by ID
router.get('/maintenance/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceRecordById
);

// GET /maintenance/records/device/:deviceId - Get records for specific device
router.get('/maintenance/records/device/:deviceId', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getRecordsByDevice
);

// POST /maintenance/records - Create new maintenance record
router.post('/maintenance/records', 
    authMiddleware, 
    requirePermission('maintenance.create'), 
    validateCreateRecord,
    maintenanceController.createMaintenanceRecord
);

// PUT /maintenance/records/:id - Update maintenance record
router.put('/maintenance/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    maintenanceController.updateMaintenanceRecord
);

// DELETE /maintenance/records/:id - Delete maintenance record
router.delete('/maintenance/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.delete'), 
    maintenanceController.deleteMaintenanceRecord
);

// ====================================================================
// MAINTENANCE ANALYTICS & STATISTICS
// ====================================================================

// GET /maintenance/statistics - Get maintenance statistics
router.get('/maintenance/statistics', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceStatistics
);

// GET /maintenance/cost-analysis - Get maintenance cost analysis
router.get('/maintenance/cost-analysis', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceCostAnalysis
);

export default router;