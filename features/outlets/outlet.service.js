// features/outlets/outlet.service.js
import outletRepository from './outlet.repository.js';
import OutletModel from './outlet.model.js';
import { AppError } from '../../shared/utils/errorHandler.js';

/**
 * Outlet Service - Business logic for outlet operations
 */
class OutletService {
    async getAllOutlets(query, user) {
        const validatedQuery = OutletModel.query.parse(query);
        const filters = this.buildFilters(validatedQuery, user);
        const { skip, take } = this.getPagination(validatedQuery);
        
        const includeOptions = this.buildIncludeOptions(validatedQuery);
        
        const [outlets, total] = await Promise.all([
            outletRepository.findMany(filters, {
                skip,
                take,
                include: includeOptions,
                orderBy: { outlet_number: 'asc' }
            }),
            outletRepository.count(filters)
        ]);

        return {
            success: true,
            data: outlets,
            pagination: this.formatPagination(validatedQuery, total)
        };
    }

    async getOutletById(id, user, options = {}) {
        const include = this.buildDetailedInclude(options);
        
        const outlet = await outletRepository.findById(id, include);
        if (!outlet) {
            throw new AppError('Outlet not found', 404);
        }

        // Check access through PDU organization
        this.checkAccess(outlet, user);

        return {
            success: true,
            data: outlet
        };
    }

    async updateOutlet(id, data, user) {
        const validatedData = OutletModel.update.parse(data);
        
        const outlet = await outletRepository.findById(id, {
            pdu: { include: { organization: true } }
        });
        
        if (!outlet) {
            throw new AppError('Outlet not found', 404);
        }

        this.checkAccess(outlet, user);

        const updatedOutlet = await outletRepository.update(id, validatedData);

        return {
            success: true,
            data: updatedOutlet,
            message: 'Outlet updated successfully'
        };
    }

    async assignDevice(outletId, deviceId, user, notes = null) {
        // Validate assignment
        await this.validateAssignment(outletId, deviceId);
        
        const outlet = await outletRepository.findById(outletId, {
            pdu: { include: { organization: true } }
        });
        
        if (!outlet) {
            throw new AppError('Outlet not found', 404);
        }

        this.checkAccess(outlet, user);

        if (outlet.device_id) {
            throw new AppError('Outlet already has a device assigned', 400);
        }

        const updatedOutlet = await outletRepository.update(outletId, {
            device_id: deviceId,
            assigned_at: new Date(),
            assigned_by: user.id,
            notes
        });

        return {
            success: true,
            data: updatedOutlet,
            message: 'Device assigned to outlet successfully'
        };
    }

    async unassignDevice(outletId, user, notes = null) {
        const outlet = await outletRepository.findById(outletId, {
            pdu: { include: { organization: true } },
            device: true
        });
        
        if (!outlet) {
            throw new AppError('Outlet not found', 404);
        }

        this.checkAccess(outlet, user);

        if (!outlet.device_id) {
            throw new AppError('Outlet has no device assigned', 400);
        }

        const updatedOutlet = await outletRepository.update(outletId, {
            device_id: null,
            assigned_at: null,
            assigned_by: null,
            notes
        });

        return {
            success: true,
            data: updatedOutlet,
            message: 'Device unassigned from outlet successfully'
        };
    }

    async getOutletData(outletId, query, user) {
        const validatedQuery = OutletModel.dataQuery.parse(query);
        
        const outlet = await outletRepository.findById(outletId, {
            pdu: { include: { organization: true } }
        });
        
        if (!outlet) {
            throw new AppError('Outlet not found', 404);
        }

        this.checkAccess(outlet, user);

        const data = await outletRepository.getOutletData(outletId, validatedQuery);
        
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
                    model: { select: { name: true, manufacturer_id: true } },
                    device_connectivity: {
                        select: { mqtt_topic: true, last_connected: true, is_active: true }
                    }
                }
            };
        }

        if (query.include_data) {
            include.device_data = {
                take: 10,
                orderBy: { timestamp: 'desc' },
                select: {
                    data_payload: true,
                    timestamp: true,
                    measurements: { select: { name: true, unit: true } }
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
                    model: { select: { name: true } },
                    device_connectivity: true
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

    async validateAssignment(outletId, deviceId) {
        // Check if device exists and is not already assigned
        const device = await outletRepository.findDeviceById(deviceId);
        if (!device) {
            throw new AppError('Device not found', 404);
        }

        // Check if device is already assigned to another outlet
        const existingAssignment = await outletRepository.findDeviceAssignment(deviceId);
        if (existingAssignment) {
            throw new AppError('Device is already assigned to another outlet', 400);
        }
    }

    checkAccess(outlet, user) {
        if (!user.permissions?.includes('system.admin') && 
            user.organization_id !== outlet.pdu.organization_id) {
            throw new AppError('Access denied: Outlet belongs to different organization', 403);
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

export default new OutletService();