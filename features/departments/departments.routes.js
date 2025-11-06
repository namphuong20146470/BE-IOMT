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

// GET /departments - Get departments (filtered by user's organization or query param)
router.get('/departments', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getAllDepartments
);

// GET /departments/:id - Get department by ID
router.get('/departments/:id', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentById
);

// GET /departments/organization/:organizationId - Get departments by organization
router.get('/departments/organization/:organizationId', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentsByOrganization
);

// POST /departments - Create new department
router.post('/departments', 
    authMiddleware, 
    requirePermission('department.create'), 
    validateCreateDepartment,
    departmentsController.createDepartment
);

// PUT /departments/:id - Update department
router.put('/departments/:id', 
    authMiddleware, 
    requirePermission('department.update'), 
    validateUpdateDepartment,
    departmentsController.updateDepartment
);

// DELETE /departments/:id - Delete department
router.delete('/departments/:id', 
    authMiddleware, 
    requirePermission('department.delete'), 
    departmentsController.deleteDepartment
);

// GET /departments/:id/statistics - Get department statistics
router.get('/departments/:id/statistics', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getDepartmentStatistics
);

// GET /departments/organization/:organizationId/statistics - Get all department statistics for an organization
router.get('/departments/organization/:organizationId/statistics', 
    authMiddleware, 
    requirePermission('department.read'), 
    departmentsController.getOrganizationDepartmentStatistics
);

export default router;