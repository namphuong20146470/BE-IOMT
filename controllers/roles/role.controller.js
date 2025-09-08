import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Lấy toàn bộ role (GET /roles)
export const getAllRoles = async (req, res) => {
    try {
        const roles = await prisma.roles.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                id_role: true
            }
        });
        return res.json(roles);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Tạo role mới (POST /roles)
export const createRole = async (req, res) => {
    try {
        const { name, description, id_role } = req.body;
        const role = await prisma.roles.create({
            data: { name, description, id_role }
        });

        // Ghi log tạo role
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'CREATE',
                target: 'roles',
                details: JSON.stringify({ createdRole: role }),
                created_at: getVietnamDate()
            }
        });

        return res.status(201).json(role);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Sửa role (PUT /roles/:id)
// Sửa role (PUT /roles/:id_role)
export const updateRole = async (req, res) => {
    try {
        const { id_role } = req.params;
        const { name, description } = req.body;

        const oldRole = await prisma.roles.findUnique({
            where: { id_role }
        });

        if (!oldRole) {
            return res.status(404).json({ message: 'Không tìm thấy role với id_role này' });
        }

        const role = await prisma.roles.update({
            where: { id_role },
            data: { name, description }
        });

        // Ghi log cập nhật role
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'UPDATE',
                target: 'roles',
                details: JSON.stringify({
                    before: oldRole,
                    after: role
                }),
                created_at: getVietnamDate()
            }
        });

        return res.json(role);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Xóa role (DELETE /roles/:id_role)
export const deleteRole = async (req, res) => {
    try {
        const { id_role } = req.params;

        const roleToDelete = await prisma.roles.findUnique({
            where: { id_role }
        });

        await prisma.roles.delete({ where: { id_role } });

        // Ghi log xóa role
        await prisma.logs.create({
            data: {
                user_id: req.user?.id || null,
                action: 'DELETE',
                target: 'roles',
                details: JSON.stringify({ deletedRole: roleToDelete }),
                created_at: getVietnamDate()
            }
        });

        return res.json({ message: 'Xóa role thành công' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};