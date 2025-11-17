import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';

import {
    getOrganizations,
    getDepartments,
    getDeviceModels,
    getDeviceCategories,
    getMeasurements,
    createMeasurements,
    getUserProfile
} from '../controllers/masterData/masterData.controller.js';

const router = express.Router();

// ====================================================================
// MASTER DATA ROUTES (All require authentication)
// ====================================================================

// User Profile
router.get('/profile', authMiddleware, getUserProfile);

// Organizations (user can only see their own)
router.get('/organizations', authMiddleware, getOrganizations);

// Departments (filtered by user's organization)
router.get('/departments', authMiddleware, getDepartments);

// Device Models (public within system)
router.get('/device-models', authMiddleware, getDeviceModels);

// Device Categories (public within system)
router.get('/device-categories', authMiddleware, getDeviceCategories);

// Measurements
router.get('/measurements', authMiddleware, getMeasurements);
router.post('/measurements/batch', authMiddleware, createMeasurements);

export default router;