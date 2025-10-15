import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
    getSpecificationFields,
    getModelSpecifications,
    upsertModelSpecifications,
    deleteSpecification,
    getSpecificationStats
} from '../controllers/specifications/specifications.controller.js';

const router = express.Router();

// ====================================================================
// SPECIFICATIONS ROUTES (All require authentication)
// ====================================================================

// Get specification field templates for autocomplete
router.get('/fields', authMiddleware, getSpecificationFields);

// Get specification statistics
router.get('/stats', authMiddleware, getSpecificationStats);

// Get specifications for a specific device model
router.get('/models/:device_model_id', authMiddleware, getModelSpecifications);

// Create or update specifications for a device model
router.put('/models/:device_model_id', authMiddleware, upsertModelSpecifications);

// Delete a specific specification
router.delete('/:specification_id', authMiddleware, deleteSpecification);

export default router;