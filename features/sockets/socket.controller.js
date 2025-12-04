// features/sockets/socket.controller.js
import socketService from './socket.service.js';

/**
 * Get all sockets with filtering and pagination
 */
export const getAllSockets = async (req, res) => {
    try {
        const result = await socketService.getAllSockets(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching sockets:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch sockets',
            error: error.message
        });
    }
};

/**
 * Get available sockets for device assignment
 */
export const getAvailableSockets = async (req, res) => {
    try {
        const result = await socketService.getAvailableSockets(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching available sockets:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch available sockets',
            error: error.message
        });
    }
};

/**
 * Get socket by ID
 */
export const getSocketById = async (req, res) => {
    try {
        const options = {
            include_device: req.query.include_device === 'true',
            include_data: req.query.include_data === 'true',
            include_history: req.query.include_history === 'true'
        };
        
        const result = await socketService.getSocketById(req.params.id, req.user, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching socket:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch socket',
            error: error.message
        });
    }
};

/**
 * Get socket data and metrics
 */
export const getSocketData = async (req, res) => {
    try {
        const result = await socketService.getSocketData(req.params.id, req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching socket data:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch socket data',
            error: error.message
        });
    }
};

/**
 * Update socket configuration
 */
export const updateSocket = async (req, res) => {
    try {
        const result = await socketService.updateSocket(req.params.id, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating socket:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update socket',
            error: error.message
        });
    }
};

/**
 * Assign device to socket
 */
export const assignDevice = async (req, res) => {
    try {
        const { device_id, notes } = req.body;
        const result = await socketService.assignDevice(req.params.id, device_id, req.user, notes);
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
 * Unassign device from socket
 */
export const unassignDevice = async (req, res) => {
    try {
        const { notes } = req.body;
        const result = await socketService.unassignDevice(req.params.id, req.user, notes);
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
 * Transfer device between sockets
 */
export const transferDevice = async (req, res) => {
    try {
        const result = await socketService.transferDevice(req.body, req.user);
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
 * Bulk assign devices to sockets
 */
export const bulkAssignDevices = async (req, res) => {
    try {
        const result = await socketService.bulkAssignDevices(req.body, req.user);
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
 * Get socket assignment history
 */
export const getSocketHistory = async (req, res) => {
    try {
        const result = await socketService.getSocketHistory(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching socket history:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch socket history',
            error: error.message
        });
    }
};

/**
 * Control socket (turn on/off/reset)
 */
export const controlSocket = async (req, res) => {
    try {
        const result = await socketService.controlSocket(req.params.id, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error controlling socket:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to control socket',
            error: error.message
        });
    }
};

export default {
    getAllSockets,
    getAvailableSockets,
    getSocketById,
    getSocketData,
    updateSocket,
    assignDevice,
    unassignDevice,
    transferDevice,
    bulkAssignDevices,
    getSocketHistory,
    controlSocket
};