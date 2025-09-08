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