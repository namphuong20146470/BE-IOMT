// features/sockets/socket.service.js
import socketRepository from './socket.repository.js';
import SocketModel from './socket.model.js';
import { AppError } from '../../shared/utils/errorHandler.js';

/**
 * Socket Service - Business logic for socket operations
 */
class SocketService {
    async getAllSockets(query, user) {
        const validatedQuery = SocketModel.query.parse(query);
        const filters = this.buildFilters(validatedQuery, user);
        const { skip, take } = this.getPagination(validatedQuery);
        
        const includeOptions = this.buildIncludeOptions(validatedQuery);
        
        const [sockets, total] = await Promise.all([
            socketRepository.findMany(filters, {
                skip,
                take,
                include: includeOptions,
                orderBy: { socket_number: 'asc' }
            }),
            socketRepository.count(filters)
        ]);

        return {
            success: true,
            data: sockets,
            pagination: this.formatPagination(validatedQuery, total)
        };
    }

    async getSocketById(id, user, options = {}) {
        const include = this.buildDetailedInclude(options);
        
        const socket = await socketRepository.findById(id, include);
        if (!socket) {
            throw new AppError('Socket not found', 404);
        }

        // Check access through PDU organization
        this.checkAccess(socket, user);

        return {
            success: true,
            data: socket
        };
    }

    async updateSocket(id, data, user) {
        const validatedData = SocketModel.update.parse(data);
        
        const socket = await socketRepository.findById(id, {
            pdu: { include: { organization: true } }
        });
        
        if (!socket) {
            throw new AppError('Socket not found', 404);
        }

        this.checkAccess(socket, user);

        const updatedSocket = await socketRepository.update(id, validatedData);

        return {
            success: true,
            data: updatedSocket,
            message: 'Socket updated successfully'
        };
    }

    async assignDevice(socketId, deviceId, user, notes = null) {
        // Validate assignment
        await this.validateAssignment(socketId, deviceId);
        
        const socket = await socketRepository.findById(socketId, {
            pdu: { include: { organization: true } }
        });
        
        if (!socket) {
            throw new AppError('Socket not found', 404);
        }

        this.checkAccess(socket, user);

        if (socket.device_id) {
            throw new AppError('Socket already has a device assigned', 400);
        }

        const updatedSocket = await socketRepository.update(socketId, {
            device_id: deviceId,
            assigned_at: new Date(),
            assigned_by: user.id,
            notes
        });

        return {
            success: true,
            data: updatedSocket,
            message: 'Device assigned to socket successfully'
        };
    }

    async unassignDevice(socketId, user, notes = null) {
        const socket = await socketRepository.findById(socketId, {
            pdu: { include: { organization: true } },
            device: true
        });
        
        if (!socket) {
            throw new AppError('Socket not found', 404);
        }

        this.checkAccess(socket, user);

        if (!socket.device_id) {
            throw new AppError('Socket has no device assigned', 400);
        }

        const updatedSocket = await socketRepository.update(socketId, {
            device_id: null,
            assigned_at: null,
            assigned_by: null,
            notes
        });

        return {
            success: true,
            data: updatedSocket,
            message: 'Device unassigned from socket successfully'
        };
    }

    async getSocketData(socketId, query, user) {
        const validatedQuery = SocketModel.dataQuery.parse(query);
        
        const socket = await socketRepository.findById(socketId, {
            pdu: { include: { organization: true } }
        });
        
        if (!socket) {
            throw new AppError('Socket not found', 404);
        }

        this.checkAccess(socket, user);

        const data = await socketRepository.getSocketData(socketId, validatedQuery);
        
        return {
            success: true,
            data
        };
    }

    // Helper methods
    buildFilters(query, user) {
        let filters = {};
        
        if (query.pdu_id) {
            filters.pdu_id = query.pdu_id;
        }
        
        if (query.status) {
            filters.status = query.status;
        }
        
        if (query.assigned !== undefined) {
            filters.device_id = query.assigned ? { not: null } : null;
        }

        if (query.search) {
            filters.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { notes: { contains: query.search, mode: 'insensitive' } },
                { pdu: { name: { contains: query.search, mode: 'insensitive' } } }
            ];
        }

        // Add organization filter for non-admin users
        if (!user.permissions?.includes('system.admin')) {
            filters.pdu = {
                organization_id: user.organization_id
            };
        }

        return filters;
    }

    buildIncludeOptions(query) {
        let include = {
            pdu: {
                select: { id: true, name: true, type: true, location: true }
            }
        };

        if (query.include_device) {
            include.device = {
                include: {
                    model: { select: { name: true, manufacturer_id: true } }
                }
            };
        }

        if (query.include_data && query.include_device) {
            include.device.include.device_data_latest = {
                select: {
                    voltage: true,
                    current: true,
                    power: true,
                    power_factor: true,
                    machine_state: true,
                    socket_state: true,
                    sensor_state: true,
                    timestamp: true,
                    updated_at: true
                }
            };
        }

        return include;
    }

    buildDetailedInclude(options) {
        return {
            pdu: {
                select: { 
                    id: true, 
                    name: true, 
                    type: true, 
                    location: true,
                    organization_id: true
                }
            },
            device: options.include_device ? {
                include: {
                    model: { select: { name: true } }
                }
            } : true,
            assigned_by_user: {
                select: { username: true, full_name: true }
            },
            device_data: options.include_data ? {
                take: 20,
                orderBy: { timestamp: 'desc' }
            } : undefined
        };
    }

    async validateAssignment(socketId, deviceId) {
        // Check if device exists and is not already assigned
        const device = await socketRepository.findDeviceById(deviceId);
        if (!device) {
            throw new AppError('Device not found', 404);
        }

        // Check if device is already assigned to another socket
        const existingAssignment = await socketRepository.findDeviceAssignment(deviceId);
        if (existingAssignment) {
            throw new AppError('Device is already assigned to another socket', 400);
        }
    }

    checkAccess(socket, user) {
        if (!user.permissions?.includes('system.admin') && 
            user.organization_id !== socket.pdu.organization_id) {
            throw new AppError('Access denied: Socket belongs to different organization', 403);
        }
    }

    getPagination(query) {
        const skip = (query.page - 1) * query.limit;
        return { skip, take: query.limit };
    }

    formatPagination(query, total) {
        return {
            page: query.page,
            limit: query.limit,
            total,
            total_pages: Math.ceil(total / query.limit)
        };
    }
}

export default new SocketService();