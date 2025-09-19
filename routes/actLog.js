import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createRole, getAllRoles, deleteRole, updateRole } from '../controllers/roles/role.controller.js';

// Import device routes
import deviceRoutes from './deviceRoutes.js';
// Import device data processor routes
import deviceDataRoutes from './deviceDataRoutes.js';
// Import các controller cần thiết
import {
    loginUser,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deleteAllUsersExceptAdmin

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
import { getAllLogs, createLog, deleteLog, deleteAllLogs, createTestWarning } from '../controllers/auditLogs/auditLogs.controller.js';

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

// Lấy danh sách user (chỉ trưởng phòng TBYT và BGĐ BV)
router.get('/users', getAllUsers);
router.post('/users', authMiddleware, createUser);
router.put('/users/:id', authMiddleware, updateUser);
router.delete('/users/:id', authMiddleware, deleteUser);
router.post('/users/all-except-admin', authMiddleware, deleteAllUsersExceptAdmin);

// Organizations routes
router.post('/organizations', createOrganization);
router.get('/organizations', getAllOrganizations);
router.get('/organizations/:id', getOrganizationById);
router.put('/organizations/:id', updateOrganization);

// Departments routes
router.post('/departments', createDepartment);
router.get('/departments', getAllDepartments);
router.get('/departments/organization/:organization_id', getDepartmentsByOrganization);
router.put('/departments/:id', updateDepartment);

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

// Lấy tất cả audit logs (chỉ trưởng phòng TBYT, BGĐ BV, NCC GP)
router.get('/logs', getAllLogs);
router.post('/logs', authMiddleware, createLog);
router.delete('/logs/:id', authMiddleware, deleteLog);
// Xóa toàn bộ audit logs (chỉ trưởng phòng TBYT, BGĐ BV, NCC GP)
router.post('/logs/all', deleteAllLogs);
// Tạo test warning để kiểm tra hệ thống cảnh báo
router.post('/logs/test-warning', authMiddleware, createTestWarning);

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

// Device management routes
router.use('/devices', deviceRoutes);

// Device data processor routes (Dynamic MQTT system)
router.use('/device-processor', deviceDataRoutes);

export default router;