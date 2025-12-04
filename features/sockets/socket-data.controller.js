// features/sockets/socket-data.controller.js
import socketDataService from './socket-data.service.js';

/**
 * Socket Data Controller - MVP Implementation
 */

/**
 * Get latest socket data (optimized for dashboard)
 * GET /api/v1/sockets/{id}/data/latest
 */
export const getLatestSocketData = async (req, res) => {
    try {
        const { id: socketId } = req.params;
        const result = await socketDataService.getLatestSocketData(socketId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getLatestSocketData:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to get latest socket data',
            error: error.message
        });
    }
};

/**
 * Get socket data history with pagination
 * GET /api/v1/sockets/{id}/data/history
 */
export const getSocketDataHistory = async (req, res) => {
    try {
        const { id: socketId } = req.params;
        const {
            limit = 100,
            offset = 0,
            date_from,
            date_to,
            interval = 'raw'
        } = req.query;

        const options = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            dateFrom: date_from,
            dateTo: date_to,
            interval
        };

        const result = await socketDataService.getSocketDataHistory(socketId, options);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSocketDataHistory:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to get socket data history',
            error: error.message
        });
    }
};

/**
 * Get socket statistics and analytics
 * GET /api/v1/sockets/{id}/statistics
 */
export const getSocketStatistics = async (req, res) => {
    try {
        const { id: socketId } = req.params;
        const { timeframe = '24h' } = req.query;

        const result = await socketDataService.getSocketStatistics(socketId, timeframe);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSocketStatistics:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to get socket statistics',
            error: error.message
        });
    }
};

/**
 * Get real-time socket data (for compatibility with existing API)
 * GET /api/v1/sockets/{id}/data
 */
export const getSocketData = async (req, res) => {
    try {
        const { id: socketId } = req.params;
        const { type = 'latest' } = req.query;

        let result;
        if (type === 'history') {
            result = await socketDataService.getSocketDataHistory(socketId, {
                limit: parseInt(req.query.limit) || 100,
                offset: parseInt(req.query.offset) || 0
            });
        } else {
            result = await socketDataService.getLatestSocketData(socketId);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSocketData:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to get socket data',
            error: error.message
        });
    }
};

/**
 * Insert socket data (for MQTT/IoT integration)
 * POST /api/v1/sockets/{id}/data
 */
export const insertSocketData = async (req, res) => {
    try {
        const { id: socketId } = req.params;
        const bodyData = req.body;
        
        console.log('🔍 insertSocketData controller:', { socketId, bodyData });

        // Support two formats:
        // 1. Full format: { device_id, measurement_id, data_payload }
        // 2. MQTT format: { voltage, current, power, ... } (will auto-resolve device/measurement)
        
        let device_id, measurement_id, data_payload;
        
        if (bodyData.device_id && bodyData.measurement_id && bodyData.data_payload) {
            // Format 1: Full format
            ({ device_id, measurement_id, data_payload } = bodyData);
        } else if (bodyData.voltage !== undefined || bodyData.power !== undefined) {
            // Format 2: MQTT format - auto-resolve
            data_payload = bodyData;
            // Will be resolved in service
            device_id = null;
            measurement_id = null;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid data format. Expected either {device_id, measurement_id, data_payload} or MQTT format {voltage, current, power, ...}'
            });
        }

        const result = await socketDataService.insertSocketData(
            socketId,
            device_id,
            measurement_id,
            data_payload
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('Error in insertSocketData:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to insert socket data',
            error: error.message
        });
    }
};

/**
 * Get multiple sockets data (for PDU overview)
 * GET /api/v1/sockets/bulk/data
 */
export const getBulkSocketData = async (req, res) => {
    try {
        const { socket_ids } = req.query; // comma-separated socket IDs
        
        if (!socket_ids) {
            return res.status(400).json({
                success: false,
                message: 'socket_ids parameter is required'
            });
        }

        const socketIdList = socket_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
        
        // Get latest data for all sockets
        const results = await Promise.allSettled(
            socketIdList.map(socketId => 
                socketDataService.getLatestSocketData(socketId)
            )
        );

        const successData = [];
        const errors = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successData.push({
                    socket_id: socketIdList[index],
                    ...result.value.data
                });
            } else {
                errors.push({
                    socket_id: socketIdList[index],
                    error: result.reason?.message || 'Unknown error'
                });
            }
        });

        res.status(200).json({
            success: true,
            data: successData,
            errors: errors.length > 0 ? errors : undefined,
            total_requested: socketIdList.length,
            total_successful: successData.length,
            message: `Retrieved data for ${successData.length}/${socketIdList.length} sockets`
        });

    } catch (error) {
        console.error('Error in getBulkSocketData:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bulk socket data',
            error: error.message
        });
    }
};

// Export all functions
export default {
    getLatestSocketData,
    getSocketDataHistory,
    getSocketStatistics,
    getSocketData,
    insertSocketData,
    getBulkSocketData
};