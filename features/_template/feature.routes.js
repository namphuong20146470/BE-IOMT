/**
 * Feature Routes Template
 * RESTful API endpoints for feature
 */

import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { requirePermission } from '../../middleware/rbacMiddleware.js';
import {
    getAllItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem
} from './feature.controller.js';

const router = express.Router();

// ==========================================
// FEATURE MANAGEMENT ROUTES
// ==========================================

/**
 * @route GET /api/feature-name
 * @desc Get all items with filtering and pagination
 * @access Private - requires 'feature.read' permission
 */
router.get('/', 
    authMiddleware, 
    requirePermission('feature.read'), 
    getAllItems
);

/**
 * @route GET /api/feature-name/:id
 * @desc Get item by ID
 * @access Private - requires 'feature.read' permission
 */
router.get('/:id', 
    authMiddleware, 
    requirePermission('feature.read'), 
    getItemById
);

/**
 * @route POST /api/feature-name
 * @desc Create new item
 * @access Private - requires 'feature.create' permission
 */
router.post('/', 
    authMiddleware, 
    requirePermission('feature.create'), 
    createItem
);

/**
 * @route PUT /api/feature-name/:id
 * @desc Update item
 * @access Private - requires 'feature.update' permission
 */
router.put('/:id', 
    authMiddleware, 
    requirePermission('feature.update'), 
    updateItem
);

/**
 * @route PATCH /api/feature-name/:id
 * @desc Partial update item
 * @access Private - requires 'feature.update' permission
 */
router.patch('/:id', 
    authMiddleware, 
    requirePermission('feature.update'), 
    updateItem
);

/**
 * @route DELETE /api/feature-name/:id
 * @desc Delete item (soft delete)
 * @access Private - requires 'feature.delete' permission
 */
router.delete('/:id', 
    authMiddleware, 
    requirePermission('feature.delete'), 
    deleteItem
);

export default router;