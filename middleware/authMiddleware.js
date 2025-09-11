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
        
        // Try to find user in users_v2 first (new system)
        let user = null;
        
        try {
            if (decoded.username) {
                // This is a users_v2 token (has username field)
                const usersV2 = await prisma.$queryRaw`
                    SELECT 
                        u.id,
                        u.username,
                        u.email,
                        u.full_name,
                        u.phone_number,
                        u.organization_id,
                        u.department_id,
                        u.is_active,
                        o.name as organization_name,
                        d.name as department_name
                    FROM users_v2 u
                    LEFT JOIN organizations o ON u.organization_id = o.id
                    LEFT JOIN departments d ON u.department_id = d.id
                    WHERE u.id = ${decoded.id}::uuid
                    AND u.is_active = true
                `;
                
                if (usersV2.length > 0) {
                    user = {
                        ...usersV2[0],
                        table: 'users_v2',
                        role: 'USER_V2' // Default role for V2 users
                    };
                }
            }
        } catch (v2Error) {
            console.log('Not a users_v2 token or error:', v2Error.message);
        }

        // If not found in users_v2, try users table (legacy system)
        if (!user) {
            try {
                const usersV1 = await prisma.users.findUnique({
                    where: { id: decoded.id },
                    include: { roles: true }
                });
                
                if (usersV1 && usersV1.is_active) {
                    user = {
                        id: usersV1.id,
                        username: usersV1.username,
                        full_name: usersV1.full_name,
                        role_id: usersV1.role_id,
                        roles: usersV1.roles,
                        is_active: usersV1.is_active,
                        table: 'users',
                        role: usersV1.roles?.role_name || 'UNKNOWN'
                    };
                }
            } catch (v1Error) {
                console.log('Error checking users table:', v1Error.message);
            }
        }

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User không tồn tại hoặc đã bị vô hiệu hóa' 
            });
        }

        // Add user info to request
        req.user = user;
        
        // Debug log (remove in production)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Auth successful: ${user.username || user.full_name} from ${user.table}`);
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