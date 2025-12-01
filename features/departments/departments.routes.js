// features/departments/departments.routes.js
import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission, requireOrganization } from '../../shared/middleware/rbacMiddleware.js';
import * as departmentsController from './departments.controller.js';
import { validateCreateDepartment, validateUpdateDepartment } from './departments.validation.js';

const router = express.Router();

// ====================================================================
// DEPARTMENTS ROUTES
// ====================================================================

// GET / - Get departments (filtered by user's organization or query param)
router.get('/', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getAllDepartments
);

// GET /:id - Get department by ID
router.get('/:id', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentById
);

// GET /organization/:organizationId - Get departments by organization ID
router.get('/organization/:organizationId', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentsByOrganization
);

// POST / - Create new department
router.post('/', 
    authMiddleware, 
    requirePermission('department.create'), 
    validateCreateDepartment,
    departmentsController.createDepartment
);

// PUT /:id - Update department
router.put('/:id', 
    authMiddleware, 
    requirePermission('department.update'), 
    validateUpdateDepartment,
    departmentsController.updateDepartment
);

// DELETE /:id - Delete department
router.delete('/:id', 
    authMiddleware, 
    requirePermission('department.delete'), 
    departmentsController.deleteDepartment
);

// GET /:id/statistics - Get department statistics
router.get('/:id/statistics', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentStatistics
);

// GET /organization/:organizationId/statistics - Get all department statistics for an organization
router.get('/organization/:organizationId/statistics', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getOrganizationDepartmentStatistics
);

export default router;