// features/pdu/pdu.controller.js
import pduService from './pdu.service.js';

/**
 * Get all PDUs with filtering and pagination
 */
export const getAllPDUs = async (req, res) => {
    try {
        const result = await pduService.getAllPDUs(req.query, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching PDUs:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch PDUs',
            error: error.message
        });
    }
};

/**
 * Get PDU by ID with detailed outlet information
 */
export const getPDUById = async (req, res) => {
    try {
        const result = await pduService.getPDUById(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching PDU:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch PDU',
            error: error.message
        });
    }
};

/**
 * Create new PDU with auto-generated outlets
 */
export const createPDU = async (req, res) => {
    try {
        const result = await pduService.createPDU(req.body, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating PDU:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to create PDU',
            error: error.message
        });
    }
};

/**
 * Update PDU
 */
export const updatePDU = async (req, res) => {
    try {
        const result = await pduService.updatePDU(req.params.id, req.body, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating PDU:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update PDU',
            error: error.message
        });
    }
};

/**
 * Delete PDU (and all associated outlets)
 */
export const deletePDU = async (req, res) => {
    try {
        const result = await pduService.deletePDU(req.params.id, req.user);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting PDU:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete PDU',
            error: error.message
        });
    }
};

/**
 * Get PDU statistics and monitoring data
 */
export const getPDUStatistics = async (req, res) => {
    try {
        const { id } = req.params;
        const { timeframe = '24h' } = req.query;

        const pdu = await prisma.power_distribution_units.findUnique({
            where: { id },
            include: {
                outlets: {
                    include: {
                        device: {
                            select: {
                                serial_number: true,
                                model: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!pdu) {
            return res.status(404).json({
                success: false,
                message: 'PDU not found'
            });
        }

        // Check permissions
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organization_id !== pdu.organization_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Calculate time range for data query
        const now = new Date();
        let startTime;
        switch (timeframe) {
            case '1h': startTime = new Date(now.getTime() - 60 * 60 * 1000); break;
            case '6h': startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
            case '24h': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
            case '7d': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            default: startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Get power consumption data
        const powerData = await prisma.device_data.findMany({
            where: {
                outlet_id: { in: pdu.outlets.map(o => o.id) },
                timestamp: { gte: startTime },
                measurements: {
                    name: { in: ['power', 'voltage', 'current'] }
                }
            },
            include: {
                measurements: { select: { name: true, unit: true } },
                outlet: { select: { outlet_number: true } }
            },
            orderBy: { timestamp: 'desc' }
        });

        // Calculate statistics
        const stats = {
            pdu_info: {
                id: pdu.id,
                name: pdu.name,
                type: pdu.type,
                location: pdu.location
            },
            outlet_summary: {
                total_outlets: pdu.total_outlets,
                configured_outlets: pdu.outlets.length,
                assigned_outlets: pdu.outlets.filter(o => o.device_id).length,
                active_outlets: pdu.outlets.filter(o => o.status === 'active').length,
                idle_outlets: pdu.outlets.filter(o => o.status === 'idle').length,
                inactive_outlets: pdu.outlets.filter(o => o.status === 'inactive').length,
                error_outlets: pdu.outlets.filter(o => o.status === 'error').length
            },
            power_summary: {
                current_total_power: pdu.outlets.reduce((sum, o) => sum + (o.current_power || 0), 0),
                max_power_capacity: pdu.max_power_watts,
                power_utilization: pdu.max_power_watts > 0 ? 
                    (pdu.outlets.reduce((sum, o) => sum + (o.current_power || 0), 0) / pdu.max_power_watts * 100).toFixed(1) : 0
            },
            recent_data: powerData.slice(0, 100) // Last 100 data points
        };

        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching PDU statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch PDU statistics',
            error: error.message
        });
    }
};

/**
 * Get all outlets for a specific PDU
 */
export const getPDUOutlets = async (req, res) => {
    try {
        const { id } = req.params;
        const { include_device = false, include_data = false, status } = req.query;

        // Check if PDU exists
        const pdu = await prisma.power_distribution_units.findUnique({
            where: { id },
            select: { 
                id: true, 
                name: true, 
                organization_id: true 
            }
        });

        if (!pdu) {
            return res.status(404).json({
                success: false,
                message: 'PDU not found'
            });
        }

        // Check access permissions
        if (!req.user.permissions?.includes('system.admin') && 
            req.user.organization_id !== pdu.organization_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: PDU belongs to different organization'
            });
        }

        // Build where clause for outlets
        let whereClause = { pdu_id: id };
        if (status) {
            whereClause.status = status;
        }

        // Build include options
        const includeOptions = {};
        if (include_device) {
            includeOptions.device = {
                include: {
                    model: { select: { name: true, manufacturer_id: true } },
                    device_connectivity: { 
                        select: { mqtt_topic: true, last_connected: true, is_active: true } 
                    }
                }
            };
        }

        if (include_data) {
            includeOptions.device_data = {
                take: 10,
                orderBy: { timestamp: 'desc' },
                select: {
                    data_payload: true,
                    timestamp: true,
                    measurements: { select: { name: true, unit: true } }
                }
            };
        }

        // Get outlets
        const outlets = await prisma.outlets.findMany({
            where: whereClause,
            include: includeOptions,
            orderBy: { outlet_number: 'asc' }
        });

        return res.status(200).json({
            success: true,
            data: outlets,
            pdu: {
                id: pdu.id,
                name: pdu.name
            },
            total: outlets.length
        });

    } catch (error) {
        console.error('Error fetching PDU outlets:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch PDU outlets',
            error: error.message
        });
    }
};

// Export as default object
export default {
    getAllPDUs,
    getPDUById,
    createPDU,
    updatePDU,
    deletePDU,
    getPDUStatistics,
    getPDUOutlets
};