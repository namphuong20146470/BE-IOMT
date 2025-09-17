import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import permissionService from '../services/PermissionService.js';
import auditService from '../services/AuditService.js';

const prisma = new PrismaClient();

// Session management functions
class SessionManager {
  /**
   * Create new session for user
   * @param {string} userId - User UUID
   * @param {string} deviceInfo - Device information
   * @param {string} ipAddress - IP address
   * @param {number} expiresInHours - Session expiry in hours (default: 8)
   * @returns {Promise<Object>} Session data
   */
  async createSession(userId, deviceInfo, ipAddress, expiresInHours = 8) {
    try {
      const sessionToken = this.generateSessionToken();
      const refreshToken = this.generateRefreshToken();
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      const session = await prisma.user_sessions.create({
        data: {
          user_id: userId,
          session_token: sessionToken,
          refresh_token: refreshToken,
          device_info: deviceInfo,
          ip_address: ipAddress,
          expires_at: expiresAt
        }
      });

      console.log(`✅ Created session for user ${userId}`);
      return {
        session_token: sessionToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        session_id: session.id
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate session token
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object|null>} Session data or null
   */
  async validateSession(sessionToken) {
    try {
      const session = await prisma.user_sessions.findFirst({
        where: {
          session_token: sessionToken,
          is_active: true,
          expires_at: { gt: new Date() }
        },
        include: {
          users: {
            include: {
              organizations: true,
              departments: true
            }
          }
        }
      });

      if (session) {
        // Update last activity
        await prisma.user_sessions.update({
          where: { id: session.id },
          data: { last_activity: new Date() }
        });

        return session;
      }

      return null;
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Invalidate session
   * @param {string} sessionToken - Session token
   */
  async invalidateSession(sessionToken) {
    try {
      await prisma.user_sessions.updateMany({
        where: { session_token: sessionToken },
        data: { is_active: false }
      });
      console.log(`🔒 Invalidated session: ${sessionToken}`);
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  }

  /**
   * Invalidate all sessions for user
   * @param {string} userId - User UUID
   */
  async invalidateAllUserSessions(userId) {
    try {
      await prisma.user_sessions.updateMany({
        where: { user_id: userId },
        data: { is_active: false }
      });
      console.log(`🔒 Invalidated all sessions for user: ${userId}`);
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await prisma.user_sessions.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: new Date() } },
            { is_active: false }
          ]
        }
      });
      console.log(`🧹 Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      return 0;
    }
  }

  /**
   * Generate secure session token
   * @returns {string} Session token
   */
  generateSessionToken() {
    return jwt.sign(
      { 
        type: 'session',
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7)
      }, 
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '8h' }
    );
  }

  /**
   * Generate refresh token
   * @returns {string} Refresh token
   */
  generateRefreshToken() {
    return jwt.sign(
      { 
        type: 'refresh',
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7)
      }, 
      process.env.JWT_REFRESH_SECRET || 'refresh_secret_key',
      { expiresIn: '7d' }
    );
  }
}

const sessionManager = new SessionManager();

/**
 * Enhanced Authentication Middleware with RBAC
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next function
 */
export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const sessionToken = req.headers['x-session-token'];
  
  if (!authHeader && !sessionToken) {
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
    let user = null;
    let sessionData = null;

    // Try session-based authentication first (new system)
    if (sessionToken) {
      sessionData = await sessionManager.validateSession(sessionToken);
      if (sessionData) {
        user = {
          ...sessionData.users,
          table: 'users',
          session_id: sessionData.id,
          organization_name: sessionData.users.organizations?.name,
          department_name: sessionData.users.departments?.name
        };
        console.log('✅ Session-based auth successful:', user.username);
      }
    }

    // Fallback to JWT-based authentication (legacy/API support)
    if (!user && authHeader) {
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token không hợp lệ' 
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
      
      // Query user from database (updated to use users instead of users)
      const users = await prisma.$queryRaw`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.phone,
          u.organization_id,
          u.department_id,
          u.is_active,
          o.name as organization_name,
          d.name as department_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ${decoded.id}::uuid
        AND u.is_active = true
      `;
      
      if (users.length > 0) {
        user = {
          ...users[0],
          table: 'users',
          role: 'USER' // Standard role for JWT-based auth
        };
        console.log('✅ JWT-based auth successful:', user.username);
      }
    }

    if (!user) {
      await auditService.logAccessDenied(
        null, null, 'authentication', 'auth', null,
        req.ip, req.get('User-Agent')
      );
      return res.status(401).json({ 
        success: false, 
        message: 'User không tồn tại hoặc đã bị vô hiệu hóa' 
      });
    }

    // Load user permissions (only for users with new permission system)
    if (user.table === 'users') {
      try {
        const permissions = await permissionService.getUserPermissions(user.id);
        user.permissions = permissions;
        console.log(`📋 Loaded permissions for user ${user.username}`);
      } catch (error) {
        console.error('Error loading user permissions:', error);
        user.permissions = { roles: [], direct: [], resources: [] };
      }
    } else {
      // Legacy users - basic permissions
      user.permissions = { roles: [], direct: [], resources: [] };
    }

    // Add user info to request
    req.user = user;
    req.sessionData = sessionData;

    // Add audit context
    req.auditContext = auditService.getRequestContext(req);

    // Log successful authentication (only for new system)
    if (user.table === 'users') {
      await auditService.batchLog({
        userId: user.id,
        organizationId: user.organization_id,
        action: 'read',
        resourceType: 'auth',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
        newValues: {
          auth_method: sessionToken ? 'session' : 'jwt',
          username: user.username
        }
      });
    }

    // Debug log (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Auth successful: ${user.username} from ${user.table}`);
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

      // Skip permission check for legacy users (users table)
      if (req.user.table !== 'users') {
        console.log(`⚠️ Skipping permission check for legacy user: ${req.user.username}`);
        return next();
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

      // Skip permission check for legacy users
      if (req.user.table !== 'users') {
        return next();
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
    // Only audit for users (new system)
    if (req.user?.table !== 'users') {
      return next();
    }

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
      auditService.batchLog({
        userId: req.user?.id,
        organizationId: req.user?.organization_id,
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

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

// Export session manager for use in controllers
export { sessionManager };