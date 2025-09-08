import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Chưa đăng nhập' });

    const token = authHeader.split(' ')[1]; // Lấy phần sau "Bearer "
    if (!token) return res.status(401).json({ message: 'Chưa đăng nhập' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        const user = await prisma.users.findUnique({
            where: { id: decoded.id },
            include: { roles: true }
        });
        if (!user) return res.status(401).json({ message: 'Chưa đăng nhập' });

        // Gán đầy đủ thông tin user vào req.user
        req.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role_id: user.role_id,
            roles: user.roles,
            is_active: user.is_active
        };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
    }
}