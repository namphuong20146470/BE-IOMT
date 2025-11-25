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
                outlets: {
                    select: {
                        id: true,
                        outlet_number: true,
                        status: true,
                        device_id: true
                    },
                    orderBy: { outlet_number: 'asc' }
                }
            }
        });
    }

    async createWithOutlets(pduData) {
        return prisma.$transaction(async (tx) => {
            // Create PDU
            const pdu = await tx.power_distribution_units.create({
                data: pduData
            });

            // Auto-create outlets based on total_outlets
            const outlets = [];
            for (let i = 1; i <= pduData.total_outlets; i++) {
                const outlet = await tx.outlets.create({
                    data: {
                        pdu_id: pdu.id,
                        outlet_number: i,
                        name: `Outlet ${i}`,
                        mqtt_topic_suffix: `socket${i}`,
                        status: 'inactive',
                        is_enabled: true,
                        display_order: i
                    }
                });
                outlets.push(outlet);
            }

            return { pdu, outlets };
        });
    }

    async update(id, data) {
        return prisma.power_distribution_units.update({
            where: { id },
            data,
            include: {
                organization: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                outlets: {
                    select: {
                        id: true,
                        outlet_number: true,
                        status: true,
                        device_id: true
                    },
                    orderBy: { outlet_number: 'asc' }
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

    async getPDUOutlets(pduId, filters = {}, include = {}) {
        return prisma.outlets.findMany({
            where: {
                pdu_id: pduId,
                ...filters
            },
            include,
            orderBy: { outlet_number: 'asc' }
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
}

export default new PduRepository();