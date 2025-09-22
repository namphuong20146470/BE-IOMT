import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

class SessionService {
  constructor() {
    this.ACCESS_TOKEN_EXPIRES = '15m';     // 15 phút
    this.REFRESH_TOKEN_EXPIRES = '7d';     // 7 ngày
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
   * @returns {Promise<Object>} Session tokens
   */
  async createSession(userId, deviceInfo = {}, ipAddress = null) {
    try {
      // Generate session and refresh tokens
      const sessionToken = this.generateSessionToken();
      const refreshToken = this.generateRefreshToken();

      // Calculate expires_at (refresh token expiry)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      // Create session record
      const session = await prisma.user_sessions.create({
        data: {
          user_id: userId,
          access_token: sessionToken,
          refresh_token: refreshToken,
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

      // Generate access token (JWT)
      const accessToken = this.generateAccessToken(session.users, sessionToken);

      console.log(`✅ Created session for user: ${session.users.username} from IP: ${ipAddress}`);

      return {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 900, // 15 minutes in seconds
          token_type: 'Bearer',
          session_id: session.id,
          user: session.users
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
  async refreshAccessToken(refreshToken, ipAddress = null) {
    try {
      // Find active session with refresh token
      const session = await prisma.user_sessions.findFirst({
        where: {
          refresh_token: refreshToken,
          is_active: true,
          expires_at: {
            gt: new Date() // Not expired
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

      if (!session) {
        return {
          success: false,
          error: 'Invalid or expired refresh token'
        };
      }

      // Check if user is still active
      if (!session.users.is_active) {
        // Deactivate session if user is inactive
        await this.deactivateSession(session.id);
        return {
          success: false,
          error: 'User account is inactive'
        };
      }

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

      // Generate new access token
      const accessToken = this.generateAccessToken(session.users, session.access_token);

      console.log(`✅ Refreshed access token for user: ${session.users.username}`);

      return {
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 900, // 15 minutes
          token_type: 'Bearer',
          user: session.users
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
          access_token: decoded.jti,
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
      return null;
    }
  }

  /**
   * Logout user (deactivate session)
   * @param {string} sessionToken - Session token or refresh token
   * @returns {Promise<Object>} Logout result
   */
  async logout(sessionToken) {
    try {
      // Find session by access_token or refresh_token
      const session = await prisma.user_sessions.findFirst({
        where: {
          OR: [
            { access_token: sessionToken },
            { refresh_token: sessionToken }
          ],
          is_active: true
        }
      });

      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      await this.deactivateSession(session.id);

      console.log(`✅ Logged out session: ${session.id}`);
      return {
        success: true,
        message: 'Logged out successfully'
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
   * Generate JWT access token
   * @param {Object} user - User object
   * @param {string} sessionToken - Session token (for jti)
   * @returns {string} JWT access token
   */
  generateAccessToken(user, sessionToken) {
    const payload = {
      sub: user.id, // Subject (user ID)
      jti: sessionToken, // JWT ID (session token)
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // Expires in 15 minutes
    };

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