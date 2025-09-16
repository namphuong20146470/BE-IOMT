import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

    const token = authHeader.split(' ')[1]; // Lấy phần sau "Bearer "
    if (!token) return res.status(401).json({ success: false, message: 'Token không hợp lệ' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        
        // Only use users_v2 (new system)
        let user = null;
        
        try {
            console.log('🔍 Checking users for ID:', decoded.id);
            const users = await prisma.$queryRaw`
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.full_name,
                    u.phone,
                    u.organization_id,
                    u.department_id,
                    u.is_active,
                    o.name as organization_name,
                    d.name as department_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE u.id = ${decoded.id}::uuid
                AND u.is_active = true
            `;
            
            if (users.length > 0) {
                user = {
                    ...users[0],
                    table: 'users',
                    role: 'USER' // Standard role for all users
                };
                console.log('✅ Found user in users:', user.username);
            }
        } catch (error) {
            console.error('❌ Error checking users:', error.message);
        }

        if (!user) {
            console.log('❌ No user found in users');
            return res.status(401).json({ 
                success: false, 
                message: 'User không tồn tại hoặc đã bị vô hiệu hóa' 
            });
        }

        // Add user info to request
        req.user = user;
        
        // Debug log (remove in production)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Auth successful: ${user.username} from ${user.table}`);
        }
        
        next();
        
    } catch (err) {
        console.error('JWT verification error:', err.message);
        return res.status(401).json({ 
            success: false, 
            message: 'Token không hợp lệ hoặc đã hết hạn',
            error: process.env.NODE_ENV !== 'production' ? err.message : undefined
        });
    }
}