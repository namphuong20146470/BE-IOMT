import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import permissionService from '../services/PermissionService.js';
import sessionService from '../services/SessionService.js';
import auditService from '../services/AuditService.js';

const prisma = new PrismaClient();

/**
 * Enhanced Authentication Middleware using SessionService
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next function
 */
export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    await auditService.logAccessDenied(
      null, null, 'authentication', 'auth', null,
      req.ip, req.get('User-Agent')
    );
    return res.status(401).json({ 
      success: false, 
      message: 'Chưa đăng nhập - Cần token xác thực' 
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token không hợp lệ' 
      });
    }

    // Validate access token using SessionService
    const sessionInfo = await sessionService.validateAccessToken(token);
    
    if (!sessionInfo) {
      await auditService.logAccessDenied(
        null, null, 'authentication', 'auth', null,
        req.ip, req.get('User-Agent')
      );
      return res.status(401).json({ 
        success: false, 
        message: 'Token không hợp lệ hoặc đã hết hạn' 
      });
    }

    const user = sessionInfo.user;

    // Load user permissions
    try {
      const permissions = await permissionService.getUserPermissions(user.id);
      user.permissions = permissions;
      console.log(`📋 Loaded permissions for user ${user.username}`);
    } catch (error) {
      console.error('Error loading user permissions:', error);
      user.permissions = { roles: [], direct: [], resources: [] };
    }

    // Add user info to request
    req.user = user;
    req.sessionInfo = sessionInfo;

    // Add audit context
    req.auditContext = auditService.getRequestContext(req);

    // Log successful authentication
    await auditService.batchLog({
      userId: user.id,
      organizationId: user.organization_id,
      action: 'read',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true,
      newValues: {
        auth_method: 'session_jwt',
        username: user.username,
        session_id: sessionInfo.session_id
      }
    });

    // Debug log (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Auth successful: ${user.username} (Session: ${sessionInfo.session_id})`);
    }
    
    next();
    
  } catch (err) {
    console.error('Authentication error:', err.message);
    
    await auditService.logAccessDenied(
      null, null, 'authentication', 'auth', null,
      req.ip, req.get('User-Agent')
    );

    return res.status(401).json({ 
      success: false, 
      message: 'Token không hợp lệ hoặc đã hết hạn',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
}

/**
 * Permission-based middleware factory
 * @param {string} permission - Required permission
 * @param {string} resourceType - Resource type (optional)
 * @returns {Function} Middleware function
 */
export function requirePermission(permission, resourceType = null) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        await auditService.logAccessDenied(
          null, null, permission, resourceType, null,
          req.ip, req.get('User-Agent')
        );
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const resourceId = req.params.id || req.params.resourceId || null;
      
      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        permission,
        resourceType,
        resourceId
      );

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
          resource_type: resourceType
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
      
      next();
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

      for (const permission of permissions) {
        const hasPermission = await permissionService.hasPermission(req.user.id, permission);
        if (hasPermission) {
          return next();
        }
      }

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
        required_permissions: permissions
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
          message: 'Organization membership required'
        });
      }

      if (requireSameOrg) {
        const targetOrgId = req.params.organizationId || req.body.organization_id;
        if (targetOrgId && targetOrgId !== req.user.organization_id) {
          if (req.user.table === 'users') {
            await auditService.logAccessDenied(
              req.user.id,
              req.user.organization_id,
              'organization_access',
              'organization',
              targetOrgId,
              req.ip,
              req.get('User-Agent')
            );
          }

          return res.status(403).json({
            success: false,
            message: 'Access denied: different organization'
          });
        }
      }

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
 * CRUD operation logger middleware
 * @param {string} resourceType - Resource type
 * @returns {Function} Middleware function
 */
export function auditCRUD(resourceType) {
  return (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Determine action from HTTP method
      const methodActionMap = {
        'GET': 'read',
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete'
      };
      
      const action = methodActionMap[req.method] || 'unknown';
      const resourceId = req.params.id || req.params.resourceId || null;
      const success = res.statusCode >= 200 && res.statusCode < 300;
      
      // Log the operation
      if (req.user?.id) {
        auditService.batchLog({
          userId: req.user.id,
          organizationId: req.user.organization_id,
          action,
          resourceType,
          resourceId,
          oldValues: req.method === 'PUT' || req.method === 'PATCH' ? req.body : null,
          newValues: req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' ? data : null,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success,
          errorMessage: !success ? data?.message : null
        });
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

// Export session service for use in controllers
export { sessionService };