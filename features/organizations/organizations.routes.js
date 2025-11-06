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

// GET /organizations - Get all organizations (admin/super-admin only)
router.get('/organizations', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getAllOrganizations
);

// GET /organizations/:id - Get organization by ID
router.get('/organizations/:id', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getOrganizationById
);

// GET /organizations/me - Get current user's organization
router.get('/organizations/me', 
    authMiddleware, 
    organizationsController.getCurrentUserOrganization
);

// POST /organizations - Create new organization (super-admin only)
router.post('/organizations', 
    authMiddleware, 
    requirePermission('organization.create'), 
    validateCreateOrganization,
    organizationsController.createOrganization
);

// PUT /organizations/:id - Update organization (admin only for own org)
router.put('/organizations/:id', 
    authMiddleware, 
    requirePermission('organization.update'), 
    validateUpdateOrganization,
    organizationsController.updateOrganization
);

// DELETE /organizations/:id - Delete organization (super-admin only)
router.delete('/organizations/:id', 
    authMiddleware, 
    requirePermission('organization.delete'), 
    organizationsController.deleteOrganization
);

// GET /organizations/:id/statistics - Get organization statistics
router.get('/organizations/:id/statistics', 
    authMiddleware, 
    requirePermission('organization.read'), 
    organizationsController.getOrganizationStatistics
);

export default router;