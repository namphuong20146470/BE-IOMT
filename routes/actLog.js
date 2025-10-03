import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { createRole, getAllRoles, deleteRole, updateRole } from '../controllers/roles/role.controller.js';

// Import device routes
import deviceRoutes from './deviceRoutes.js';
// Import device data processor routes
import deviceDataRoutes from './deviceDataRoutes.js';
// Import MQTT device routes
import mqttRoutes from './mqttRoutes.js';
// Import các controller cần thiết
import {
    loginUser,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deleteAllUsersExceptAdmin,
    refreshToken,
    logoutAllSessions,
    getUserSessions,
    terminateSession,
    getSessionStatistics
} from '../controllers/users/user.controller.js';

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

// Add this import at the top with the other imports
import {
    debugUserPermissions,
    assignPermissionToUser,
    getUserPermissions
} from '../controllers/users/userPermission.controller.js';

//Logout route
import { logoutUser } from '../controllers/users/user.controller.js';

// Import JWT for token testing
import jwt from 'jsonwebtoken';


const router = express.Router();

// Xem dashboard theo quyền ROLES
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

// Role-Permission Management
router.post('/roles/:roleId/permissions', authMiddleware, assignPermissionToRole);
router.delete('/roles/:roleId/permissions/:permissionId', authMiddleware, removePermissionFromRole);
router.get('/roles/:roleId/permissions', authMiddleware, getRolePermissions);
router.put('/roles/:roleId/permissions', authMiddleware, updateRolePermissions);
// Add these routes in the appropriate section
// User Permission Management routes
router.get('/users/:userId/permissions/debug', debugUserPermissions);
router.get('/users/:userId/permissions', getUserPermissions);
router.post('/users/:userId/permissions', assignPermissionToUser);
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
router.post('/logout', authMiddleware, logoutUser);

// Token test endpoints
router.get('/auth/test', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        user: req.user,
        timestamp: new Date().toISOString()
    });
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

export default router;