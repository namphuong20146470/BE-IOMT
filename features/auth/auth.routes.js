// features/auth/auth.routes.js
import express from 'express';
import * as authController from './auth.controller.js';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import roleRoutes from '../roles/roles.routes.js';
import { 
    validateLogin, 
    validateChangePassword, 
    validateUpdateProfile,
    validateRefreshToken 
} from './auth.validator.js';

const router = express.Router();

// Public routes
router.post('/login', validateLogin, authController.login);
router.post('/refresh', validateRefreshToken, authController.refreshToken);

// Debug route (DEVELOPMENT ONLY)
router.post('/debug-token', authController.debugToken);

// Protected routes (require authentication)
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/me', authMiddleware, authController.getMe);  // ✅ Full profile for app init
router.get('/permissions', authMiddleware, authController.getPermissions);  // ✅ Permissions with caching
router.get('/verify', authMiddleware, authController.verifySession);
router.post('/change-password', authMiddleware, validateChangePassword, authController.changePassword);
router.patch('/profile', authMiddleware, validateUpdateProfile, authController.updateProfile);  // ✅ Update user profile

// Role management alias for backward compatibility
// Frontend expects /api/v1/auth/roles but actual endpoint is /api/v1/roles
router.use('/roles', roleRoutes);

export default router;