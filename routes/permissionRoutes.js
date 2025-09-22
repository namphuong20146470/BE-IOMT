import express from 'express';
import permissionService from '../services/PermissionService.js';
import roleService from '../services/RoleService.js';
import auditService from '../services/AuditService.js';

const router = express.Router();

// ==========================================
// PERMISSION CRUD OPERATIONS
// ==========================================

/**
 * @route GET /api/permissions
 * @desc Get all permissions with optional filtering
 * @access Private - requires 'permission.read' permission
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const {
      resource,
      action,
      group_id,
      search,
      is_active = 'true',
      include_groups = 'false'
    } = req.query;

    const filters = {
      resource: resource || null,
      action: action || null,
      group_id: group_id || null,
      search: search || null,
      is_active: is_active === 'true',
      includeGroups: include_groups === 'true'
    };

    const permissions = await permissionService.getAllPermissions(filters);

    res.json({
      success: true,
      data: permissions,
      total: permissions.length
    });
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/permissions/:id
 * @desc Get permission by ID
 * @access Private - requires 'permission.read' permission
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const { include_roles = 'false', include_users = 'false' } = req.query;

    const permission = await permissionService.getPermissionById(id, {
      includeRoles: include_roles === 'true',
      includeUsers: include_users === 'true'
    });

    if (!permission) {
      return res.status(404).json({ success: false, error: 'Permission not found' });
    }

    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error getting permission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/permissions
 * @desc Create new permission
 * @access Private - requires 'permission.create' permission
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.create');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await permissionService.createPermission(req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating permission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route PUT /api/permissions/:id
 * @desc Update permission
 * @access Private - requires 'permission.update' permission
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.update');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const result = await permissionService.updatePermission(id, req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/permissions/:id
 * @desc Delete permission
 * @access Private - requires 'permission.delete' permission
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.delete');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const result = await permissionService.deletePermission(id, userId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// PERMISSION GROUPS OPERATIONS
// ==========================================

/**
 * @route GET /api/permissions/groups
 * @desc Get all permission groups
 * @access Private - requires 'permission.read' permission
 */
router.get('/groups', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { include_permissions = 'false' } = req.query;

    const groups = await permissionService.getPermissionGroups({
      includePermissions: include_permissions === 'true'
    });

    res.json({
      success: true,
      data: groups,
      total: groups.length
    });
  } catch (error) {
    console.error('Error getting permission groups:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/permissions/groups
 * @desc Create permission group
 * @access Private - requires 'permission.create' permission
 */
router.post('/groups', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.create');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await permissionService.createPermissionGroup(req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating permission group:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// ROLE-PERMISSION ASSIGNMENT OPERATIONS
// ==========================================

/**
 * @route GET /api/permissions/roles/:roleId
 * @desc Get permissions assigned to a role
 * @access Private - requires 'permission.read' permission
 */
router.get('/roles/:roleId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { roleId } = req.params;
    const { include_inherited = 'false' } = req.query;

    const permissions = await permissionService.getRolePermissions(roleId, {
      includeInherited: include_inherited === 'true'
    });

    res.json({
      success: true,
      data: permissions,
      total: permissions.length
    });
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/permissions/roles/:roleId
 * @desc Assign permission to role
 * @access Private - requires 'permission.assign' permission
 */
router.post('/roles/:roleId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { roleId } = req.params;
    const { permission_id, conditions, expires_at } = req.body;

    if (!permission_id) {
      return res.status(400).json({ success: false, error: 'Permission ID is required' });
    }

    const assignmentData = {
      role_id: roleId,
      permission_id,
      conditions: conditions || null,
      expires_at: expires_at || null
    };

    const result = await permissionService.assignPermissionToRole(assignmentData, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error assigning permission to role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/permissions/roles/:roleId/:permissionId
 * @desc Remove permission from role
 * @access Private - requires 'permission.assign' permission
 */
router.delete('/roles/:roleId/:permissionId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { roleId, permissionId } = req.params;
    const { reason } = req.body;

    const result = await permissionService.removePermissionFromRole(roleId, permissionId, userId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error removing permission from role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route PUT /api/permissions/roles/:roleId/bulk
 * @desc Bulk update role permissions
 * @access Private - requires 'permission.assign' permission
 */
router.put('/roles/:roleId/bulk', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'permission.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'Permissions array is required' });
    }

    const result = await permissionService.bulkUpdateRolePermissions(roleId, permissions, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error bulk updating role permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// USER-PERMISSION ASSIGNMENT OPERATIONS
// ==========================================

/**
 * @route GET /api/permissions/users/:userId
 * @desc Get user's permissions (direct + role-based)
 * @access Private - requires 'permission.read' or own user
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { userId } = req.params;
    const { include_roles = 'true', organization_id } = req.query;

    // Check permission (can view own permissions or need permission.read)
    const hasPermission = userId === requesterId || 
                         await permissionService.hasPermission(requesterId, 'permission.read');
    
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const permissions = await permissionService.getUserPermissions(userId, {
      includeRoles: include_roles === 'true',
      organizationId: organization_id || null
    });

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/permissions/users/:userId/effective
 * @desc Get user's effective permissions (all combined)
 * @access Private - requires 'permission.read' or own user
 */
router.get('/users/:userId/effective', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { userId } = req.params;
    const { organization_id } = req.query;

    // Check permission (can view own permissions or need permission.read)
    const hasPermission = userId === requesterId || 
                         await permissionService.hasPermission(requesterId, 'permission.read');
    
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const effectivePermissions = await permissionService.getEffectivePermissions(userId, organization_id || null);

    res.json({
      success: true,
      data: effectivePermissions
    });
  } catch (error) {
    console.error('Error getting effective permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/permissions/users/:userId
 * @desc Assign direct permission to user
 * @access Private - requires 'permission.assign' permission
 */
router.post('/users/:userId', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(requesterId, 'permission.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId } = req.params;
    const { permission_id, conditions, expires_at, organization_id } = req.body;

    if (!permission_id) {
      return res.status(400).json({ success: false, error: 'Permission ID is required' });
    }

    const assignmentData = {
      user_id: userId,
      permission_id,
      conditions: conditions || null,
      expires_at: expires_at || null,
      organization_id: organization_id || null
    };

    const result = await permissionService.assignPermissionToUser(assignmentData, requesterId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error assigning permission to user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/permissions/users/:userId/:permissionId
 * @desc Remove direct permission from user
 * @access Private - requires 'permission.assign' permission
 */
router.delete('/users/:userId/:permissionId', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(requesterId, 'permission.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId, permissionId } = req.params;
    const { reason } = req.body;

    const result = await permissionService.removePermissionFromUser(userId, permissionId, requesterId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error removing permission from user:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// PERMISSION VALIDATION & CHECK OPERATIONS
// ==========================================

/**
 * @route POST /api/permissions/check
 * @desc Check if user has specific permission
 * @access Private - requires 'permission.read' permission
 */
router.post('/check', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission (can check own permissions or need permission.read)
    const { user_id, permission_name, organization_id, context } = req.body;

    if (!user_id || !permission_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and permission name are required' 
      });
    }

    const hasReadPermission = user_id === requesterId || 
                             await permissionService.hasPermission(requesterId, 'permission.read');
    
    if (!hasReadPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const hasPermission = await permissionService.hasPermission(
      user_id, 
      permission_name, 
      organization_id || null,
      context || null
    );

    res.json({
      success: true,
      data: {
        user_id,
        permission_name,
        organization_id: organization_id || null,
        has_permission: hasPermission,
        checked_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/permissions/check/bulk
 * @desc Bulk check multiple permissions for user
 * @access Private - requires 'permission.read' permission
 */
router.post('/check/bulk', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { user_id, permissions, organization_id } = req.body;

    if (!user_id || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and permissions array are required' 
      });
    }

    // Check permission (can check own permissions or need permission.read)
    const hasReadPermission = user_id === requesterId || 
                             await permissionService.hasPermission(requesterId, 'permission.read');
    
    if (!hasReadPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const results = await Promise.all(
      permissions.map(async (permissionName) => {
        const hasPermission = await permissionService.hasPermission(
          user_id, 
          permissionName, 
          organization_id || null
        );
        
        return {
          permission_name: permissionName,
          has_permission: hasPermission
        };
      })
    );

    res.json({
      success: true,
      data: {
        user_id,
        organization_id: organization_id || null,
        permissions: results,
        checked_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error bulk checking permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// DEBUG OPERATIONS
// ==========================================

/**
 * @route GET /api/permissions/users/:userId/debug
 * @desc Debug user permissions (detailed breakdown)
 * @access Private - requires 'permission.read' permission
 */
router.get('/users/:userId/debug', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(requesterId, 'permission.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId } = req.params;
    const { organization_id } = req.query;

    const debugInfo = await permissionService.debugUserPermissions(userId, organization_id || null);

    res.json({
      success: true,
      data: debugInfo
    });
  } catch (error) {
    console.error('Error debugging user permissions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;