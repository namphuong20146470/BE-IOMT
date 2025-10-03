// routes/auth.routes.js
import express from 'express';
import * as authController from '../controllers/auth/auth.controller.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes (require authentication)
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/me', authMiddleware, authController.getMe);  // ✅ Full profile for app init
router.get('/permissions', authMiddleware, authController.getPermissions);  // ✅ Permissions with caching
router.get('/verify', authMiddleware, authController.verifySession);
router.post('/change-password', authMiddleware, authController.changePassword);

export default router;