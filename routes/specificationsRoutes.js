import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
    getSpecificationFields,
    getModelSpecifications,
    upsertModelSpecifications,
    deleteSpecification,
    getSpecificationStats,
    updateSpecification
} from '../controllers/specifications/specifications.controller.js';
import {
    getSpecificationFieldsTemplate,
    getSpecificationCategories,
    upsertSpecificationField,
    getEnhancedModelSpecifications
} from '../controllers/specifications/specificationFields.controller.js';

const router = express.Router();

// ====================================================================
// SPECIFICATIONS ROUTES (All require authentication)
// ====================================================================

// MASTER DATA ROUTES
// Get specification field templates for autocomplete (NEW - using specification_fields table)
router.get('/fields/templates', authMiddleware, getSpecificationFieldsTemplate);

// Get specification categories
router.get('/categories', authMiddleware, getSpecificationCategories);

// Create or update specification field template
router.put('/fields/templates', authMiddleware, upsertSpecificationField);

// LEGACY ROUTES (backward compatibility)
// Get specification fields from existing data
router.get('/fields', authMiddleware, getSpecificationFields);

// Get specification statistics
router.get('/stats', authMiddleware, getSpecificationStats);

// DEVICE MODEL SPECIFICATIONS
// Get enhanced specifications for a specific device model (with templates)
router.get('/models/:device_model_id/enhanced', authMiddleware, getEnhancedModelSpecifications);

// Get specifications for a specific device model (original)
router.get('/models/:device_model_id', authMiddleware, getModelSpecifications);

// Create or update specifications for a device model
router.put('/models/:device_model_id', authMiddleware, upsertModelSpecifications);

// Update a specific specification
router.patch('/models/:device_model_id/specifications/:spec_id', authMiddleware, updateSpecification);

// Delete a specific specification
router.delete('/:specification_id', authMiddleware, deleteSpecification);

export default router;