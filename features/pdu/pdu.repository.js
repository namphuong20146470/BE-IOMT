// features/pdu/pdu.repository.js
import prisma from '../../config/db.js';

/**
 * PDU Repository - Handles all database operations for PDUs
 */
class PduRepository {
    async findMany(where = {}, options = {}) {
        return prisma.power_distribution_units.findMany({
            where,
            ...options
        });
    }

    async findFirst(where) {
        return prisma.power_distribution_units.findFirst({ where });
    }

    async findUnique(where, options = {}) {
        return prisma.power_distribution_units.findUnique({
            where,
            ...options
        });
    }

    async findById(id, include = {}) {
        return prisma.power_distribution_units.findUnique({
            where: { id },
            include
        });
    }

    async create(data) {
        return prisma.power_distribution_units.create({
            data,
            include: {
                organization: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                sockets: {
                    select: {
                        id: true,
                        socket_number: true,
                        name: true,
                        status: true
                    },
                    orderBy: { socket_number: 'asc' }
                }
            }
        });
    }

    async createWithSockets(pduData) {
        return prisma.$transaction(async (tx) => {
            // Create PDU
            const pdu = await tx.power_distribution_units.create({
                data: pduData
            });

            // Auto-create sockets based on total_sockets
            const sockets = [];
            for (let i = 1; i <= pduData.total_sockets; i++) {
                const socket = await tx.sockets.create({
                    data: {
                        pdu_id: pdu.id,
                        socket_number: i,
                        name: `Socket ${i}`,
                        mqtt_topic_suffix: `socket${i}`,
                        status: 'inactive',
                        is_enabled: true,
                        display_order: i
                    }
                });
                sockets.push(socket);
            }

            return { pdu, sockets };
        });
    }

    async update(id, data) {
        return prisma.power_distribution_units.update({
            where: { id },
            data,
            include: {
                organization: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                sockets: {
                    select: {
                        id: true,
                        socket_number: true,
                        status: true,
                        device_id: true
                    },
                    orderBy: { socket_number: 'asc' }
                }
            }
        });
    }

    async delete(id) {
        return prisma.power_distribution_units.delete({
            where: { id }
        });
    }

    async count(where = {}) {
        return prisma.power_distribution_units.count({ where });
    }

    async getPDUSockets(pduId, filters = {}, include = {}) {
        return prisma.sockets.findMany({
            where: {
                pdu_id: pduId,
                ...filters
            },
            include,
            orderBy: { socket_number: 'asc' }
        });
    }

    async getPDUStatistics(pduId, timeframe = '24h') {
        // This would implement complex statistics queries
        // For now, return basic structure
        return {
            pdu_id: pduId,
            timeframe,
            // Add actual statistics implementation here
        };
    }

    /**
     * Find PDU by name in organization (for uniqueness check)
     */
    async findByNameInOrganization(name, organizationId, excludeId = null) {
        const whereClause = {
            name,
            organization_id: organizationId
        };
        
        if (excludeId) {
            whereClause.id = { not: excludeId };
        }
        
        return prisma.power_distribution_units.findFirst({
            where: whereClause
        });
    }

    /**
     * Find PDUs accessible to the user with filtering and pagination
     */
    async findAccessiblePDUs(user, queryParams) {
        const { page, limit, organization_id, department_id, type, is_active, location, search, sort_by, sort_order, include_stats } = queryParams;
        
        // Build where clause based on user permissions and filters
        let whereClause = {};
        
        // Organization access control
        if (user.permissions?.includes('system.admin')) {
            // Admin can access all PDUs
            if (organization_id) {
                whereClause.organization_id = organization_id;
            }
        } else {
            // Regular users can only access PDUs in their organization
            whereClause.organization_id = user.organization_id;
        }
        
        // Apply filters
        if (department_id) whereClause.department_id = department_id;
        if (type) whereClause.type = type;
        if (is_active !== undefined) whereClause.is_active = is_active;
        if (location) {
            whereClause.location = { contains: location, mode: 'insensitive' };
        }
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        
        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Build include clause
        const include = {
            organization: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
        };
        
        if (include_stats) {
            include.sockets = {
                select: {
                    id: true,
                    socket_number: true,
                    status: true,
                    device_id: true
                }
            };
        }
        
        // Execute queries
        const [data, total] = await Promise.all([
            prisma.power_distribution_units.findMany({
                where: whereClause,
                include,
                skip,
                take: limit,
                orderBy: { [sort_by]: sort_order }
            }),
            prisma.power_distribution_units.count({ where: whereClause })
        ]);
        
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            filters: queryParams
        };
    }

    /**
     * Find PDU by ID with access control
     */
    async findByIdWithAccess(pduId, user, options = {}) {
        const whereClause = { id: pduId };
        
        // Apply organization access control
        if (!user.permissions?.includes('system.admin')) {
            whereClause.organization_id = user.organization_id;
        }
        
        const include = {
            organization: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            sockets: {
                select: {
                    id: true,
                    socket_number: true,
                    name: true,
                    status: true,
                    device_id: true,
                    current_power: true,
                    is_enabled: true
                },
                orderBy: { socket_number: 'asc' }
            },
            ...options.include
        };
        
        return prisma.power_distribution_units.findFirst({
            where: whereClause,
            include
        });
    }
}

export default new PduRepository();