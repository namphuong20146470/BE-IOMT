import express from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { checkPermission } from '../../shared/middleware/rbacMiddleware.js';

// Import controllers
import {
    getAllMaintenanceHistory,
    getMaintenanceById,
    createMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    getMaintenanceByDevice
} from './maintenance.controller.js';

// Import validation
import {
    createMaintenanceValidation,
    updateMaintenanceValidation,
    getMaintenanceValidation,
    deleteMaintenanceValidation,
    getMaintenanceByDeviceValidation,
    getMaintenanceListValidation
} from './maintenance.validation.js';

// Import additional controllers
import {
    getMaintenanceDashboard,
    getMaintenanceStatistics,
    exportMaintenanceReport,
    bulkCreateMaintenance,
    getUpcomingMaintenance
} from './maintenanceReports.controller.js';

import {
    createMaintenancePart,
    updateMaintenancePart,
    deleteMaintenancePart,
    getMaintenanceParts
} from './maintenanceParts.controller.js';

const router = express.Router();

// ==================== MIDDLEWARE ====================

// All maintenance routes require authentication
router.use(requireAuth);

// ==================== MAIN MAINTENANCE ROUTES ====================

/**
 * @route GET /api/maintenance/history
 * @desc Get all maintenance history with filtering and pagination
 * @access Private (requires maintenance.view permission)
 */
router.get('/history', 
    checkPermission('maintenance.view'),
    getMaintenanceListValidation,
    getAllMaintenanceHistory
);

/**
 * @route GET /api/maintenance/history/:id
 * @desc Get maintenance record by ID
 * @access Private (requires maintenance.view permission)
 */
router.get('/history/:id',
    checkPermission('maintenance.view'),
    getMaintenanceValidation,
    getMaintenanceById
);

/**
 * @route POST /api/maintenance/history
 * @desc Create new maintenance record
 * @access Private (requires maintenance.create permission)
 */
router.post('/history',
    checkPermission('maintenance.create'),
    createMaintenanceValidation,
    createMaintenanceRecord
);

/**
 * @route PUT /api/maintenance/history/:id
 * @desc Update maintenance record
 * @access Private (requires maintenance.edit permission)
 */
router.put('/history/:id',
    checkPermission('maintenance.edit'),
    updateMaintenanceValidation,
    updateMaintenanceRecord
);

/**
 * @route DELETE /api/maintenance/history/:id
 * @desc Delete maintenance record
 * @access Private (requires maintenance.delete permission)
 */
router.delete('/history/:id',
    checkPermission('maintenance.delete'),
    deleteMaintenanceValidation,
    deleteMaintenanceRecord
);

// ==================== DEVICE-SPECIFIC ROUTES ====================

/**
 * @route GET /api/maintenance/device/:deviceId/history
 * @desc Get maintenance history for specific device
 * @access Private (requires maintenance.view permission)
 */
router.get('/device/:deviceId/history',
    checkPermission('maintenance.view'),
    getMaintenanceByDeviceValidation,
    getMaintenanceByDevice
);

// ==================== DASHBOARD & ANALYTICS ROUTES ====================

/**
 * @route GET /api/maintenance/dashboard
 * @desc Get maintenance dashboard data
 * @access Private (requires maintenance.view permission)
 */
router.get('/dashboard',
    checkPermission('maintenance.view'),
    getMaintenanceDashboard
);

/**
 * @route GET /api/maintenance/statistics
 * @desc Get maintenance statistics and analytics
 * @access Private (requires maintenance.reports permission)
 */
router.get('/statistics',
    checkPermission('maintenance.reports'),
    getMaintenanceStatistics
);

/**
 * @route GET /api/maintenance/upcoming
 * @desc Get upcoming scheduled maintenance
 * @access Private (requires maintenance.view permission)
 */
router.get('/upcoming',
    checkPermission('maintenance.view'),
    getUpcomingMaintenance
);

// ==================== BULK OPERATIONS ====================

/**
 * @route POST /api/maintenance/bulk
 * @desc Create multiple maintenance records
 * @access Private (requires maintenance.create permission)
 */
router.post('/bulk',
    checkPermission('maintenance.create'),
    bulkCreateMaintenance
);

// ==================== PARTS MANAGEMENT ====================

/**
 * @route GET /api/maintenance/history/:maintenanceId/parts
 * @desc Get parts for specific maintenance record
 * @access Private (requires maintenance.view permission)
 */
router.get('/history/:maintenanceId/parts',
    checkPermission('maintenance.view'),
    getMaintenanceParts
);

/**
 * @route POST /api/maintenance/history/:maintenanceId/parts
 * @desc Add part to maintenance record
 * @access Private (requires maintenance.edit permission)
 */
router.post('/history/:maintenanceId/parts',
    checkPermission('maintenance.edit'),
    createMaintenancePart
);

/**
 * @route PUT /api/maintenance/history/:maintenanceId/parts/:partId
 * @desc Update maintenance part
 * @access Private (requires maintenance.edit permission)
 */
router.put('/history/:maintenanceId/parts/:partId',
    checkPermission('maintenance.edit'),
    updateMaintenancePart
);

/**
 * @route DELETE /api/maintenance/history/:maintenanceId/parts/:partId
 * @desc Delete maintenance part
 * @access Private (requires maintenance.edit permission)
 */
router.delete('/history/:maintenanceId/parts/:partId',
    checkPermission('maintenance.edit'),
    deleteMaintenancePart
);

// ==================== REPORTS & EXPORT ====================

/**
 * @route GET /api/maintenance/export
 * @desc Export maintenance report (Excel/PDF/CSV)
 * @access Private (requires maintenance.reports permission)
 */
router.get('/export',
    checkPermission('maintenance.reports'),
    exportMaintenanceReport
);

// ==================== FILE UPLOAD ROUTES ====================

/**
 * @route POST /api/maintenance/history/:maintenanceId/upload
 * @desc Upload maintenance photos/documents
 * @access Private (requires maintenance.edit permission)
 */
router.post('/history/:maintenanceId/upload',
    checkPermission('maintenance.edit'),
    // TODO: Add multer middleware for file upload
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'File upload functionality not yet implemented'
        });
    }
);

// ==================== COST ANALYSIS ROUTES ====================

/**
 * @route GET /api/maintenance/costs
 * @desc Get maintenance cost analysis
 * @access Private (requires maintenance.costs permission)
 */
router.get('/costs',
    checkPermission('maintenance.costs'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Cost analysis functionality not yet implemented'
        });
    }
);

/**
 * @route GET /api/maintenance/costs/device/:deviceId
 * @desc Get cost analysis for specific device
 * @access Private (requires maintenance.costs permission)
 */
router.get('/costs/device/:deviceId',
    checkPermission('maintenance.costs'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Device cost analysis functionality not yet implemented'
        });
    }
);

// ==================== APPROVAL WORKFLOW ROUTES ====================

/**
 * @route POST /api/maintenance/history/:id/approve
 * @desc Approve maintenance record
 * @access Private (requires maintenance.approve permission)
 */
router.post('/history/:id/approve',
    checkPermission('maintenance.approve'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Maintenance approval workflow not yet implemented'
        });
    }
);

/**
 * @route POST /api/maintenance/history/:id/reject
 * @desc Reject maintenance record
 * @access Private (requires maintenance.approve permission)
 */
router.post('/history/:id/reject',
    checkPermission('maintenance.approve'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Maintenance rejection workflow not yet implemented'
        });
    }
);

export default router;