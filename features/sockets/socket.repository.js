// features/sockets/socket.repository.js
import prisma from '../../config/db.js';

/**
 * Socket Repository - Handles all database operations for sockets
 */
class SocketRepository {
    async findMany(where = {}, options = {}) {
        return prisma.sockets.findMany({
            where,
            ...options
        });
    }

    async findFirst(where) {
        return prisma.sockets.findFirst({ where });
    }

    async findUnique(where, options = {}) {
        return prisma.sockets.findUnique({
            where,
            ...options
        });
    }

    async findById(id, include = {}) {
        return prisma.sockets.findUnique({
            where: { id },
            include
        });
    }

    async create(data) {
        return prisma.sockets.create({
            data,
            include: {
                pdu: { select: { id: true, name: true } },
                device: true
            }
        });
    }

    async update(id, data) {
        return prisma.sockets.update({
            where: { id },
            data: {
                ...data,
                updated_at: new Date()
            },
            include: {
                pdu: { select: { id: true, name: true } },
                device: {
                    select: {
                        id: true,
                        serial_number: true,
                        model: { select: { name: true } }
                    }
                },
                assigned_by_user: {
                    select: { username: true, full_name: true }
                }
            }
        });
    }

    async delete(id) {
        return prisma.sockets.delete({
            where: { id }
        });
    }

    async count(where = {}) {
        return prisma.sockets.count({ where });
    }

    async findAvailable(organizationId = null, departmentId = null) {
        const where = {
            device_id: null,
            is_enabled: true,
            status: { not: 'error' }
        };

        if (organizationId) {
            where.pdu = { organization_id: organizationId };
        }

        if (departmentId) {
            where.pdu = {
                ...where.pdu,
                department_id: departmentId
            };
        }

        return prisma.sockets.findMany({
            where,
            include: {
                pdu: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        location: true
                    }
                }
            },
            orderBy: [
                { pdu: { name: 'asc' } },
                { socket_number: 'asc' }
            ]
        });
    }

    async findDeviceById(deviceId) {
        return prisma.device.findUnique({
            where: { id: deviceId },
            select: {
                id: true,
                serial_number: true,
                status: true,
                organization_id: true
            }
        });
    }

    async findDeviceAssignment(deviceId) {
        return prisma.sockets.findFirst({
            where: { device_id: deviceId },
            select: {
                id: true,
                socket_number: true,
                pdu: { select: { name: true } }
            }
        });
    }

    async getSocketData(socketId, options = {}) {
        const {
            date_from,
            date_to,
            interval = 'hour',
            metrics,
            limit = 100
        } = options;

        let where = { socket_id: socketId };
        
        if (date_from || date_to) {
            where.timestamp = {};
            if (date_from) where.timestamp.gte = new Date(date_from);
            if (date_to) where.timestamp.lte = new Date(date_to);
        }

        return prisma.device_data.findMany({
            where,
            select: {
                id: true,
                data_payload: true,
                timestamp: true,
                measurements: {
                    select: { name: true, unit: true }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }

    async getSocketHistory(socketId, limit = 50) {
        // This would track assignment history
        // For now, return basic assignment info
        return prisma.sockets.findUnique({
            where: { id: socketId },
            select: {
                id: true,
                assigned_at: true,
                assigned_by: true,
                device: {
                    select: {
                        serial_number: true,
                        model: { select: { name: true } }
                    }
                },
                assigned_by_user: {
                    select: { username: true, full_name: true }
                }
            }
        });
    }

    async controlSocket(socketId, action) {
        // This would implement actual socket control
        // For now, just update status
        const validActions = ['turn_on', 'turn_off', 'reset', 'toggle'];
        if (!validActions.includes(action)) {
            throw new Error('Invalid action');
        }

        const newStatus = action === 'turn_on' ? 'active' : 
                         action === 'turn_off' ? 'inactive' : 'active';

        return this.update(socketId, { 
            status: newStatus,
            last_data_at: new Date()
        });
    }
}

export default new SocketRepository();