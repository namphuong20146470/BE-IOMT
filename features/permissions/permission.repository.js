// features/permissions/permission.repository.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class PermissionRepository {
    /**
     * Find permissions with filtering, pagination and includes
     */
    async findPermissions(options = {}) {
        const {
            page = 1,
            limit = 20,
            search,
            category,
            resource,
            action,
            is_system,
            organizationIds = [],
            includeRoles = false,
            includeUsers = false
        } = options;

        const skip = (page - 1) * limit;

        // Build where clause
        const where = {};
        
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { resource: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (category) {
            where.category = category;
        }

        if (resource) {
            where.resource = resource;
        }

        if (action) {
            where.action = action;
        }

        if (is_system !== undefined) {
            where.is_system = is_system;
        }

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null } // Include global permissions
            ];
        }

        // Build include clause
        const include = {};
        
        if (includeRoles) {
            include.roles = {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    is_active: true
                }
            };
        }

        if (includeUsers) {
            include.users = {
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true
                }
            };
        }

        // Execute queries
        const [permissions, total] = await Promise.all([
            prisma.permissions.findMany({
                where,
                include,
                skip,
                take: limit,
                orderBy: [
                    { category: 'asc' },
                    { resource: 'asc' },
                    { action: 'asc' }
                ]
            }),
            prisma.permissions.count({ where })
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        return {
            permissions,
            pagination: {
                current_page: page,
                per_page: limit,
                total,
                total_pages: totalPages,
                has_next: hasNext,
                has_prev: hasPrev
            }
        };
    }

    /**
     * Find permission by ID
     */
    async findById(id, options = {}) {
        const include = {};
        
        if (options.includeRoles) {
            include.roles = {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    is_active: true
                }
            };
        }

        if (options.includeUsers) {
            include.users = {
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true
                }
            };
        }

        return await prisma.permissions.findUnique({
            where: { id: parseInt(id) },
            include
        });
    }

    /**
     * Find permission by name
     */
    async findByName(name) {
        return await prisma.permissions.findFirst({
            where: { name }
        });
    }

    /**
     * Find permissions by category
     */
    async findByCategory(category, options = {}) {
        const { organizationIds = [], includeRoles = false, includeUsers = false } = options;

        const where = { category };

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null }
            ];
        }

        const include = {};
        
        if (includeRoles) {
            include.roles = {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    is_active: true
                }
            };
        }

        if (includeUsers) {
            include.users = {
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true
                }
            };
        }

        return await prisma.permissions.findMany({
            where,
            include,
            orderBy: [
                { resource: 'asc' },
                { action: 'asc' }
            ]
        });
    }

    /**
     * Search permissions
     */
    async search(searchTerm, options = {}) {
        const { 
            organizationIds = [], 
            category, 
            includeRoles = false, 
            limit = 50 
        } = options;

        const where = {
            OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
                { resource: { contains: searchTerm, mode: 'insensitive' } }
            ]
        };

        if (category) {
            where.category = category;
        }

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.AND = [
                {
                    OR: [
                        { organization_id: { in: organizationIds } },
                        { organization_id: null }
                    ]
                }
            ];
        }

        const include = {};
        
        if (includeRoles) {
            include.roles = {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    is_active: true
                }
            };
        }

        return await prisma.permissions.findMany({
            where,
            include,
            take: limit,
            orderBy: [
                { category: 'asc' },
                { resource: 'asc' },
                { action: 'asc' }
            ]
        });
    }

    /**
     * Get permissions hierarchy grouped by category and resource
     */
    async getHierarchy(organizationIds = []) {
        const where = {};

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null }
            ];
        }

        const permissions = await prisma.permissions.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                category: true,
                resource: true,
                action: true,
                is_system: true
            },
            orderBy: [
                { category: 'asc' },
                { resource: 'asc' },
                { action: 'asc' }
            ]
        });

        // Group by category and resource
        const hierarchy = {};
        
        permissions.forEach(permission => {
            if (!hierarchy[permission.category]) {
                hierarchy[permission.category] = {};
            }
            
            if (!hierarchy[permission.category][permission.resource]) {
                hierarchy[permission.category][permission.resource] = [];
            }
            
            hierarchy[permission.category][permission.resource].push({
                id: permission.id,
                name: permission.name,
                description: permission.description,
                action: permission.action,
                is_system: permission.is_system
            });
        });

        return hierarchy;
    }

    /**
     * Create new permission
     */
    async create(data) {
        return await prisma.permissions.create({
            data,
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Update permission
     */
    async update(id, data) {
        return await prisma.permissions.update({
            where: { id: parseInt(id) },
            data,
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Delete permission
     */
    async delete(id) {
        return await prisma.permissions.delete({
            where: { id: parseInt(id) }
        });
    }

    /**
     * Get permission statistics
     */
    async getStatistics(organizationIds = []) {
        const where = {};

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null }
            ];
        }

        const [
            total,
            systemPermissions,
            customPermissions,
            byCategory,
            byResource
        ] = await Promise.all([
            // Total permissions
            prisma.permissions.count({ where }),
            
            // System permissions
            prisma.permissions.count({ 
                where: { ...where, is_system: true } 
            }),
            
            // Custom permissions
            prisma.permissions.count({ 
                where: { ...where, is_system: false } 
            }),
            
            // Group by category
            prisma.permissions.groupBy({
                by: ['category'],
                where,
                _count: {
                    id: true
                },
                orderBy: {
                    category: 'asc'
                }
            }),
            
            // Group by resource
            prisma.permissions.groupBy({
                by: ['resource'],
                where,
                _count: {
                    id: true
                },
                orderBy: {
                    resource: 'asc'
                }
            })
        ]);

        return {
            total,
            system_permissions: systemPermissions,
            custom_permissions: customPermissions,
            by_category: byCategory.map(item => ({
                category: item.category,
                count: item._count.id
            })),
            by_resource: byResource.map(item => ({
                resource: item.resource,
                count: item._count.id
            }))
        };
    }

    /**
     * Check if permission exists
     */
    async exists(id) {
        const permission = await prisma.permissions.findUnique({
            where: { id: parseInt(id) },
            select: { id: true }
        });
        
        return !!permission;
    }

    /**
     * Get permissions by IDs
     */
    async findByIds(ids) {
        return await prisma.permissions.findMany({
            where: {
                id: {
                    in: ids.map(id => parseInt(id))
                }
            }
        });
    }

    /**
     * Get available categories
     */
    async getCategories(organizationIds = []) {
        const where = {};

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null }
            ];
        }

        const categories = await prisma.permissions.findMany({
            where,
            select: { category: true },
            distinct: ['category'],
            orderBy: { category: 'asc' }
        });

        return categories.map(item => item.category);
    }

    /**
     * Get available resources for a category
     */
    async getResourcesByCategory(category, organizationIds = []) {
        const where = { category };

        // Apply organization access control
        if (organizationIds.length > 0) {
            where.OR = [
                { organization_id: { in: organizationIds } },
                { organization_id: null }
            ];
        }

        const resources = await prisma.permissions.findMany({
            where,
            select: { resource: true },
            distinct: ['resource'],
            orderBy: { resource: 'asc' }
        });

        return resources.map(item => item.resource);
    }
}

export default PermissionRepository;