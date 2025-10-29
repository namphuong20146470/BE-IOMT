/**
 * 🔐 Authentication Routes
 * Clean route definitions using micro-controllers
 */

import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';

// Import micro-controllers
import * as authController from './controllers/auth.controller.js';
import * as sessionController from './controllers/session.controller.js';
import * as profileController from './controllers/profile.controller.js';
import * as passwordController from './controllers/password.controller.js';

// Import validators
import { 
    validateLogin, 
    validateChangePassword, 
    validateUpdateProfile,
    validateRefreshToken 
} from './validators/auth.validator.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Authentication
router.post('/login', validateLogin, authController.login);
router.post('/refresh', validateRefreshToken, sessionController.refreshToken);

// Password Reset (Future implementation)
router.post('/reset-password-request', passwordController.requestPasswordReset);
router.post('/reset-password', passwordController.resetPassword);

// Debug Routes (DEVELOPMENT ONLY - Remove in production)
if (process.env.NODE_ENV !== 'production') {
    const debugController = await import('./controllers/debug.controller.js');
    router.post('/debug-token', debugController.debugToken);
}

// ==========================================  
// PROTECTED ROUTES (Authentication required)
// ==========================================

// Session Management
router.post('/logout', authMiddleware, authController.logout);
router.get('/verify', authMiddleware, sessionController.verifySession);
router.delete('/sessions/:sessionId', authMiddleware, sessionController.terminateSession);
router.get('/sessions/statistics', authMiddleware, sessionController.getSessionStatistics);

// Profile Management
router.get('/profile', authMiddleware, profileController.getProfile);
router.get('/me', authMiddleware, profileController.getMe);
router.patch('/profile', authMiddleware, validateUpdateProfile, profileController.updateProfile);

// Password Management
router.post('/change-password', authMiddleware, validateChangePassword, passwordController.changePassword);

export default router;