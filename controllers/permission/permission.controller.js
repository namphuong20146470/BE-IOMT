import roleService from '../../shared/services/RoleService.js';
import permissionService from '../../shared/services/PermissionService.js';
import auditService from '../../shared/services/AuditService.js';
import { 
    isSystemAdmin, 
    isOrganizationAdmin, 
    hasPermission,
    getEffectiveOrganizationId,
    validateOrganizationAccess 
} from '../../utils/permissionHelpers.js';

// Services are already instantiated, no need to create new instances

// ====================================================================
// ROLE-PERMISSION MANAGEMENT CONTROLLERS
// ====================================================================

/**
 * Assign single or multiple permissions to a role
 * POST /roles/:roleId/permissions
 * Body: { permission_id: "uuid" } OR { permission_ids: ["uuid1", "uuid2"] }
 */
export const assignPermissionToRole = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Check permission
        const hasPermission = await permissionService.hasPermission(userId, 'role.manage');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: role.manage' 
            });
        }

        const { roleId } = req.params;
        const { permission_id, permission_ids } = req.body;

        // Validate input
        if (!permission_id && !permission_ids) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either permission_id or permission_ids is required' 
            });
        }

        let result;
        if (permission_ids && Array.isArray(permission_ids)) {
            // Bulk assign
            console.log(`🔄 Assigning ${permission_ids.length} permissions to role ${roleId}`);
            result = await roleService.assignPermissionsToRole(roleId, permission_ids, userId);
        } else if (permission_id) {
            // Single assign
            console.log(`🔄 Assigning permission ${permission_id} to role ${roleId}`);
            result = await roleService.assignPermissionToRole(roleId, permission_id, userId);
        }

        if (result.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission.assign', 'role', roleId, {
                permissions: permission_ids || [permission_id],
                details: 'Permissions assigned to role'
            });

            return res.json({
                success: true,
                data: result.data,
                message: permission_ids ? 
                    `${permission_ids.length} permissions assigned successfully` :
                    'Permission assigned successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Error assigning permission to role:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Remove permission from role
 * DELETE /roles/:roleId/permissions/:permissionId
 */
export const removePermissionFromRole = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'role.update');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: role.update' 
            });
        }

        const { roleId, permissionId } = req.params;

        console.log(`🔄 Removing permission ${permissionId} from role ${roleId}`);
        const result = await roleService.removePermissionFromRole(roleId, permissionId, userId);

        if (result.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission.remove', 'role', roleId, {
                permission_id: permissionId,
                details: 'Permission removed from role'
            });

            return res.json({
                success: true,
                message: 'Permission removed successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Error removing permission from role:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get role permissions
 * GET /roles/:roleId/permissions?include_inherited=true
 */
export const getRolePermissions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'role.read');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: role.read' 
            });
        }

        const { roleId } = req.params;
        const { include_inherited, format } = req.query;

        console.log(`🔍 Getting permissions for role ${roleId}`);

        let permissions;
        if (include_inherited === 'true') {
            permissions = await roleService.getInheritedPermissions(roleId);
        } else {
            const role = await roleService.getRoleById(roleId, true);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Role not found'
                });
            }
            permissions = role.permissions || [];
        }

        // Format response based on request
        let formattedPermissions = permissions;
        if (format === 'grouped') {
            // Group by resource
            const grouped = permissions.reduce((acc, perm) => {
                const resource = perm.resource || 'general';
                if (!acc[resource]) {
                    acc[resource] = [];
                }
                acc[resource].push(perm);
                return acc;
            }, {});
            formattedPermissions = grouped;
        }

        return res.json({
            success: true,
            data: formattedPermissions,
            total: Array.isArray(formattedPermissions) ? formattedPermissions.length : 
                   Object.values(formattedPermissions).flat().length,
            role_id: roleId,
            include_inherited: include_inherited === 'true',
            format: format || 'array'
        });

    } catch (error) {
        console.error('❌ Error getting role permissions:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Bulk update role permissions (replace all)
 * PUT /roles/:roleId/permissions
 * Body: { permission_ids: ["uuid1", "uuid2", ...] }
 */
export const updateRolePermissions = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        // ✅ DEBUG: Check user info
        console.log('🔍 DEBUG - User Info:', {
            userId,
            username: req.user?.username,
            roles: req.user?.roles
        });

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Check permission using permissionService
        const hasUpdatePermission = await permissionService.hasPermission(userId, 'role.manage');
        
        if (!hasUpdatePermission) {
            // ✅ DEBUG: Get user's actual permissions
            const userPerms = await permissionService.getUserPermissions(userId);
            console.log('🔍 User actual permissions:', userPerms);

            return res.status(403).json({ 
                success: false,  
                error: 'Insufficient permissions. Required: role.manage',
                debug: {
                    required: 'role.manage',
                    user_permissions: userPerms?.map(p => p.code) || []
                }
            });
        }

        const { roleId } = req.params;
        const { permission_ids } = req.body;

        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({ 
                success: false, 
                error: 'permission_ids must be an array' 
            });
        }

        console.log(`🔄 Bulk updating permissions for role ${roleId}`);

        // Get current permissions
        const currentRole = await roleService.getRoleById(roleId, true);
        

        if (!currentRole) {
            return res.status(404).json({ 
                success: false, 
                error: 'Role not found' 
            });
        }

        const currentPermissionIds = currentRole.permissions.map(p => p.id);

        // Calculate changes
        const toAdd = permission_ids.filter(id => !currentPermissionIds.includes(id));
        const toRemove = currentPermissionIds.filter(id => !permission_ids.includes(id));

        console.log(`📊 Changes: +${toAdd.length} permissions, -${toRemove.length} permissions`);
        console.log('📊 To Add:', toAdd);
        console.log('📊 To Remove:', toRemove);

        // Execute changes
        const results = [];

        // Add new permissions
        if (toAdd.length > 0) {
            console.log('➕ Adding permissions...');
            const addResult = await roleService.assignPermissionsToRole(roleId, toAdd, userId);
            console.log('➕ Add result:', addResult);
            
            results.push({ 
                action: 'added', 
                count: toAdd.length, 
                success: addResult.success,
                permissions: toAdd
            });
        }

        // Remove old permissions
        if (toRemove.length > 0) {
            console.log('➖ Removing permissions...');
            for (const permId of toRemove) {
                const removeResult = await roleService.removePermissionFromRole(roleId, permId, userId);
                console.log(`➖ Removed ${permId}:`, removeResult);
                
                results.push({ 
                    action: 'removed', 
                    permission_id: permId, 
                    success: removeResult.success 
                });
            }
        }

        // Log audit
        await auditService.logActivity(userId, 'permission.bulk_update', 'role', roleId, {
            added: toAdd,
            removed: toRemove,
            total_permissions: permission_ids.length,
            details: 'Bulk permission update'
        });

        console.log('✅ Permission update completed successfully');

        return res.json({
            success: true,
            data: {
                changes: results,
                summary: {
                    added: toAdd.length,
                    removed: toRemove.length,
                    total: permission_ids.length
                }
            },
            message: `Updated permissions for role. Added: ${toAdd.length}, Removed: ${toRemove.length}`
        });

    } catch (error) {
        console.error('❌ Error updating role permissions:', error);
        console.error('❌ Stack trace:', error.stack);
        
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ====================================================================
// PERMISSION CRUD CONTROLLERS
// ====================================================================

/**
 * Get all permissions
 * GET /permissions?group_id=xxx&search=xxx&include_groups=true
 */
export const getAllPermissions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.read' 
            });
        }

        // ✅ Check if user is Super Admin
        const isSuperAdmin = isSystemAdmin(req.user);

        const { group_id, search, include_groups, format } = req.query;

        console.log('🔍 Getting all permissions', { group_id, search, include_groups, format });

        const permissions = await permissionService.getAllPermissions({
            group_id: group_id,
            search: search,
            include_groups: include_groups === 'true',
            format: format || 'array'
        });

        return res.json({
            success: true,
            data: permissions,
            total: Array.isArray(permissions) ? permissions.length : 
                   Object.values(permissions).flat().length,
            format: format || 'array',
            bypass_used: isSuperAdmin,
            filters: {
                group_id: group_id || null,
                search: search || null,
                include_groups: include_groups === 'true'
            },
            message: 'Permissions retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting permissions:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create new permission
 * POST /permissions
 * Body: { name, description, resource, action, group_id }
 */
export const createPermission = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.create');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.create' 
            });
        }

        const { name, description, resource, action, group_id, is_active = true } = req.body;

        // Validate required fields
        if (!name || !resource || !action) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, resource, and action are required' 
            });
        }

        console.log(`🔄 Creating permission: ${name} (${resource}.${action})`);

        const newPermission = await permissionService.createPermission({
            name,
            description,
            resource,
            action,
            group_id,
            is_active,
            created_by: userId
        });

        if (newPermission.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission.create', 'permission', newPermission.data.id, {
                permission_name: name,
                resource,
                action,
                details: 'Permission created'
            });

            return res.status(201).json({
                success: true,
                data: newPermission.data,
                message: 'Permission created successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: newPermission.error
            });
        }

    } catch (error) {
        console.error('❌ Error creating permission:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get permission by ID
 * GET /permissions/:permissionId
 */
export const getPermissionById = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.read' );
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.read' 
            });
        }

        const { permissionId } = req.params;
        const { include_roles } = req.query;

        console.log(`🔍 Getting permission ${permissionId}`);

        const permission = await permissionService.getPermissionById(permissionId, {
            includeRoles: include_roles === 'true'
        });

        if (!permission) {
            return res.status(404).json({
                success: false,
                error: 'Permission not found'
            });
        }

        return res.json({
            success: true,
            data: permission,
            include_roles: include_roles === 'true'
        });

    } catch (error) {
        console.error('❌ Error getting permission:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update permission
 * PUT /permissions/:permissionId
 * Body: { name, description, resource, action, group_id, is_active }
 */
export const updatePermission = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.update');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.update' 
            });
        }

        const { permissionId } = req.params;
        const updateData = req.body;

        console.log(`🔄 Updating permission ${permissionId}`);

        const result = await permissionService.updatePermission(permissionId, {
            ...updateData,
            updated_by: userId
        });

        if (result.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission.update', 'permission', permissionId, {
                updates: updateData,
                details: 'Permission updated'
            });

            return res.json({
                success: true,
                data: result.data,
                message: 'Permission updated successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Error updating permission:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Delete permission
 * DELETE /permissions/:permissionId
 */
export const deletePermission = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.delete');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.delete' 
            });
        }

        const { permissionId } = req.params;
        const { force } = req.query;

        console.log(`🔄 Deleting permission ${permissionId}`);

        const result = await permissionService.deletePermission(permissionId, {
            force: force === 'true',
            deletedBy: userId
        });

        if (result.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission.delete', 'permission', permissionId, {
                force: force === 'true',
                details: 'Permission deleted'
            });

            return res.json({
                success: true,
                message: 'Permission deleted successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Error deleting permission:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ====================================================================
// PERMISSION GROUP CONTROLLERS
// ====================================================================

/**
 * Get all permission groups
 * GET /permission-groups
 */
export const getAllPermissionGroups = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.read' 
            });
        }

        const { include_permissions } = req.query;

        console.log('🔍 Getting all permission groups');

        const groups = await permissionService.getAllPermissionGroups({
            includePermissions: include_permissions === 'true'
        });

        return res.json({
            success: true,
            data: groups,
            total: groups.length,
            include_permissions: include_permissions === 'true',
            message: 'Permission groups retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting permission groups:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create permission group
 * POST /permission-groups
 * Body: { name, description, color, icon }
 */
export const createPermissionGroup = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const hasPermission = await permissionService.hasPermission(userId, 'permission.create');
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                error: 'Insufficient permissions. Required: permission.create' 
            });
        }

        const { name, description, color, icon } = req.body;

        if (!name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name is required' 
            });
        }

        console.log(`🔄 Creating permission group: ${name}`);

        const newGroup = await permissionService.createPermissionGroup({
            name,
            description,
            color,
            icon,
            created_by: userId
        });

        if (newGroup.success) {
            // Log audit
            await auditService.logActivity(userId, 'permission_group.create', 'permission_group', newGroup.data.id, {
                group_name: name,
                details: 'Permission group created'
            });

            return res.status(201).json({
                success: true,
                data: newGroup.data,
                message: 'Permission group created successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: newGroup.error
            });
        }

    } catch (error) {
        console.error('❌ Error creating permission group:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    // Role-Permission Management
    assignPermissionToRole,
    removePermissionFromRole,
    getRolePermissions,
    updateRolePermissions,
    
    // Permission CRUD
    getAllPermissions,
    createPermission,
    getPermissionById,
    updatePermission,
    deletePermission,
    
    // Permission Groups
    getAllPermissionGroups,
    createPermissionGroup
};