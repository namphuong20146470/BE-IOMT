import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class AuditService {
  constructor() {
    this.batchSize = 100;
    this.batchTimeout = 5000; // 5 seconds
    this.pendingLogs = [];
    this.batchTimer = null;
    
    // Map auth constants to database enum values
    this.actionMapping = {
      'LOGIN_SUCCESS': 'login',
      'LOGIN_FAILED': 'failed_login',
      'LOGOUT': 'logout',
      'TOKEN_REFRESH': 'read',
      'PASSWORD_CHANGE': 'password_changed',
      'PROFILE_UPDATE': 'update',
      'SESSION_EXPIRED': 'logout',
      'ACCOUNT_LOCKED': 'failed_login',
      'PERMISSION_DENIED': 'access_denied'
    };
  }

  /**
   * Map action constants to database enum values
   * @param {string} action - Action constant
   * @returns {string} Database enum value
   */
  mapAction(action) {
    return this.actionMapping[action] || action.toLowerCase();
  }

  /**
   * Log an activity with audit trail
   * @param {Object} logData - Audit log data
   * @param {string} logData.userId - User UUID (optional)
   * @param {string} logData.organizationId - Organization UUID (optional)
   * @param {string} logData.action - Action type (create, read, update, delete, etc.)
   * @param {string} logData.resourceType - Resource type
   * @param {string} logData.resourceId - Resource UUID (optional)
   * @param {Object} logData.oldValues - Old values (for updates/deletes)
   * @param {Object} logData.newValues - New values (for creates/updates)
   * @param {string} logData.ipAddress - IP address
   * @param {string} logData.userAgent - User agent string
   * @param {boolean} logData.success - Operation success status
   * @param {string} logData.errorMessage - Error message if failed
   * @returns {Promise<Object>} Created audit log
   */
  async log(logData) {
    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          user_id: logData.userId || null,
          organization_id: logData.organizationId || null,
          action: this.mapAction(logData.action),
          resource_type: logData.resourceType || null,
          resource_id: logData.resourceId || null,
          old_values: logData.oldValues || null,
          new_values: logData.newValues || null,
          ip_address: logData.ipAddress || null,
          user_agent: logData.userAgent || null,
          success: logData.success !== false, // Default to true unless explicitly false
          error_message: logData.errorMessage || null
        }
      });

      console.log(`📝 Audit log created: ${logData.action} on ${logData.resourceType} by user ${logData.userId}`);
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw error to avoid breaking main operation
      return null;
    }
  }

  /**
   * Batch log multiple activities (for performance)
   * @param {Object} logData - Audit log data
   */
  async batchLog(logData) {
    try {
      this.pendingLogs.push({
        user_id: logData.userId || null,
        organization_id: logData.organizationId || null,
        action: logData.action,
        resource_type: logData.resourceType || null,
        resource_id: logData.resourceId || null,
        old_values: logData.oldValues || null,
        new_values: logData.newValues || null,
        ip_address: logData.ipAddress || null,
        user_agent: logData.userAgent || null,
        success: logData.success !== false,
        error_message: logData.errorMessage || null,
        created_at: new Date()
      });

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.flushBatch();
        }, this.batchTimeout);
      }

      // Flush immediately if batch is full
      if (this.pendingLogs.length >= this.batchSize) {
        this.flushBatch();
      }
    } catch (error) {
      console.error('Error adding to batch log:', error);
    }
  }

  /**
   * Flush pending batch logs to database
   */
  async flushBatch() {
    if (this.pendingLogs.length === 0) return;

    try {
      const logsToFlush = [...this.pendingLogs];
      this.pendingLogs = [];
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      await prisma.audit_logs.createMany({
        data: logsToFlush,
        skipDuplicates: true
      });

      console.log(`📝 Flushed ${logsToFlush.length} audit logs to database`);
    } catch (error) {
      console.error('Error flushing batch logs:', error);
      // Re-add failed logs back to pending (with limit to avoid infinite growth)
      if (this.pendingLogs.length < this.batchSize * 2) {
        this.pendingLogs.unshift(...this.pendingLogs.slice(0, this.batchSize));
      }
    }
  }

  /**
   * Log user login activity
   * @param {string} userId - User UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @param {boolean} success - Login success
   * @param {string} errorMessage - Error message if failed
   */
  async logLogin(userId, organizationId, ipAddress, userAgent, success = true, errorMessage = null) {
    return await this.log({
      userId,
      organizationId,
      action: 'login',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success,
      errorMessage,
      newValues: {
        timestamp: new Date(),
        method: 'jwt'
      }
    });
  }

  /**
   * Log user logout activity
   * @param {string} userId - User UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   */
  async logLogout(userId, organizationId, ipAddress, userAgent) {
    return await this.log({
      userId,
      organizationId,
      action: 'logout',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true,
      newValues: {
        timestamp: new Date()
      }
    });
  }

  /**
   * Log permission granted activity
   * @param {string} userId - Target user UUID
   * @param {string} permissionId - Permission UUID
   * @param {string} grantedBy - Granter user UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   */
  async logPermissionGranted(userId, permissionId, grantedBy, organizationId, ipAddress, userAgent) {
    return await this.log({
      userId: grantedBy,
      organizationId,
      action: 'permission_granted',
      resourceType: 'permission',
      resourceId: permissionId,
      ipAddress,
      userAgent,
      success: true,
      newValues: {
        target_user_id: userId,
        permission_id: permissionId,
        granted_by: grantedBy,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log role assigned activity
   * @param {string} userId - Target user UUID
   * @param {string} roleId - Role UUID
   * @param {string} assignedBy - Assigner user UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   */
  async logRoleAssigned(userId, roleId, assignedBy, organizationId, ipAddress, userAgent) {
    return await this.log({
      userId: assignedBy,
      organizationId,
      action: 'role_assigned',
      resourceType: 'role',
      resourceId: roleId,
      ipAddress,
      userAgent,
      success: true,
      newValues: {
        target_user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log access denied activity
   * @param {string} userId - User UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} permission - Required permission
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource UUID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   */
  async logAccessDenied(userId, organizationId, permission, resourceType, resourceId, ipAddress, userAgent) {
    return await this.log({
      userId,
      organizationId,
      action: 'access_denied',
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      success: false,
      errorMessage: `Access denied: missing permission '${permission}'`,
      newValues: {
        required_permission: permission,
        attempted_resource: resourceType,
        attempted_resource_id: resourceId,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log CRUD operations
   * @param {string} userId - User UUID
   * @param {string} organizationId - Organization UUID
   * @param {string} action - CRUD action (create, read, update, delete)
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource UUID
   * @param {Object} oldValues - Old values (for update/delete)
   * @param {Object} newValues - New values (for create/update)
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @param {boolean} success - Operation success
   * @param {string} errorMessage - Error message if failed
   */
  async logCRUD(userId, organizationId, action, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent, success = true, errorMessage = null) {
    return await this.log({
      userId,
      organizationId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  /**
   * Get audit logs with filtering
   * @param {Object} filters - Filter options
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 50)
   * @returns {Promise<Object>} Paginated audit logs
   */
  async getAuditLogs(filters = {}, page = 1, limit = 50) {
    try {
      const where = {};
      
      if (filters.userId) where.user_id = filters.userId;
      if (filters.organizationId) where.organization_id = filters.organizationId;
      if (filters.action) where.action = filters.action;
      if (filters.resourceType) where.resource_type = filters.resourceType;
      if (filters.resourceId) where.resource_id = filters.resourceId;
      if (filters.success !== undefined) where.success = filters.success;
      if (filters.dateFrom) {
        where.created_at = { ...where.created_at, gte: new Date(filters.dateFrom) };
      }
      if (filters.dateTo) {
        where.created_at = { ...where.created_at, lte: new Date(filters.dateTo) };
      }

      const [logs, total] = await Promise.all([
        prisma.audit_logs.findMany({
          where,
          include: {
            users: {
              select: {
                id: true,
                username: true,
                full_name: true
              }
            },
            organizations: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.audit_logs.count({ where })
      ]);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * Get security-related audit logs
   * @param {string} organizationId - Organization UUID (optional)
   * @param {number} hours - Hours to look back (default: 24)
   * @returns {Promise<Array>} Security audit logs
   */
  async getSecurityLogs(organizationId = null, hours = 24) {
    try {
      const where = {
        action: {
          in: ['login', 'logout', 'access_denied', 'permission_granted', 'permission_revoked', 'role_assigned', 'role_removed']
        },
        created_at: {
          gte: new Date(Date.now() - hours * 60 * 60 * 1000)
        }
      };

      if (organizationId) {
        where.organization_id = organizationId;
      }

      const logs = await prisma.audit_logs.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true
            }
          },
          organizations: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return logs;
    } catch (error) {
      console.error('Error getting security logs:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   * @param {string} organizationId - Organization UUID (optional)
   * @param {number} days - Days to look back (default: 7)
   * @returns {Promise<Object>} Audit statistics
   */
  async getAuditStats(organizationId = null, days = 7) {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const where = {
        created_at: { gte: dateFrom }
      };

      if (organizationId) {
        where.organization_id = organizationId;
      }

      const [totalLogs, successfulLogs, failedLogs, actionStats] = await Promise.all([
        prisma.audit_logs.count({ where }),
        prisma.audit_logs.count({ where: { ...where, success: true } }),
        prisma.audit_logs.count({ where: { ...where, success: false } }),
        prisma.audit_logs.groupBy({
          by: ['action'],
          where,
          _count: true,
          orderBy: { _count: { action: 'desc' } }
        })
      ]);

      return {
        total_logs: totalLogs,
        successful_logs: successfulLogs,
        failed_logs: failedLogs,
        success_rate: totalLogs > 0 ? ((successfulLogs / totalLogs) * 100).toFixed(2) : 0,
        actions: actionStats.map(stat => ({
          action: stat.action,
          count: stat._count
        })),
        period: {
          from: dateFrom,
          to: new Date(),
          days
        }
      };
    } catch (error) {
      console.error('Error getting audit stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup old audit logs
   * @param {number} retentionDays - Days to retain (default: 365)
   * @returns {Promise<number>} Number of deleted logs
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const result = await prisma.audit_logs.deleteMany({
        where: {
          created_at: { lt: cutoffDate }
        }
      });

      console.log(`🧹 Cleaned up ${result.count} old audit logs older than ${retentionDays} days`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up old audit logs:', error);
      throw error;
    }
  }

  /**
   * Log an activity with audit trail (Legacy method for backward compatibility)
   * @param {string} userId - User UUID
   * @param {string} action - Action type
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource UUID
   * @param {Object} details - Additional details
   * @param {string} organizationId - Organization UUID (optional)
   * @returns {Promise<Object>} Created audit log
   */
  async logActivity(userId, action, resourceType, resourceId, details = {}, organizationId = null) {
    return await this.log({
      userId,
      organizationId,
      action,
      resourceType,
      resourceId,
      newValues: details,
      success: true
    });
  }

  /**
   * Get request context from Express request
   * @param {Object} req - Express request object
   * @returns {Object} Context data
   */
  getRequestContext(req) {
    return {
      userId: req.user?.id || null,
      organizationId: req.user?.organization_id || null,
      ipAddress: req.ip || req.connection.remoteAddress || null,
      userAgent: req.get('User-Agent') || null
    };
  }

  /**
   * Graceful shutdown - flush pending logs
   */
  async shutdown() {
    console.log('🔄 AuditService shutting down, flushing pending logs...');
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flushBatch();
    console.log('✅ AuditService shutdown complete');
  }
}

export default new AuditService();