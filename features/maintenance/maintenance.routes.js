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

// GET /schedules - Get maintenance schedules
router.get('/schedules', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceSchedules
);

// GET /schedules/:id - Get schedule by ID
router.get('/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceScheduleById
);

// GET /schedules/device/:deviceId - Get schedules for specific device
router.get('/schedules/device/:deviceId', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getSchedulesByDevice
);

// GET /schedules/upcoming - Get upcoming maintenance schedules
router.get('/schedules/upcoming', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getUpcomingSchedules
);

// GET /schedules/overdue - Get overdue maintenance schedules
router.get('/schedules/overdue', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getOverdueSchedules
);

// POST /schedules - Create new maintenance schedule
router.post('/schedules', 
    authMiddleware, 
    requirePermission('maintenance.create'), 
    validateCreateSchedule,
    maintenanceController.createMaintenanceSchedule
);

// PUT /schedules/:id - Update maintenance schedule
router.put('/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    validateUpdateSchedule,
    maintenanceController.updateMaintenanceSchedule
);

// DELETE /schedules/:id - Delete maintenance schedule
router.delete('/schedules/:id', 
    authMiddleware, 
    requirePermission('maintenance.delete'), 
    maintenanceController.deleteMaintenanceSchedule
);

// POST /schedules/:id/complete - Mark schedule as completed
router.post('/schedules/:id/complete', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    maintenanceController.completeMaintenanceSchedule
);

// ====================================================================
// MAINTENANCE RECORDS ROUTES
// ====================================================================

// GET /records - Get maintenance records
router.get('/records', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceRecords
);

// GET /records/:id - Get record by ID
router.get('/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceRecordById
);

// GET /records/device/:deviceId - Get records for specific device
router.get('/records/device/:deviceId', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getRecordsByDevice
);

// POST /records - Create new maintenance record
router.post('/records', 
    authMiddleware, 
    requirePermission('maintenance.create'), 
    validateCreateRecord,
    maintenanceController.createMaintenanceRecord
);

// PUT /records/:id - Update maintenance record
router.put('/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.update'), 
    maintenanceController.updateMaintenanceRecord
);

// DELETE /records/:id - Delete maintenance record
router.delete('/records/:id', 
    authMiddleware, 
    requirePermission('maintenance.delete'), 
    maintenanceController.deleteMaintenanceRecord
);

// ====================================================================
// MAINTENANCE ANALYTICS & STATISTICS
// ====================================================================

// GET /statistics - Get maintenance statistics
router.get('/statistics', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceStatistics
);

// GET /cost-analysis - Get maintenance cost analysis
router.get('/cost-analysis', 
    authMiddleware, 
    requirePermission('maintenance.read'), 
    maintenanceController.getMaintenanceCostAnalysis
);

export default router;