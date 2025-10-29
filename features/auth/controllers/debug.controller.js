/**
 * 🐛 Debug Controller (DEVELOPMENT ONLY)
 * Advanced debugging tools for authentication issues
 */

import sessionService from '../../../shared/services/SessionService.js';
import { sendSuccess, sendError, sendInternalError } from '../helpers/response.helper.js';
import prisma from '../../../config/db.js';

/**
 * 🐛 DEBUG TOKEN - Advanced refresh token debugging
 * @route POST /auth/debug-token (DEVELOPMENT ONLY)
 */
export const debugToken = async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return sendError(res, 'Debug endpoints not available in production', 403);
    }

    try {
        const { refresh_token, simulate_refresh = false } = req.body;
        
        if (!refresh_token) {
            return sendError(res, 'refresh_token is required for debugging', 400);
        }

        // Hash the token like SessionService does
        const crypto = await import('crypto');
        const hashedToken = crypto.createHash('sha256').update(refresh_token).digest('hex');

        // Find ALL sessions with this refresh token (not just active)
        const sessions = await prisma.user_sessions.findMany({
            where: {
                refresh_token: hashedToken
            },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        is_active: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Check active sessions for comparison
        const activeSessions = await prisma.user_sessions.findMany({
            where: {
                is_active: true,
                expires_at: {
                    gt: new Date()
                }
            },
            select: {
                id: true,
                refresh_token: true,
                expires_at: true,
                is_active: true,
                created_at: true,
                users: {
                    select: {
                        username: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: 5
        });

        let simulateResult = null;
        if (simulate_refresh) {
            // Simulate the refresh process
            try {
                simulateResult = await sessionService.refreshAccessToken(refresh_token);
            } catch (error) {
                simulateResult = {
                    success: false,
                    error: error.message
                };
            }
        }

        // Check for hash collisions (very unlikely but let's be thorough)
        const duplicateHashes = await prisma.user_sessions.groupBy({
            by: ['refresh_token'],
            having: {
                refresh_token: {
                    _count: {
                        gt: 1
                    }
                }
            },
            _count: true
        });

        return sendSuccess(res, {
            input: {
                token_length: refresh_token.length,
                token_preview: refresh_token.substring(0, 30) + '...',
                token_suffix: '...' + refresh_token.substring(refresh_token.length - 10)
            },
            hashing: {
                algorithm: 'sha256',
                hashed_token: hashedToken,
                hashed_preview: hashedToken.substring(0, 30) + '...',
                hashed_suffix: '...' + hashedToken.substring(hashedToken.length - 10)
            },
            database_query: {
                sessions_with_hash: sessions.length,
                all_sessions_found: sessions.map(s => ({
                    id: s.id,
                    is_active: s.is_active,
                    expires_at: s.expires_at,
                    expired: new Date() > s.expires_at,
                    created_at: s.created_at,
                    username: s.users?.username,
                    user_active: s.users?.is_active
                })),
                active_sessions_sample: activeSessions.map(s => ({
                    id: s.id,
                    token_preview: s.refresh_token?.substring(0, 30) + '...',
                    expires_at: s.expires_at,
                    created_at: s.created_at,
                    username: s.users?.username
                }))
            },
            validation: {
                current_time: new Date().toISOString(),
                duplicate_hashes: duplicateHashes.length,
                simulate_refresh_result: simulateResult
            }
        }, 'Debug information retrieved successfully');

    } catch (error) {
        console.error('Debug token error:', error);
        return sendInternalError(res, 'Debug failed');
    }
};

/**
 * 🔍 DEBUG SESSIONS - Show all user sessions (DEVELOPMENT ONLY)
 * @route GET /auth/debug-sessions/:userId
 */
export const debugUserSessions = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return sendError(res, 'Debug endpoints not available in production', 403);
    }

    try {
        const { userId } = req.params;

        const sessions = await prisma.user_sessions.findMany({
            where: {
                user_id: userId
            },
            include: {
                users: {
                    select: {
                        username: true,
                        email: true,
                        is_active: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        return sendSuccess(res, {
            user_id: userId,
            total_sessions: sessions.length,
            sessions: sessions.map(s => ({
                id: s.id,
                is_active: s.is_active,
                expires_at: s.expires_at,
                expired: new Date() > s.expires_at,
                created_at: s.created_at,
                ip_address: s.ip_address,
                device_info: s.device_info,
                refresh_token_preview: s.refresh_token?.substring(0, 20) + '...',
                user: s.users
            }))
        }, 'User sessions retrieved successfully');

    } catch (error) {
        console.error('Debug user sessions error:', error);
        return sendInternalError(res, 'Debug failed');
    }
};