import { PrismaClient } from '@prisma/client';
import { checkDeviceWarnings } from '../deviceWarningLogs/deviceWarningLogs.controller.js';
const prisma = new PrismaClient();

function toVietnamTime(date) {
    if (!date) return null;
    const vnDate = new Date(date);
    vnDate.setHours(vnDate.getHours() + 7);
    return vnDate.toISOString().replace('T', ' ').substring(0, 19); // "YYYY-MM-DD HH:mm:ss"
}

// Lấy toàn bộ audit logs (không phân biệt quyền, chỉ dùng cho mục đích quản trị hoặc kiểm thử)
export const getAllLogs = async (req, res) => {
    try {
        const logs = await prisma.logs.findMany({
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        role_id: true, // Lấy role_id trực tiếp
                        roles: {
                            select: {
                                id: true,
                                name: true,
                                description: true
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Chuyển đổi thời gian sang giờ Việt Nam

        return res.json(logs);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Ghi audit log hành động (mọi user đều có thể ghi log)
export const createLog = async (req, res) => {
    try {
        const { action, details, target, user_id } = req.body;
        // Lấy giờ hiện tại theo VN
        const now = new Date();
        now.setHours(now.getHours() + 7); // Cộng thêm 7 tiếng
        const log = await prisma.logs.create({
            data: { user_id, action, details, target, created_at: now }
        });
        return res.status(201).json(log);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xóa audit log (DELETE /logs/:id)
export const deleteLog = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.logs.delete({ where: { id: Number(id) } });
        return res.json({ message: 'Xóa audit log thành công' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xóa toàn bộ audit logs (DELETE /logs/all)
export const deleteAllLogs = async (req, res) => {
    try {
        const { confirmReset } = req.body;
        if (confirmReset !== 'CONFIRM_DELETE_ALL_DATA') {
            return res.status(400).json({
                success: false,
                message: "Xác nhận xóa không hợp lệ. Vui lòng gửi confirmReset: 'CONFIRM_DELETE_ALL_DATA'"
            });
        }
        // Xóa toàn bộ audit logs
        await prisma.logs.deleteMany({});
        // KHÔNG ghi log vào bảng logs nữa!
        return res.json({ message: 'Đã xóa toàn bộ audit logs thành công!' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Tạo test warning để kiểm tra hệ thống cảnh báo (POST /logs/test-warning)
export const createTestWarning = async (req, res) => {
    try {
        const { device_type, data } = req.body;
        const warnings = await checkDeviceWarnings(device_type, data);
        res.json({
            success: true,
            warnings_created: warnings?.length || 0,
            warnings: warnings || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}