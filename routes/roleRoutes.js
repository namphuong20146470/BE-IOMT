import express from 'express';
import roleService from '../services/RoleService.js';
import permissionService from '../services/PermissionService.js';
import auditService from '../services/AuditService.js';

const router = express.Router();

// ==========================================
// ROLE CRUD OPERATIONS
// ==========================================

/**
 * @route GET /api/roles
 * @desc Get roles for organization
 * @access Private - requires 'role.read' permission
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const {
      organization_id,
      include_system = 'true',
      include_permissions = 'false',
      search,
      is_active = 'true'
    } = req.query;

    if (!organization_id) {
      return res.status(400).json({ success: false, error: 'Organization ID is required' });
    }

    const options = {
      includeSystemRoles: include_system === 'true',
      includePermissions: include_permissions === 'true',
      isActive: is_active === 'true',
      search: search || null
    };

    const roles = await roleService.getRolesByOrganization(organization_id, options);

    res.json({
      success: true,
      data: roles,
      total: roles.length
    });
  } catch (error) {
    console.error('Error getting roles:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/roles/:id
 * @desc Get role by ID
 * @access Private - requires 'role.read' permission
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const { include_permissions = 'false' } = req.query;

    const role = await roleService.getRoleById(id, include_permissions === 'true');

    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error('Error getting role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/roles
 * @desc Create new role
 * @access Private - requires 'role.create' permission
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.create');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await roleService.createRole(req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route PUT /api/roles/:id
 * @desc Update role
 * @access Private - requires 'role.update' permission
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.update');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const result = await roleService.updateRole(id, req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/roles/:id
 * @desc Delete role
 * @access Private - requires 'role.delete' permission
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.delete');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const result = await roleService.deleteRole(id, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// ROLE ASSIGNMENT OPERATIONS
// ==========================================

/**
 * @route POST /api/roles/assign
 * @desc Assign role to user
 * @access Private - requires 'role.assign' permission
 */
router.post('/assign', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await roleService.assignRoleToUser(req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/roles/assign/bulk
 * @desc Bulk assign roles to users
 * @access Private - requires 'role.assign' permission
 */
router.post('/assign/bulk', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ success: false, error: 'Assignments array is required' });
    }

    const result = await roleService.bulkAssignRoles(assignments, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error in bulk role assignment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/roles/assign/:assignmentId
 * @desc Remove role assignment
 * @access Private - requires 'role.assign' permission
 */
router.delete('/assign/:assignmentId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { assignmentId } = req.params;
    const { reason } = req.body;

    const result = await roleService.removeRoleFromUser(assignmentId, userId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error removing role assignment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route PUT /api/roles/assign/:assignmentId
 * @desc Update role assignment
 * @access Private - requires 'role.assign' permission
 */
router.put('/assign/:assignmentId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.assign');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { assignmentId } = req.params;
    const result = await roleService.updateRoleAssignment(assignmentId, req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating role assignment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// ROLE HIERARCHY OPERATIONS
// ==========================================

/**
 * @route GET /api/roles/hierarchy/:organizationId
 * @desc Get role hierarchy for organization
 * @access Private - requires 'role.read' permission
 */
router.get('/hierarchy/:organizationId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { organizationId } = req.params;
    const hierarchy = await roleService.getRoleHierarchy(organizationId);

    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Error getting role hierarchy:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/roles/hierarchy
 * @desc Add role hierarchy relationship
 * @access Private - requires 'role.manage' permission
 */
router.post('/hierarchy', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.manage');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { parent_role_id, child_role_id } = req.body;
    if (!parent_role_id || !child_role_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parent role ID and child role ID are required' 
      });
    }

    const result = await roleService.addRoleHierarchy(parent_role_id, child_role_id, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding role hierarchy:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// ROLE TEMPLATES OPERATIONS
// ==========================================

/**
 * @route GET /api/roles/templates
 * @desc Get role templates
 * @access Private - requires 'role.read' permission
 */
router.get('/templates', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { organization_type, include_custom = 'true' } = req.query;

    const templates = await roleService.getRoleTemplates(
      organization_type || null,
      include_custom === 'true'
    );

    res.json({
      success: true,
      data: templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error getting role templates:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/roles/templates
 * @desc Create role template
 * @access Private - requires 'role.manage' permission
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.manage');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const result = await roleService.createRoleTemplate(req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating role template:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/roles/templates/:templateId/create-role
 * @desc Create role from template
 * @access Private - requires 'role.create' permission
 */
router.post('/templates/:templateId/create-role', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.create');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { templateId } = req.params;
    const result = await roleService.createRoleFromTemplate(templateId, req.body, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating role from template:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// USER ROLES OPERATIONS
// ==========================================

/**
 * @route GET /api/roles/users/:userId
 * @desc Get user's active roles
 * @access Private - requires 'user.read' permission
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission (can view own roles or need user.read permission)
    const { userId } = req.params;
    const { organization_id } = req.query;
    
    const hasPermission = userId === requesterId || 
                         await permissionService.hasPermission(requesterId, 'user.read');
    
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const roles = await roleService.getUserActiveRoles(userId, organization_id || null);

    res.json({
      success: true,
      data: roles,
      total: roles.length
    });
  } catch (error) {
    console.error('Error getting user roles:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// ROLE STATISTICS
// ==========================================

/**
 * @route GET /api/roles/stats
 * @desc Get role statistics
 * @access Private - requires 'role.read' permission
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'role.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { organization_id } = req.query;
    const stats = await roleService.getRoleStats(organization_id || null);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting role stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ==========================================
// WARNING SYSTEM INTEGRATION
// ==========================================

/**
 * @route GET /api/roles/escalation/:userId
 * @desc Get user's escalation level for warnings
 * @access Private - requires 'warning.read' permission
 */
router.get('/escalation/:userId', async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(requesterId, 'warning.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { userId } = req.params;
    const { warning_type, organization_id } = req.query;

    if (!warning_type) {
      return res.status(400).json({ success: false, error: 'Warning type is required' });
    }

    const escalationLevel = await roleService.getRoleEscalationLevel(
      userId,
      warning_type,
      organization_id || null
    );

    const notificationDecision = await roleService.shouldNotifyUser(
      userId,
      warning_type,
      organization_id || null
    );

    res.json({
      success: true,
      data: {
        user_id: userId,
        warning_type: warning_type,
        escalation_level: escalationLevel,
        notification_schedule: roleService.getNotificationSchedule(escalationLevel),
        ...notificationDecision
      }
    });
  } catch (error) {
    console.error('Error getting escalation level:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/roles/notification-recipients
 * @desc Get notification recipients for warning escalation
 * @access Private - requires 'warning.read' permission
 */
router.get('/notification-recipients', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check permission
    const hasPermission = await permissionService.hasPermission(userId, 'warning.read');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { organization_id, escalation_level, warning_type } = req.query;

    if (!organization_id || !escalation_level) {
      return res.status(400).json({ 
        success: false, 
        error: 'Organization ID and escalation level are required' 
      });
    }

    const recipients = await roleService.getNotificationRecipients(
      organization_id,
      parseInt(escalation_level),
      warning_type || null
    );

    res.json({
      success: true,
      data: recipients,
      total: recipients.length,
      escalation_level: parseInt(escalation_level)
    });
  } catch (error) {
    console.error('Error getting notification recipients:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;