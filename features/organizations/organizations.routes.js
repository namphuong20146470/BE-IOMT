// features/organizations/organizations.routes.js
import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission, requireOrganization } from '../../shared/middleware/rbacMiddleware.js';
import * as organizationsController from './organizations.controller.js';
import { validateCreateOrganization, validateUpdateOrganization } from './organizations.validation.js';

const router = express.Router();

// ====================================================================
// ORGANIZATIONS ROUTES
// ====================================================================

// GET / - Get all organizations (admin/super-admin only)
router.get('/', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getAllOrganizations
);

// GET /:id - Get organization by ID
router.get('/:id', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getOrganizationById
);

// GET /me - Get current user's organization
router.get('/me', 
    authMiddleware, 
    organizationsController.getCurrentUserOrganization
);

// POST / - Create new organization (super-admin only)
router.post('/', 
    authMiddleware, 
    requirePermission('organization.create'), 
    validateCreateOrganization,
    organizationsController.createOrganization
);

// PUT /:id - Update organization (admin only for own org)
router.put('/:id', 
    authMiddleware, 
    requirePermission('organization.update'), 
    validateUpdateOrganization,
    organizationsController.updateOrganization
);

// DELETE /:id - Delete organization (super-admin only)
router.delete('/:id', 
    authMiddleware, 
    requirePermission('organization.delete'), 
    organizationsController.deleteOrganization
);

// GET /:id/statistics - Get organization statistics
router.get('/:id/statistics', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getOrganizationStatistics
);

export default router;