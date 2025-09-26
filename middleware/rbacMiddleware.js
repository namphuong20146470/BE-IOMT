import permissionService from '../services/PermissionService.js';
import auditService from '../services/AuditService.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles authorization logic after authentication
 */

/**
 * Helper: Check if user is Super Admin
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if Super Admin
 */
export function isSuperAdmin(user) {
  if (!user || !user.roles) return false;
  
  return user.roles.some(role => 
    role.is_system_role === true || 
    role.name?.toLowerCase().includes('super admin') ||
    role.name?.toLowerCase() === 'super admin'
  );
}

/**
 * Helper: Check if user should have full organization access
 * @param {Object} user - User object from JWT
 * @returns {boolean} True if should have full access
 */
export function hasFullOrganizationAccess(user) {
  // Super Admin always has full access
  if (isSuperAdmin(user)) return true;
  
  // System admin without organization_id has full access
  if (!user.organization_id) return true;
  
  return false;
}

/**
 * Permission-based middleware factory
 * @param {string} permission - Required permission (e.g., 'device.read')
 * @param {string} resourceType - Resource type (optional)
 * @returns {Function} Middleware function
 */
export function requirePermission(permission, resourceType = null) {
  return async (req, res, next) => {
    try {
      console.log(`🔐 RBAC Middleware - Checking permission: ${permission}`);
      console.log(`🔐 RBAC Middleware - User:`, JSON.stringify({
        id: req.user?.id,
        username: req.user?.username,
        organization_id: req.user?.organization_id,
        roles: req.user?.roles?.map(r => ({ name: r.name, is_system_role: r.is_system_role })),
        permissions: req.user?.permissions ? 'present' : 'missing'
      }, null, 2));

      // Must be authenticated first
      if (!req.user || !req.user.id) {
        console.log(`❌ RBAC Middleware - User not authenticated`);
        await auditService.logAccessDenied(
          null, null, permission, resourceType, null,
          req.ip, req.get('User-Agent')
        );
        return res.status(401).json({
          success: false,
          message: 'Authentication required for permission check'
        });
      }

      const resourceId = req.params.id || req.params.resourceId || null;
      
      console.log(`🔐 RBAC Middleware - Calling permissionService.hasPermission(${req.user.id}, ${permission})`);
      
      // Check user permissions
      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        permission,
        resourceType,
        resourceId
      );
      
      console.log(`🔐 RBAC Middleware - Permission result: ${hasPermission}`);

      if (!hasPermission) {
        // Log failed permission check
        await auditService.logAccessDenied(
          req.user.id,
          req.user.organization_id,
          permission,
          resourceType,
          resourceId,
          req.ip,
          req.get('User-Agent')
        );
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required_permission: permission,
          resource_type: resourceType,
          user_permissions: req.user.permissions?.roles?.map(r => r.name) || []
        });
      }

      // Log successful permission check
      await auditService.batchLog({
        userId: req.user.id,
        organizationId: req.user.organization_id,
        action: 'permission_granted',
        resourceType,
        resourceId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
        newValues: {
          permission,
          resource_type: resourceType,
          resource_id: resourceId
        }
      });
      
      // Add Super Admin info to request for controllers to use
      req.user.is_super_admin = isSuperAdmin(req.user);
      req.user.has_full_org_access = hasFullOrganizationAccess(req.user);
      
      console.log(`✅ Permission granted: ${req.user.username} → ${permission} (Super Admin: ${req.user.is_super_admin})`);
      next();
      
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        error: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  };
}

/**
 * Multiple permissions middleware (any of the permissions)
 * @param {Array} permissions - Array of permissions
 * @returns {Function} Middleware function
 */
export function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check each permission until one passes
      for (const permission of permissions) {
        const hasPermission = await permissionService.hasPermission(req.user.id, permission);
        if (hasPermission) {
          console.log(`✅ Permission granted (any): ${req.user.username} → ${permission}`);
          return next();
        }
      }

      // None of the permissions passed
      await auditService.logAccessDenied(
        req.user.id,
        req.user.organization_id,
        permissions.join(' OR '),
        'multiple',
        null,
        req.ip,
        req.get('User-Agent')
      );

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required_permissions: permissions,
        user_permissions: req.user.permissions?.roles?.map(r => r.name) || []
      });
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
}

/**
 * Role-based middleware - require specific role
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} Middleware function
 */
export function requireRole(roles) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRoles = req.user.permissions?.roles || [];
      const userRoleNames = userRoles.map(r => r.name);
      
      // Check if user has any of the required roles
      const hasRole = requiredRoles.some(role => userRoleNames.includes(role));
      
      if (!hasRole) {
        await auditService.logAccessDenied(
          req.user.id,
          req.user.organization_id,
          `role_required: ${requiredRoles.join(' OR ')}`,
          'role',
          null,
          req.ip,
          req.get('User-Agent')
        );
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient role permissions',
          required_roles: requiredRoles,
          user_roles: userRoleNames
        });
      }

      console.log(`✅ Role granted: ${req.user.username} → ${requiredRoles.join(' OR ')}`);
      next();
      
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
}

/**
 * Organization-based access control
 * @param {boolean} requireSameOrg - Require same organization
 * @returns {Function} Middleware function
 */
export function requireOrganization(requireSameOrg = true) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(403).json({
          success: false,
          message: 'User organization not found'
        });
      }

      if (requireSameOrg) {
        const targetOrgId = req.params.organizationId || req.body.organization_id || req.query.organization_id;
        
        if (targetOrgId && targetOrgId !== req.user.organization_id) {
          // Check if user has cross-organization access permission
          const hasCrossOrgAccess = await permissionService.hasPermission(
            req.user.id, 
            'organization.cross_access'
          );
          
          if (!hasCrossOrgAccess) {
            await auditService.logAccessDenied(
              req.user.id,
              req.user.organization_id,
              'organization_access',
              'organization',
              targetOrgId,
              req.ip,
              req.get('User-Agent')
            );

            return res.status(403).json({
              success: false,
              message: 'Access denied: different organization',
              user_organization: req.user.organization_id,
              requested_organization: targetOrgId
            });
          }
        }
      }

      console.log(`✅ Organization access: ${req.user.username} → ${req.user.organization_id}`);
      next();
      
    } catch (error) {
      console.error('Organization middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Organization check failed'
      });
    }
  };
}

/**
 * Auto-filter data by user's organization
 * Adds organization filter to request for data isolation
 * @returns {Function} Middleware function
 */
export function organizationFilter() {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(403).json({
          success: false,
          message: 'User organization required for data filtering'
        });
      }

      // Add organization filter to query params
      if (!req.query.organization_id) {
        req.query.organization_id = req.user.organization_id;
      }
      
      // Add to request context for controllers
      req.organizationFilter = {
        organization_id: req.user.organization_id,
        department_id: req.user.department_id
      };

      console.log(`🔍 Organization filter applied: ${req.user.organization_id}`);
      next();
      
    } catch (error) {
      console.error('Organization filter error:', error);
      res.status(500).json({
        success: false,
        message: 'Organization filter failed'
      });
    }
  };
}

/**
 * Admin-only access
 * @returns {Function} Middleware function
 */
export function requireAdmin() {
  return requireRole(['Super Admin', 'Admin']);
}

/**
 * System admin access (highest level)
 * @returns {Function} Middleware function
 */
export function requireSystemAdmin() {
  return requireRole('Super Admin');
}

/**
 * Combined middleware for common device operations
 */
export const deviceAccess = {
  read: [requirePermission('device.read'), organizationFilter()],
  write: [requirePermission('device.write'), requireOrganization()],
  delete: [requirePermission('device.delete'), requireOrganization()],
  admin: [requireAdmin(), requireOrganization()]
};

/**
 * Combined middleware for user management
 */
export const userAccess = {
  read: [requirePermission('user.read')],
  manage: [requirePermission('user.manage')],
  admin: [requireAdmin()]
};

export default {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireOrganization,
  organizationFilter,
  requireAdmin,
  requireSystemAdmin,
  deviceAccess,
  userAccess
};