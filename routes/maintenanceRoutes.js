import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { rbacMiddleware } from '../../middleware/rbacMiddleware.js';

// Import controllers
import {
    getAllMaintenanceHistory,
    getMaintenanceById,
    createMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    getMaintenanceByDevice
} from './maintenance.controller.js';

import {
    getDashboardSummary,
    getMaintenanceStatistics,
    getUpcomingMaintenance,
    getCostAnalysis,
    getPerformanceMetrics,
    exportMaintenanceReport
} from './maintenanceReports.controller.js';

import {
    getMaintenanceParts,
    createMaintenancePart,
    updateMaintenancePart,
    deleteMaintenancePart,
    bulkCreateParts,
    getPartsSummary
} from './maintenanceParts.controller.js';

// Import validations
import {
    validateCreateMaintenance,
    validateUpdateMaintenance,
    validateMaintenanceId,
    validateDeviceId,
    validateMaintenanceQuery,
    validateDashboardQuery,
    validateReportsQuery,
    validateCreatePart,
    validateUpdatePart,
    validatePartIds,
    validateBulkCreateParts,
    validatePartsQuery,
    uploadValidation,
    exportValidation
} from './maintenance.validation.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ==================== MAINTENANCE HISTORY ROUTES ====================

/**
 * @route   GET /api/maintenance
 * @desc    Get all maintenance history records with filtering and pagination
 * @access  Private (maintenance.view)
 */
router.get('/', 
    rbacMiddleware('maintenance.view'),
    validateMaintenanceQuery,
    getAllMaintenanceHistory
);

/**
 * @route   GET /api/maintenance/:id
 * @desc    Get specific maintenance record by ID
 * @access  Private (maintenance.view)
 */
router.get('/:id',
    rbacMiddleware('maintenance.view'),
    validateMaintenanceId,
    getMaintenanceById
);

/**
 * @route   POST /api/maintenance
 * @desc    Create new maintenance record
 * @access  Private (maintenance.create)
 */
router.post('/',
    rbacMiddleware('maintenance.create'),
    validateCreateMaintenance,
    createMaintenanceRecord
);

/**
 * @route   PUT /api/maintenance/:id
 * @desc    Update maintenance record
 * @access  Private (maintenance.edit)
 */
router.put('/:id',
    rbacMiddleware('maintenance.edit'),
    validateUpdateMaintenance,
    updateMaintenanceRecord
);

/**
 * @route   DELETE /api/maintenance/:id
 * @desc    Delete maintenance record
 * @access  Private (maintenance.delete)
 */
router.delete('/:id',
    rbacMiddleware('maintenance.delete'),
    validateMaintenanceId,
    deleteMaintenanceRecord
);

/**
 * @route   GET /api/maintenance/device/:deviceId
 * @desc    Get maintenance history for specific device
 * @access  Private (maintenance.view)
 */
router.get('/device/:deviceId',
    rbacMiddleware('maintenance.view'),
    validateDeviceId,
    validateMaintenanceQuery,
    getMaintenanceByDevice
);

// ==================== DASHBOARD & ANALYTICS ROUTES ====================

/**
 * @route   GET /api/maintenance/dashboard/summary
 * @desc    Get maintenance dashboard summary
 * @access  Private (maintenance.reports)
 */
router.get('/dashboard/summary',
    rbacMiddleware('maintenance.reports'),
    validateDashboardQuery,
    getDashboardSummary
);

/**
 * @route   GET /api/maintenance/dashboard/statistics
 * @desc    Get maintenance statistics and charts data
 * @access  Private (maintenance.reports)
 */
router.get('/dashboard/statistics',
    rbacMiddleware('maintenance.reports'),
    validateDashboardQuery,
    getMaintenanceStatistics
);

/**
 * @route   GET /api/maintenance/dashboard/upcoming
 * @desc    Get upcoming maintenance schedules
 * @access  Private (maintenance.view)
 */
router.get('/dashboard/upcoming',
    rbacMiddleware('maintenance.view'),
    validateDashboardQuery,
    getUpcomingMaintenance
);

/**
 * @route   GET /api/maintenance/analytics/costs
 * @desc    Get maintenance cost analysis
 * @access  Private (maintenance.costs)
 */
router.get('/analytics/costs',
    rbacMiddleware('maintenance.costs'),
    validateReportsQuery,
    getCostAnalysis
);

/**
 * @route   GET /api/maintenance/analytics/performance
 * @desc    Get maintenance performance metrics
 * @access  Private (maintenance.reports)
 */
router.get('/analytics/performance',
    rbacMiddleware('maintenance.reports'),
    validateReportsQuery,
    getPerformanceMetrics
);

// ==================== MAINTENANCE PARTS ROUTES ====================

/**
 * @route   GET /api/maintenance/:maintenanceId/parts
 * @desc    Get all parts for a maintenance record
 * @access  Private (maintenance.view)
 */
router.get('/:maintenanceId/parts',
    rbacMiddleware('maintenance.view'),
    getMaintenanceParts
);

/**
 * @route   POST /api/maintenance/:maintenanceId/parts
 * @desc    Add part to maintenance record
 * @access  Private (maintenance.edit)
 */
router.post('/:maintenanceId/parts',
    rbacMiddleware('maintenance.edit'),
    validateCreatePart,
    createMaintenancePart
);

/**
 * @route   PUT /api/maintenance/:maintenanceId/parts/:partId
 * @desc    Update maintenance part
 * @access  Private (maintenance.edit)
 */
router.put('/:maintenanceId/parts/:partId',
    rbacMiddleware('maintenance.edit'),
    validateUpdatePart,
    updateMaintenancePart
);

/**
 * @route   DELETE /api/maintenance/:maintenanceId/parts/:partId
 * @desc    Delete maintenance part
 * @access  Private (maintenance.edit)
 */
router.delete('/:maintenanceId/parts/:partId',
    rbacMiddleware('maintenance.edit'),
    validatePartIds,
    deleteMaintenancePart
);

/**
 * @route   POST /api/maintenance/:maintenanceId/parts/bulk
 * @desc    Bulk create multiple parts for maintenance
 * @access  Private (maintenance.edit)
 */
router.post('/:maintenanceId/parts/bulk',
    rbacMiddleware('maintenance.edit'),
    validateBulkCreateParts,
    bulkCreateParts
);

/**
 * @route   GET /api/maintenance/parts/summary
 * @desc    Get parts usage summary and analytics
 * @access  Private (maintenance.reports)
 */
router.get('/parts/summary',
    rbacMiddleware('maintenance.reports'),
    validatePartsQuery,
    getPartsSummary
);

// ==================== REPORTS & EXPORT ROUTES ====================

/**
 * @route   GET /api/maintenance/reports/export
 * @desc    Export maintenance data in various formats
 * @access  Private (maintenance.reports)
 */
router.get('/reports/export',
    rbacMiddleware('maintenance.reports'),
    exportValidation,
    exportMaintenanceReport
);

// ==================== FILE MANAGEMENT ROUTES (Future Implementation) ====================

/**
 * @route   POST /api/maintenance/:maintenanceId/files
 * @desc    Upload file attachment to maintenance record
 * @access  Private (maintenance.edit)
 * @note    Implementation pending - requires file upload middleware
 */
router.post('/:maintenanceId/files',
    rbacMiddleware('maintenance.edit'),
    uploadValidation,
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'File upload functionality not yet implemented',
            note: 'This endpoint will support image, document, and report uploads'
        });
    }
);

/**
 * @route   GET /api/maintenance/:maintenanceId/files
 * @desc    Get file attachments for maintenance record
 * @access  Private (maintenance.view)
 * @note    Implementation pending
 */
router.get('/:maintenanceId/files',
    rbacMiddleware('maintenance.view'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'File listing functionality not yet implemented'
        });
    }
);

/**
 * @route   DELETE /api/maintenance/:maintenanceId/files/:fileId
 * @desc    Delete file attachment from maintenance record
 * @access  Private (maintenance.edit)
 * @note    Implementation pending
 */
router.delete('/:maintenanceId/files/:fileId',
    rbacMiddleware('maintenance.edit'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'File deletion functionality not yet implemented'
        });
    }
);

// ==================== APPROVAL WORKFLOW ROUTES (Future Implementation) ====================

/**
 * @route   POST /api/maintenance/:maintenanceId/approve
 * @desc    Approve maintenance record
 * @access  Private (maintenance.approve)
 * @note    Implementation pending - requires approval workflow
 */
router.post('/:maintenanceId/approve',
    rbacMiddleware('maintenance.approve'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Maintenance approval functionality not yet implemented',
            note: 'This will handle supervisor/manager approval workflow'
        });
    }
);

/**
 * @route   POST /api/maintenance/:maintenanceId/reject
 * @desc    Reject maintenance record
 * @access  Private (maintenance.approve)
 * @note    Implementation pending
 */
router.post('/:maintenanceId/reject',
    rbacMiddleware('maintenance.approve'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Maintenance rejection functionality not yet implemented'
        });
    }
);

// ==================== NOTIFICATION ROUTES (Future Implementation) ====================

/**
 * @route   GET /api/maintenance/notifications/settings
 * @desc    Get maintenance notification settings
 * @access  Private (maintenance.view)
 * @note    Implementation pending
 */
router.get('/notifications/settings',
    rbacMiddleware('maintenance.view'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Notification settings functionality not yet implemented',
            note: 'This will manage email/SMS notifications for maintenance events'
        });
    }
);

/**
 * @route   PUT /api/maintenance/notifications/settings
 * @desc    Update maintenance notification settings
 * @access  Private (maintenance.edit)
 * @note    Implementation pending
 */
router.put('/notifications/settings',
    rbacMiddleware('maintenance.edit'),
    (req, res) => {
        res.status(501).json({
            success: false,
            message: 'Notification settings update not yet implemented'
        });
    }
);

export default router;