import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { createRole, getAllRoles, deleteRole, updateRole } from '../controllers/roles/role.controller.js';
// Import các controller cần thiết
import {
    loginUser,
    getAllUsers,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deleteAllUsersExceptAdmin

} from '../controllers/users/user.controller.js';

// V2 User controllers
import { 
    createUserV2, 
    loginV2, 
    getAllUsersV2, 
    getUserV2ById,
    updateUserV2
} from '../controllers/users/user_V2.controller.js';

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

// Import các controller cần thiết cho logs
import { getAllLogs, createLog, deleteLog, deleteAllLogs } from '../controllers/logs/log.controller.js';

//Logout route
import { logoutUser } from '../controllers/users/user.controller.js';


const router = express.Router();

// Xem dashboard theo quyền ROLES
router.get('/roles', getAllRoles);
router.post('/roles', authMiddleware, createRole);
router.put('/roles/:id_role', authMiddleware, updateRole);
router.delete('/roles/:id_role', authMiddleware, deleteRole);

// Lấy danh sách user (chỉ trưởng phòng TBYT và BGĐ BV)
router.get('/users', getAllUsers);
router.post('/users', authMiddleware, createUser);
router.put('/users/:id', authMiddleware, updateUser);
router.delete('/users/:id', authMiddleware, deleteUser);
router.post('/users/all-except-admin', authMiddleware, deleteAllUsersExceptAdmin);

// V2 User routes with /v2 prefix
router.post('/v2/users', createUserV2);
router.post('/v2/login', loginV2);
router.get('/v2/users', getAllUsersV2);
router.get('/v2/users/:id', getUserV2ById);
router.put('/v2/users/:id', updateUserV2);

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

// Lấy tất cả logs (chỉ trưởng phòng TBYT, BGĐ BV, NCC GP)
router.get('/logs', getAllLogs);
router.post('/logs', authMiddleware, createLog);
router.delete('/logs/:id', authMiddleware, deleteLog);
// Xóa toàn bộ logs (chỉ trưởng phòng TBYT, BGĐ BV, NCC GP)
router.post('/logs/all', deleteAllLogs);

// Đăng nhập
router.post('/login', loginUser);
// Đăng xuất
router.post('/logout', authMiddleware, logoutUser);
export default router;