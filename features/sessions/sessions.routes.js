// features/sessions/sessions.routes.js
import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import {
    getUserSessions,
    terminateSession,
    getSessionStatistics,
    getAllActiveSessions,
    terminateAllUserSessions
} from '../../features/users/controllers/index.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Session:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user_id:
 *           type: integer
 *         ip_address:
 *           type: string
 *         user_agent:
 *           type: string
 *         last_activity:
 *           type: string
 *           format: date-time
 *         expires_at:
 *           type: string
 *           format: date-time
 *         is_active:
 *           type: boolean
 */

/**
 * @swagger
 * /api/v1/sessions:
 *   get:
 *     summary: Get current user's sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User sessions retrieved successfully
 */
router.get('/', getUserSessions);

/**
 * @swagger
 * /api/v1/sessions/statistics:
 *   get:
 *     summary: Get session statistics
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session statistics retrieved successfully
 */
router.get('/statistics', getSessionStatistics);

/**
 * @swagger
 * /api/v1/sessions/all:
 *   get:
 *     summary: Get all active sessions (admin only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: All active sessions retrieved successfully
 */
router.get('/all', requirePermission('system.admin'), getAllActiveSessions);

/**
 * @swagger
 * /api/v1/sessions/{sessionId}:
 *   delete:
 *     summary: Terminate specific session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session terminated successfully
 */
router.delete('/:sessionId', terminateSession);

/**
 * @swagger
 * /api/v1/sessions/users/{userId}/terminate-all:
 *   post:
 *     summary: Terminate all sessions for a user (admin only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: All user sessions terminated successfully
 */
router.post('/users/:userId/terminate-all', requirePermission('system.admin'), terminateAllUserSessions);

export default router;