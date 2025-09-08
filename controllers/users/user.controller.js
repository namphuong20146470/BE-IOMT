import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import bcrypt from 'bcryptjs'; // Đảm bảo đã cài bcryptjs
import jwt from 'jsonwebtoken'; // Đảm bảo đã cài jsonwebtoken

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}
// Lấy danh sách user (chỉ trưởng phòng TBYT và BGĐ BV mới xem được toàn bộ)
// Lấy toàn bộ user (không phân biệt quyền, chỉ dùng cho mục đích quản trị hoặc kiểm thử)
export const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                username: true,
                full_name: true,
                password_hash: true,
                is_active: true,
                roles: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        id_role: true // Thêm trường này
                    }
                }
            }
        });
        return res.json(users);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
// Đăng nhập user (POST /login)
export const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.users.findUnique({
            where: { username },
            include: { roles: true }
        });
        if (!user) {
            return res.status(401).json({ message: 'Sai username hoặc password' });
        }
        // Kiểm tra trạng thái hoạt động
        if (!user.is_active) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa hoặc chưa kích hoạt' });
        }
        // So sánh password (password_hash đã hash bằng bcrypt)
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Sai username hoặc password' });
        }
        // Tạo JWT token
        const token = jwt.sign(
            { id: user.id, role: user.roles?.name },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1d' }
        );
        await prisma.logs.create({
            data: {
                user_id: user.id,
                action: 'login',
                details: 'Đăng nhập thành công',
                target: user.username,
                created_at: getVietnamDate()
            }
        });
        // Trả về user info và token
        return res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.roles?.name,
                role_id: user.role_id
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// controllers/users/user.controller.js

export const logoutUser = async (req, res) => {
    try {
        // Lấy user từ token hoặc session (giả sử đã xác thực)
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Chưa đăng nhập' });
        }
        await prisma.logs.create({
            data: {
                user_id: user.id,
                action: 'logout',
                details: 'Đăng xuất thành công',
                target: user.username,
                created_at: getVietnamDate()
            }
        });

        return res.json({ message: 'Đăng xuất thành công' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
// Lấy danh sách user (chỉ trưởng phòng TBYT và BGĐ BV)
export const getUsers = async (req, res) => {
    const role = req.user?.roles?.name;
    if (role !== 'truong_phong_tbtyt' && role !== 'bgd_bv') {
        return res.status(403).json({ message: 'Không có quyền xem danh sách user' });
    }
    try {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                username: true,
                full_name: true,
                is_active: true,
                roles: { select: { name: true, description: true } }
            }
        });
        return res.json(users);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xem chi tiết user (chỉ trưởng phòng hoặc chính mình)
export const getUserById = async (req, res) => {
    const { id } = req.params;
    const role = req.user?.roles?.name;
    if (role !== 'truong_phong_tbtyt' && req.user.id !== Number(id)) {
        return res.status(403).json({ message: 'Không có quyền xem user này' });
    }
    try {
        const user = await prisma.users.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                username: true,
                full_name: true,
                is_active: true,
                roles: { select: { name: true, description: true } }
            }
        });
        if (!user) return res.status(404).json({ message: 'User không tồn tại' });
        return res.json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Tạo user mới (chỉ trưởng phòng TBYT)
// Tạo user (có ghi log)
export const createUser = async (req, res) => {
    try {
        const { username, password, full_name, id_role } = req.body;

        // Tìm role theo id_role
        const role = await prisma.roles.findUnique({
            where: { id_role }
        });
        if (!role) {
            return res.status(400).json({ message: 'Không tìm thấy role với id_role này' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const user = await prisma.users.create({
            data: { username, password_hash, full_name, role_id: role.id },
        });

        // Ghi log
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'CREATE',
                target: 'admin',
                details: JSON.stringify({ createdUser: user }),
                created_at: getVietnamDate()
            },
        });

        return res.status(201).json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Cập nhật user (chỉ trưởng phòng TBYT, có ghi log)
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        let { username, password, full_name, role_id, is_active } = req.body;

        const oldUser = await prisma.users.findUnique({
            where: { id: Number(id) },
        });

        // Chuẩn bị dữ liệu cập nhật
        const data = {};
        if (username !== undefined) data.username = username;
        if (full_name !== undefined) data.full_name = full_name;
        if (role_id !== undefined) data.role_id = role_id;
        if (is_active !== undefined) data.is_active = is_active;
        if (password) data.password_hash = await bcrypt.hash(password, 10);

        const user = await prisma.users.update({
            where: { id: Number(id) },
            data
        });

        // Ghi log
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'UPDATE',
                target: 'users',
                details: JSON.stringify({
                    before: oldUser,
                    after: user,
                }),
                created_at: getVietnamDate()
            },
        });

        return res.json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xóa user (ai cũng có thể xóa, có ghi log)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const userToDelete = await prisma.users.findUnique({
            where: { id: Number(id) },
        });

        await prisma.users.delete({
            where: { id: Number(id) },
        });

        // Ghi log
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'DELETE',
                target: 'users',
                details: JSON.stringify({ deletedUser: userToDelete }),
                created_at: getVietnamDate()
            },
        });

        return res.json({ message: 'Xóa user thành công' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xóa tất cả user, chỉ giữ lại user "admin"
export const deleteAllUsersExceptAdmin = async (req, res) => {
    try {
        const { confirmReset } = req.body;
        if (confirmReset !== 'CONFIRM_DELETE_ALL_DATA') {
            return res.status(400).json({
                success: false,
                message: "Xác nhận xóa không hợp lệ. Vui lòng gửi confirmReset: 'CONFIRM_DELETE_ALL_DATA'"
            });
        }
        // Xóa tất cả user trừ admin
        await prisma.users.deleteMany({
            where: {
                username: { not: 'admin' }
            }
        });
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'DELETE_ALL_EXCEPT_ADMIN',
                target: 'users',
                details: 'Đã xóa toàn bộ user trừ admin',
                created_at: getVietnamDate()
            }
        });
        return res.json({ message: 'Đã xóa toàn bộ user trừ admin thành công!' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};