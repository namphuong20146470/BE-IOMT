import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

class SessionService {
  constructor() {
    this.ACCESS_TOKEN_EXPIRES = '30m';     // 15 phút
    this.ACCESS_TOKEN_EXPIRES_SECONDS = 30 * 60; // 900 giây
    this.REFRESH_TOKEN_EXPIRES = '7d';     // 7 ngày
    this.REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 604800 giây
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 phút không hoạt động
  }

  // ==========================================
  // SESSION CREATION & MANAGEMENT
  // ==========================================

  /**
   * Create new session for user (login)
   * @param {string} userId - User UUID
   * @param {Object} deviceInfo - Device information
   * @param {string} ipAddress - Client IP address
   * @param {Object} userForToken - Full user data for JWT token
   * @returns {Promise<Object>} Session tokens
   */
  async createSession(userId, deviceInfo = {}, ipAddress = null, userForToken = null) {
    try {
      // Generate session and refresh tokens
      const sessionToken = this.generateSessionToken();
      const refreshToken = this.generateRefreshToken();
      const hashedRefreshToken = this.hashToken(refreshToken);

      // Calculate expires_at (refresh token expiry)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      // Create session record
      const session = await prisma.user_sessions.create({
        data: {
          user_id: userId,
          access_token: sessionToken,
          refresh_token: hashedRefreshToken, // Store hashed version
          device_info: JSON.stringify(deviceInfo),
          ip_address: ipAddress,
          expires_at: expiresAt,
          is_active: true
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true,
              email: true,
              is_active: true
            }
          }
        }
      });

      // Generate access token (JWT) - use session.id as JTI
      const userDataForToken = userForToken || session.users;
      const accessToken = this.generateAccessToken(userDataForToken, session.id); // ✅ Use UUID

      console.log(`✅ Created session for user: ${session.users.username} from IP: ${ipAddress}`);

      return {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: this.ACCESS_TOKEN_EXPIRES_SECONDS, // ✅ 1800 giây (30 phút)
          refresh_expires_in: this.REFRESH_TOKEN_EXPIRES_SECONDS, // ✅ 604800 giây (7 ngày)
          token_type: 'Bearer',
          session_id: session.id,
          user: session.users,
          created_at: session.created_at,
          expires_at: expiresAt
        }
      };
    } catch (error) {
      console.error('Error creating session:', error);
      return {
        success: false,
        error: 'Failed to create session'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @param {string} ipAddress - Client IP address
   * @returns {Promise<Object>} New access token
   */
  async refreshAccessToken(refreshToken, ipAddress = null, sessionId = null) {
    try {
      console.log('🔍 [SessionService] Refresh request:', {
        hasRefreshToken: !!refreshToken,
        refreshTokenLength: refreshToken?.length,
        hasSessionId: !!sessionId,
        sessionId,
        ipAddress
      });

      // Hash the refresh token to match stored version
      const hashedRefreshToken = this.hashToken(refreshToken);
      console.log('🔍 [SessionService] Hashed token preview:', hashedRefreshToken?.substring(0, 20));
      
      // Build query with optional session_id constraint
      let whereClause = {
        refresh_token: hashedRefreshToken,
        is_active: true,
        expires_at: {
          gt: new Date() // Not expired
        }
      };

      // Add session_id constraint if provided
      if (sessionId) {
        whereClause.id = sessionId;
        console.log('🔍 [SessionService] Added session_id constraint:', sessionId);
      }

      console.log('🔍 [SessionService] Query where clause:', {
        has_refresh_token: true,
        is_active: true,
        expires_after: new Date().toISOString(),
        has_session_id: !!sessionId
      });
      
      // Find active session with refresh token
      const session = await prisma.user_sessions.findFirst({
        where: whereClause,
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true,
              email: true,
              organization_id: true,
              department_id: true,
              is_active: true
            }
          }
        }
      });

      console.log('🔍 [SessionService] Session found:', !!session);
      
      if (!session) {
        console.log('❌ [SessionService] No session found with refresh token');
        
        // Debug: Check if any sessions exist for debugging
        const activeSessions = await prisma.user_sessions.findMany({
          where: { is_active: true },
          select: {
            id: true,
            refresh_token: true,
            expires_at: true,
            users: { select: { username: true } }
          },
          take: 3
        });
        
        console.log('🔍 [SessionService] Sample active sessions:', activeSessions.map(s => ({
          id: s.id,
          token_preview: s.refresh_token?.substring(0, 20),
          expires_at: s.expires_at,
          username: s.users?.username
        })));
        
        return {
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'AUTH_REFRESH_TOKEN_INVALID'
        };
      }

      console.log('✅ [SessionService] Session found:', {
        session_id: session.id,
        user_id: session.user_id,
        username: session.users?.username,
        expires_at: session.expires_at
      });

      // Get full user data with roles (same as login)
      const users = await prisma.$queryRaw`
        SELECT u.id, u.username, u.full_name, u.email, 
               u.organization_id, u.department_id,
               u.is_active,
               o.name as organization_name,
               d.name as department_name,
               COALESCE(
                   JSON_AGG(
                       JSON_BUILD_OBJECT(
                           'id', r.id,
                           'name', r.name,
                           'description', r.description,
                           'color', r.color,
                           'icon', r.icon,
                           'permissions', COALESCE(
                               (
                                   SELECT JSON_AGG(p.name)
                                   FROM role_permissions rp
                                   JOIN permissions p ON rp.permission_id = p.id
                                   WHERE rp.role_id = r.id
                               ),
                               '[]'::json
                           )
                       )
                   ) FILTER (WHERE r.id IS NOT NULL),
                   '[]'::json
               ) as roles
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        WHERE u.id = ${session.users.id}::uuid
        AND u.is_active = true
        GROUP BY u.id, u.username, u.full_name, u.email, 
                 u.organization_id, u.department_id,
                 u.is_active, o.name, d.name
      `;

      if (users.length === 0) {
        await this.deactivateSession(session.id);
        return {
          success: false,
          error: 'User not found or inactive'
        };
      }

      const userWithRoles = users[0];
      
      // Parse roles
      const roles = typeof userWithRoles.roles === 'string' 
        ? JSON.parse(userWithRoles.roles) 
        : (userWithRoles.roles || []);

      // Check if user is still active
      if (!userWithRoles.is_active) {
        // Deactivate session if user is inactive
        await this.deactivateSession(session.id);
        return {
          success: false,
          error: 'User account is inactive'
        };
      }

      // Prepare user data for token (same structure as login)
      const userForToken = {
        id: userWithRoles.id,
        username: userWithRoles.username,
        full_name: userWithRoles.full_name,
        email: userWithRoles.email,
        organization_id: userWithRoles.organization_id,
        department_id: userWithRoles.department_id,
        roles
      };

      // Update last activity and IP if different
      const updateData = {
        last_activity: new Date()
      };

      if (ipAddress && ipAddress !== session.ip_address) {
        updateData.ip_address = ipAddress;
      }

      await prisma.user_sessions.update({
        where: { id: session.id },
        data: updateData
      });

      // Generate new access token with full user data
      const accessToken = this.generateAccessToken(userForToken, session.id);

      console.log(`✅ Refreshed access token for user: ${userWithRoles.username}`);

      return {
        success: true,
        data: {
          access_token: accessToken,
          expires_in: this.ACCESS_TOKEN_EXPIRES_SECONDS, // ✅ 900 giây (15 phút)
          token_type: 'Bearer',
          session_id: session.id,
          created_at: session.created_at,
          expires_at: session.expires_at,
          device_id: session.device_info || 'unknown-device',
          user: {
            id: userWithRoles.id,
            username: userWithRoles.username,
            full_name: userWithRoles.full_name,
            email: userWithRoles.email,
            avatar: userWithRoles.avatar || null,
            organization_id: userWithRoles.organization_id,
            department_id: userWithRoles.department_id,
            is_active: userWithRoles.is_active,
            organization_name: userWithRoles.organization_name,
            department_name: userWithRoles.department_name,
            roles: roles
          }
        }
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return {
        success: false,
        error: 'Failed to refresh token'
      };
    }
  }

  /**
   * Validate access token and get session info
   * @param {string} accessToken - JWT access token
   * @returns {Promise<Object|null>} Session info or null
   */
  async validateAccessToken(accessToken) {
    try {
      // Verify JWT
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      
      // Find session by access_token (jti in JWT)
      const session = await prisma.user_sessions.findFirst({
        where: {
          id: decoded.jti, // ✅ Now jti is session.id (UUID)
          is_active: true,
          expires_at: {
            gt: new Date()
          }
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              full_name: true,
              email: true,
              is_active: true
            }
          }
        }
      });

      if (!session || !session.users.is_active) {
        return null;
      }

      // Check session timeout (if last_activity too old)
      const now = new Date();
      const lastActivity = new Date(session.last_activity);
      const timeDiff = now - lastActivity;

      if (timeDiff > this.SESSION_TIMEOUT) {
        // Auto logout due to inactivity
        await this.deactivateSession(session.id);
        return null;
      }

      // Update last activity
      await prisma.user_sessions.update({
        where: { id: session.id },
        data: { last_activity: now }
      });

      return {
        session_id: session.id,
        user: session.users,
        device_info: session.device_info ? JSON.parse(session.device_info) : null,
        ip_address: session.ip_address,
        last_activity: session.last_activity
      };
    } catch (error) {
      console.error('Error validating access token:', error);
      
      if (error.name === 'JsonWebTokenError') {
        console.error('❌ JWT Error Details:');
        console.error('  - Message:', error.message);
        console.error('  - JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.error('  - JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
      }
      
      return null;
    }
  }

  /**
 * Logout user (deactivate session)
 * @param {string} token - Refresh token (plain text) or JWT access token
 * @returns {Promise<Object>} Logout result
 */
async logout(token) {
    try {
        let session = null;

        // Try 1: Hash token and find by refresh_token (most common case)
        const hashedToken = this.hashToken(token);
        session = await prisma.user_sessions.findFirst({
            where: {
                refresh_token: hashedToken,
                is_active: true
            }
        });

        // Try 2: If not found, assume it's a JWT and extract session ID (jti)
        if (!session) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.jti) {
                    session = await prisma.user_sessions.findFirst({
                        where: {
                            id: decoded.jti, // ✅ Use session UUID from JWT
                            is_active: true
                        }
                    });
                }
            } catch (jwtError) {
                console.log('Token is not a valid JWT, skipping JWT check');
            }
        }

        if (!session) {
            return {
                success: false,
                error: 'Session not found or already logged out'
            };
        }

        // Deactivate session
        await this.deactivateSession(session.id);

        console.log(`✅ Logged out session: ${session.id}`);
        return {
            success: true,
            message: 'Logged out successfully',
            session_id: session.id
        };
    } catch (error) {
        console.error('Error during logout:', error);
        return {
            success: false,
            error: 'Failed to logout'
        };
    }
}

  /**
   * Logout all sessions for user
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Logout result
   */
  async logoutAllSessions(userId) {
    try {
      const result = await prisma.user_sessions.updateMany({
        where: {
          user_id: userId,
          is_active: true
        },
        data: {
          is_active: false,
          last_activity: new Date()
        }
      });

      console.log(`✅ Logged out ${result.count} sessions for user: ${userId}`);
      return {
        success: true,
        message: `Logged out ${result.count} sessions`,
        count: result.count
      };
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      return {
        success: false,
        error: 'Failed to logout all sessions'
      };
    }
  }

  // ==========================================
  // SESSION MONITORING & MANAGEMENT
  // ==========================================

  /**
   * Get active sessions for user
   * @param {string} userId - User UUID
   * @returns {Promise<Array>} Active sessions
   */
  async getUserActiveSessions(userId) {
    try {
      const sessions = await prisma.user_sessions.findMany({
        where: {
          user_id: userId,
          is_active: true,
          expires_at: {
            gt: new Date()
          }
        },
        select: {
          id: true,
          device_info: true,
          ip_address: true,
          created_at: true,
          last_activity: true,
          expires_at: true
        },
        orderBy: {
          last_activity: 'desc'
        }
      });

      return sessions.map(session => ({
        ...session,
        device_info: session.device_info ? JSON.parse(session.device_info) : null
      }));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Terminate specific session
   * @param {string} sessionId - Session UUID
   * @param {string} requesterId - User requesting termination
   * @returns {Promise<Object>} Termination result
   */
  async terminateSession(sessionId, requesterId) {
    try {
      const session = await prisma.user_sessions.findUnique({
        where: { id: sessionId },
        include: {
          users: {
            select: { username: true }
          }
        }
      });

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Check permission (only own sessions or admin)
      if (session.user_id !== requesterId) {
        // TODO: Check if requester has admin permission
        const hasAdminPermission = true; // Implement permission check
        if (!hasAdminPermission) {
          return {
            success: false,
            error: 'Permission denied'
          };
        }
      }

      await this.deactivateSession(sessionId);

      console.log(`✅ Terminated session ${sessionId} for user: ${session.users.username}`);
      return {
        success: true,
        message: 'Session terminated successfully'
      };
    } catch (error) {
      console.error('Error terminating session:', error);
      return {
        success: false,
        error: 'Failed to terminate session'
      };
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of cleaned sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await prisma.user_sessions.updateMany({
        where: {
          OR: [
            {
              expires_at: {
                lt: new Date()
              }
            },
            {
              last_activity: {
                lt: new Date(Date.now() - this.SESSION_TIMEOUT * 2) // 1 hour inactive
              }
            }
          ],
          is_active: true
        },
        data: {
          is_active: false
        }
      });

      console.log(`🧹 Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      return 0;
    }
  }

  // ==========================================
  // SECURITY & MONITORING
  // ==========================================

  /**
   * Detect suspicious login activity
   * @param {string} userId - User UUID
   * @param {string} ipAddress - Current IP
   * @returns {Promise<Object>} Security analysis
   */
  async detectSuspiciousActivity(userId, ipAddress) {
    try {
      const recentSessions = await prisma.user_sessions.findMany({
        where: {
          user_id: userId,
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          ip_address: true,
          device_info: true,
          created_at: true
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      const uniqueIPs = new Set(recentSessions.map(s => s.ip_address));
      const isNewIP = !uniqueIPs.has(ipAddress);
      const loginCount24h = recentSessions.length;

      return {
        is_suspicious: isNewIP && loginCount24h > 5,
        new_ip: isNewIP,
        recent_login_count: loginCount24h,
        unique_ips: uniqueIPs.size,
        analysis: {
          risk_level: loginCount24h > 10 ? 'high' : loginCount24h > 5 ? 'medium' : 'low',
          recommendations: isNewIP ? ['Verify device', 'Enable 2FA'] : []
        }
      };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return {
        is_suspicious: false,
        error: 'Security check failed'
      };
    }
  }

  /**
   * Get session statistics
   * @param {string} userId - User UUID (optional)
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStatistics(userId = null) {
    try {
      const where = userId ? { user_id: userId } : {};

      const [totalSessions, activeSessions, expiredSessions] = await Promise.all([
        prisma.user_sessions.count({ where }),
        prisma.user_sessions.count({
          where: {
            ...where,
            is_active: true,
            expires_at: { gt: new Date() }
          }
        }),
        prisma.user_sessions.count({
          where: {
            ...where,
            OR: [
              { is_active: false },
              { expires_at: { lt: new Date() } }
            ]
          }
        })
      ]);

      return {
        total: totalSessions,
        active: activeSessions,
        expired: expiredSessions,
        cleanup_needed: expiredSessions
      };
    } catch (error) {
      console.error('Error getting session statistics:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        error: 'Failed to get statistics'
      };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Generate session token
   * @returns {string} Session token
   */
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate refresh token
   * @returns {string} Refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash token for secure storage
   * @param {string} token - Token to hash
   * @returns {string} Hashed token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate JWT access token with permissions array
   * @param {Object} user - User object with roles
   * @param {string} sessionId - Session UUID (for jti)
   * @returns {string} JWT access token
   */
  generateAccessToken(user, sessionId) {
    const now = Math.floor(Date.now() / 1000);
    
    // ✅ BEST PRACTICE: JWT contains ONLY identity, no permissions/roles
    // Permissions will be loaded from DB on each request for real-time revocation
    const payload = {
      sub: user.id, // Subject (user ID) - PRIMARY identifier
      jti: sessionId, // JWT ID (session UUID) - for session tracking
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      organization_id: user.organization_id,
      department_id: user.department_id,
      
      // ✅ Permission version for cache invalidation (use updated_at timestamp)
      perm_version: user.perm_version || Math.floor(Date.now() / 1000),
      
      iat: now, // Issued at
      exp: now + this.ACCESS_TOKEN_EXPIRES_SECONDS // 30 minutes
    };

    console.log(`🔐 JWT Generated (identity-only) for ${user.username}`);

    return jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: 'HS256'
    });
  }

  /**
   * Deactivate session
   * @param {string} sessionId - Session UUID
   * @returns {Promise<void>}
   */
  async deactivateSession(sessionId) {
    await prisma.user_sessions.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        last_activity: new Date()
      }
    });
  }
}

export default new SessionService();