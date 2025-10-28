import express from 'express';
import { authMiddleware } from '../shared/middleware/authMiddleware.js';
import { requirePermission } from '../shared/middleware/rbacMiddleware.js';
import { createRole, getAllRoles, deleteRole, updateRole } from '../controllers/roles/roles.controller.js';

// Import device routes
import deviceRoutes from './deviceRoutes.js';
// Import device data processor routes
import deviceDataRoutes from './deviceDataRoutes.js';
// Import MQTT device routes
import mqttRoutes from './mqttRoutes.js';
// Import specifications routes
import specificationsRoutes from './specificationsRoutes.js';
// Import các controller cần thiết từ features
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deleteAllUsersExceptAdmin,
    getUserSessions,
    terminateSession,
    getSessionStatistics
} from '../features/users/controllers/index.js';

// Import auth controllers
import {
    login as loginUser,
    refreshToken,
    logout as logoutAllSessions
} from '../features/auth/auth.controller.js';

// Import session management (if needed)
// Note: terminateSession, getSessionStatistics may need to be implemented

// Organizations controllers
import {
    createOrganization,
    getAllOrganizations,
    getOrganizationById,
    updateOrganization
} from '../controllers/organizations/organizations.controller.js';

// Departments controllers
import {
    createDepartment,
    getDepartmentsByOrganization,
    getAllDepartments,
    updateDepartment
} from '../controllers/departments/departments.controller.js';

// Import các controller cần thiết cho audit logs
import { 
    getAllLogs, 
    getLogById,
    createLog, 
    deleteLog, 
    deleteBulkLogs,
    deleteAllLogs, 
    getLogStats,
    exportLogs
} from '../controllers/auditLogs/auditLogs.controller.js';

// Import permission controllers
import {
    assignPermissionToRole,
    removePermissionFromRole,
    getRolePermissions,
    updateRolePermissions,
    getAllPermissions,
    createPermission,
    getPermissionById,
    updatePermission,
    deletePermission,
    getAllPermissionGroups,
    createPermissionGroup
} from '../controllers/permission/permission.controller.js';

// User Permission Management - Import from feature controllers
import {
    assignPermissionToUser,
    getUserPermissions
} from '../features/users/controllers/user-direct-permissions.controller.js';

// Debug functions
import {
    debugUserPermissions
} from '../features/users/controllers/user-debug.controller.js';

// Role management functions
import {
    assignRoleToUser,
    removeRoleFromUser,
    getUserRoles
} from '../features/users/controllers/user-roles.controller.js';

// Auth related imports
import { logout } from '../features/auth/auth.controller.js';

// Import JWT for token testing
import jwt from 'jsonwebtoken';


const router = express.Router();

// Xem dashboard theo quyền ROLES
// ✅ IMPORTANT: Specific routes MUST come before general routes to avoid conflicts
// Role-Permission Management (specific routes first)
router.post('/roles/:roleId/permissions', authMiddleware, assignPermissionToRole);
router.delete('/roles/:roleId/permissions/:permissionId', authMiddleware, removePermissionFromRole);
router.get('/roles/:roleId/permissions', authMiddleware, getRolePermissions);
router.put('/roles/:roleId/permissions', authMiddleware, updateRolePermissions);

// Role CRUD (general routes after specific ones)
router.get('/roles', authMiddleware, getAllRoles);
router.post('/roles', authMiddleware, createRole);
router.put('/roles/:id_role', authMiddleware, updateRole);
router.delete('/roles/:id_role', authMiddleware, deleteRole);

// User Management Routes with RBAC
router.get('/users', authMiddleware, requirePermission('user.read'), getAllUsers);
router.post('/users', authMiddleware, requirePermission('user.create'), createUser);  // ⭐ Now supports role assignment
router.get('/users/:id', authMiddleware, requirePermission('user.read'), getUserById);
router.put('/users/:id', authMiddleware, requirePermission('user.update'), updateUser);
router.delete('/users/:id', authMiddleware, requirePermission('user.delete'), deleteUser);
router.post('/users/all-except-admin', authMiddleware, requirePermission('user.delete'), deleteAllUsersExceptAdmin);

// ====================================================================
// SESSION MANAGEMENT ROUTES
// ====================================================================

// Authentication & Token Management
router.post('/auth/refresh', refreshToken);                          // Refresh access token
router.post('/auth/logout-all', authMiddleware, logoutAllSessions);  // Logout all user sessions

// Session Management (requires authentication)
router.get('/sessions', authMiddleware, getUserSessions);                    // Get user's active sessions
router.delete('/sessions/:sessionId', authMiddleware, terminateSession);    // Terminate specific session
router.get('/sessions/statistics', authMiddleware, getSessionStatistics);   // Get session statistics

// Organizations routes - Protected with authentication + RBAC
router.post('/organizations', authMiddleware, requirePermission('organization.create'), createOrganization);
router.get('/organizations', authMiddleware, requirePermission('organization.read'), getAllOrganizations);
router.get('/organizations/:id', authMiddleware, requirePermission('organization.read'), getOrganizationById);
router.put('/organizations/:id', authMiddleware, requirePermission('organization.update'), updateOrganization);

// Departments routes
router.post('/departments',authMiddleware, createDepartment);
router.get('/departments',authMiddleware, getAllDepartments);
router.get('/departments/organization/:organization_id',authMiddleware, getDepartmentsByOrganization);
router.put('/departments/:id',authMiddleware, updateDepartment);

// ====================================================================
// PERMISSION MANAGEMENT ROUTES
// ====================================================================

// Permission CRUD
router.get('/permissions', authMiddleware, getAllPermissions);
router.post('/permissions', authMiddleware, createPermission);
router.get('/permissions/:permissionId', authMiddleware, getPermissionById);
router.put('/permissions/:permissionId', authMiddleware, updatePermission);
router.delete('/permissions/:permissionId', authMiddleware, deletePermission);

// Permission Groups
router.get('/permission-groups', authMiddleware, getAllPermissionGroups);
router.post('/permission-groups', authMiddleware, createPermissionGroup);

// ====================================================================
// USER PERMISSION AND ROLE MANAGEMENT
// ====================================================================

// User Permission Management routes
router.get('/users/:userId/permissions/debug', debugUserPermissions);
router.get('/users/:userId/permissions', getUserPermissions);
router.post('/users/:userId/permissions', assignPermissionToUser);

// User Role Management routes
router.post('/users/:userId/roles', authMiddleware, requirePermission('user.update'), assignRoleToUser);
router.delete('/users/:userId/roles/:roleId', authMiddleware, requirePermission('user.update'), removeRoleFromUser);
router.get('/users/:userId/roles', authMiddleware, requirePermission('user.read'), getUserRoles);

// ====================================================================
// AUDIT LOGS ROUTES
// ====================================================================

// Basic CRUD operations
router.get('/logs', authMiddleware, getAllLogs);                    // Get all logs with filters and pagination
router.get('/logs/stats', authMiddleware, getLogStats);             // Get audit log statistics
router.get('/logs/export', authMiddleware, exportLogs);             // Export logs (CSV/JSON)
router.get('/logs/:id', authMiddleware, getLogById);                // Get specific log by ID
router.post('/logs', authMiddleware, createLog);                    // Create new audit log
router.delete('/logs/:id', authMiddleware, deleteLog);              // Delete specific log
router.delete('/logs/bulk', authMiddleware, deleteBulkLogs);        // Delete multiple logs
router.delete('/logs/all', authMiddleware, deleteAllLogs);          // Delete all logs (super admin only)

// ====================================================================
// AUTHENTICATION & TOKEN ROUTES


// Đăng nhập
router.post('/login', loginUser);
// Đăng xuất
router.post('/logout', authMiddleware, logout);

// Token test endpoints
router.get('/auth/test', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// ✅ NEW: Debug authentication issues
router.post('/auth/debug', (req, res) => {
    const authHeader = req.headers['authorization'];
    
    console.log('🔍 DEBUG Authentication:');
    console.log('   📋 Headers:', req.headers);
    console.log('   🔑 Auth Header:', authHeader);
    console.log('   🍪 Cookies:', req.cookies);
    console.log('   🌍 JWT_SECRET exists:', !!process.env.JWT_SECRET);
    
    if (!authHeader) {
        return res.status(400).json({ 
            success: false, 
            message: 'No authorization header',
            headers: req.headers
        });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'No token provided',
            authHeader: authHeader
        });
    }

    try {
        // Test JWT verification
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        res.json({
            success: true,
            message: 'Token verification successful',
            decoded: decoded,
            jwt_secret_length: process.env.JWT_SECRET?.length,
            token_length: token.length
        });
    } catch (error) {
        console.error('❌ JWT Verification Error:', error);
        
        res.status(401).json({
            success: false,
            message: 'JWT verification failed',
            error: error.message,
            error_name: error.name,
            jwt_secret_exists: !!process.env.JWT_SECRET,
            token_preview: token.substring(0, 20) + '...'
        });
    }
});

// Decode token without verification (for debugging)
router.get('/auth/decode', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(400).json({ 
            success: false, 
            message: 'No authorization header' 
        });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'No token provided' 
        });
    }

    try {
        // Decode without verification to see payload
        const decoded = jwt.decode(token);
        
        res.json({
            success: true,
            decoded: decoded,
            token_type: 'users', // All tokens are now users
            expires_at: new Date(decoded.exp * 1000).toISOString(),
            issued_at: new Date(decoded.iat * 1000).toISOString()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Invalid token format',
            error: error.message
        });
    }
});



// Device data processor routes (Dynamic MQTT system)
router.use('/device-processor', deviceDataRoutes);

// MQTT device management routes
router.use('/mqtt', mqttRoutes);

// Specifications routes
router.use('/specifications', specificationsRoutes);

export default router;