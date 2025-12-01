// features/pdu/pdu.controller.js
import { PrismaClient } from '@prisma/client';
import pduService from './pdu.service.js';

const prisma = new PrismaClient();

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
        const { timeframe = '24h' } = req.query;

        // Get overall PDU system statistics
        const [totalPDUs, activePDUs, pdusByType, totalOutlets, enabledOutlets, outletsByStatus] = await Promise.all([
            prisma.power_distribution_units.count(),
            prisma.power_distribution_units.count({ where: { is_active: true } }),
            prisma.power_distribution_units.groupBy({
                by: ['type'],
                _count: true
            }),
            prisma.outlets.count(),
            prisma.outlets.count({ where: { is_enabled: true } }),
            prisma.outlets.groupBy({
                by: ['status'],
                _count: true
            })
        ]);

        // Calculate time range for recent data
        const now = new Date();
        let startTime;
        switch (timeframe) {
            case '1h': startTime = new Date(now.getTime() - 60 * 60 * 1000); break;
            case '6h': startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
            case '24h': startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
            case '7d': startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            default: startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Get recent power consumption data across all PDUs
        const recentData = await prisma.device_data.findMany({
            where: {
                timestamp: { gte: startTime }
            },
            include: {
                device: {
                    include: {
                        outlet: {
                            include: {
                                pdu: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        // Calculate overall system statistics
        const systemStats = {
            pdu_summary: {
                total_pdus: totalPDUs,
                active_pdus: activePDUs,
                inactive_pdus: totalPDUs - activePDUs,
                pdu_types: pdusByType.map(group => ({
                    type: group.type,
                    count: group._count
                }))
            },
            outlet_summary: {
                total_outlets: totalOutlets,
                enabled_outlets: enabledOutlets,
                disabled_outlets: totalOutlets - enabledOutlets,
                outlet_status_breakdown: outletsByStatus.map(group => ({
                    status: group.status,
                    count: group._count
                }))
            },
            recent_activity: {
                timeframe,
                data_points: recentData.length,
                recent_measurements: recentData.slice(0, 20) // Last 20 measurements
            }
        };

        return res.status(200).json({
            success: true,
            data: systemStats
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