// features/outlets/outlet.controller.js
import outletService from './outlet.service.js';

/**
 * Get all outlets with filtering and pagination
 */
export const getAllOutlets = async (req, res) => {
    try {
        const result = await outletService.getAllOutlets(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching outlets:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch outlets',
            error: error.message
        });
    }
};

/**
 * Get available outlets for device assignment
 */
export const getAvailableOutlets = async (req, res) => {
    try {
        const result = await outletService.getAvailableOutlets(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching available outlets:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch available outlets',
            error: error.message
        });
    }
};

/**
 * Get outlet by ID
 */
export const getOutletById = async (req, res) => {
    try {
        const options = {
            include_device: req.query.include_device === 'true',
            include_data: req.query.include_data === 'true',
            include_history: req.query.include_history === 'true'
        };
        
        const result = await outletService.getOutletById(req.params.id, req.user, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching outlet:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch outlet',
            error: error.message
        });
    }
};

/**
 * Get outlet data and metrics
 */
export const getOutletData = async (req, res) => {
    try {
        const result = await outletService.getOutletData(req.params.id, req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching outlet data:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch outlet data',
            error: error.message
        });
    }
};

/**
 * Update outlet configuration
 */
export const updateOutlet = async (req, res) => {
    try {
        const result = await outletService.updateOutlet(req.params.id, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating outlet:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update outlet',
            error: error.message
        });
    }
};

/**
 * Assign device to outlet
 */
export const assignDevice = async (req, res) => {
    try {
        const { device_id, notes } = req.body;
        const result = await outletService.assignDevice(req.params.id, device_id, req.user, notes);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error assigning device:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to assign device',
            error: error.message
        });
    }
};

/**
 * Unassign device from outlet
 */
export const unassignDevice = async (req, res) => {
    try {
        const { notes } = req.body;
        const result = await outletService.unassignDevice(req.params.id, req.user, notes);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error unassigning device:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to unassign device',
            error: error.message
        });
    }
};

/**
 * Transfer device between outlets
 */
export const transferDevice = async (req, res) => {
    try {
        const result = await outletService.transferDevice(req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error transferring device:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to transfer device',
            error: error.message
        });
    }
};

/**
 * Bulk assign devices to outlets
 */
export const bulkAssignDevices = async (req, res) => {
    try {
        const result = await outletService.bulkAssignDevices(req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error bulk assigning devices:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to bulk assign devices',
            error: error.message
        });
    }
};

/**
 * Get outlet assignment history
 */
export const getOutletHistory = async (req, res) => {
    try {
        const result = await outletService.getOutletHistory(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching outlet history:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch outlet history',
            error: error.message
        });
    }
};

/**
 * Control outlet (turn on/off/reset)
 */
export const controlOutlet = async (req, res) => {
    try {
        const result = await outletService.controlOutlet(req.params.id, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error controlling outlet:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to control outlet',
            error: error.message
        });
    }
};

export default {
    getAllOutlets,
    getAvailableOutlets,
    getOutletById,
    getOutletData,
    updateOutlet,
    assignDevice,
    unassignDevice,
    transferDevice,
    bulkAssignDevices,
    getOutletHistory,
    controlOutlet
};