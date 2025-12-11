// features/maintenance/maintenance-logs.controller.js
import maintenanceService from './maintenance.service.js';

/**
 * Maintenance Logs Controller - HTTP handlers for maintenance history
 */

/**
 * POST /api/v1/maintenance-logs
 * Create new maintenance log
 */
export const createMaintenanceLog = async (req, res) => {
    try {
        const result = await maintenanceService.createMaintenanceLog(req.body, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error in createMaintenanceLog:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create maintenance log'
        });
    }
};

/**
 * GET /api/v1/maintenance-logs
 * Get all maintenance logs with filters
 */
export const getAllMaintenanceLogs = async (req, res) => {
    try {
        const result = await maintenanceService.getAllMaintenanceLogs(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAllMaintenanceLogs:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch maintenance logs'
        });
    }
};

/**
 * GET /api/v1/maintenance-logs/:id
 * Get maintenance log by ID
 */
export const getMaintenanceLog = async (req, res) => {
    try {
        const options = {
            include_jobs: req.query.include_jobs === 'true',
            include_parts: req.query.include_parts === 'true'
        };
        
        const result = await maintenanceService.getMaintenanceLog(req.params.id, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getMaintenanceLog:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch maintenance log'
        });
    }
};

/**
 * PATCH /api/v1/maintenance-logs/:id
 * Update maintenance log
 */
export const updateMaintenanceLog = async (req, res) => {
    try {
        const result = await maintenanceService.updateMaintenanceLog(
            req.params.id,
            req.body,
            req.user
        );
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateMaintenanceLog:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update maintenance log'
        });
    }
};

/**
 * DELETE /api/v1/maintenance-logs/:id
 * Delete maintenance log
 */
export const deleteMaintenanceLog = async (req, res) => {
    try {
        const result = await maintenanceService.deleteMaintenanceLog(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in deleteMaintenanceLog:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete maintenance log'
        });
    }
};

/**
 * POST /api/v1/maintenance-logs/:id/jobs
 * Create maintenance job
 */
export const createMaintenanceJob = async (req, res) => {
    try {
        const jobData = {
            ...req.body,
            maintenance_id: req.params.id
        };
        
        const result = await maintenanceService.createMaintenanceJob(jobData, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error in createMaintenanceJob:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create maintenance job'
        });
    }
};

/**
 * GET /api/v1/maintenance-logs/statistics
 * Get maintenance statistics
 */
export const getStatistics = async (req, res) => {
    try {
        const filters = {
            organization_id: req.query.organization_id,
            start_date: req.query.start_date,
            end_date: req.query.end_date
        };
        
        const result = await maintenanceService.getStatistics(filters, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getStatistics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch statistics'
        });
    }
};

/**
 * GET /api/v1/maintenance-logs/device/:deviceId/history
 * Get device maintenance history
 */
export const getDeviceHistory = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const result = await maintenanceService.getDeviceHistory(req.params.deviceId, limit);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getDeviceHistory:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch device history'
        });
    }
};

/**
 * GET /api/v1/maintenance-logs/device/:deviceId/current-metrics
 * Capture current device metrics
 */
export const captureCurrentMetrics = async (req, res) => {
    try {
        const result = await maintenanceService.captureCurrentMetrics(req.params.deviceId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in captureCurrentMetrics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to capture current metrics'
        });
    }
};

export default {
    createMaintenanceLog,
    getAllMaintenanceLogs,
    getMaintenanceLog,
    updateMaintenanceLog,
    deleteMaintenanceLog,
    createMaintenanceJob,
    getStatistics,
    getDeviceHistory,
    captureCurrentMetrics
};
