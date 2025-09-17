import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Legacy hash function for existing users
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// New bcrypt hash function for new users (recommended)
const hashPasswordBcrypt = async (password) => {
    return await bcrypt.hash(password, 10);
};

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

export const createUser = async (req, res) => {
    try {
        const { 
            organization_id, 
            department_id, 
            username, 
            password, 
            full_name, 
            email, 
            phone 
        } = req.body;

        // Validate required fields
        if (!username || !password || !full_name) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, and full_name are required'
            });
        }

        // Check username exists in users table
        const existingUser = await prisma.$queryRaw`
            SELECT id FROM users WHERE username = ${username}
        `;
        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        const hashedPassword = await hashPasswordBcrypt(password);
        
        const newUser = await prisma.$queryRaw`
            INSERT INTO users (
                organization_id, department_id, username, 
                password_hash, full_name, email, phone
            )
            VALUES (
                ${organization_id || null}::uuid, 
                ${department_id || null}::uuid, 
                ${username},
                ${hashedPassword}, 
                ${full_name}, 
                ${email || null}, 
                ${phone || null}
            )
            RETURNING id, organization_id, department_id, username, full_name, email, phone, is_active, created_at, updated_at
        `;

        res.status(201).json({
            success: true,
            data: newUser[0],
            message: 'User created successfully'
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message || 'Unknown error'
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Hybrid password verification: support both SHA256 (legacy) and bcrypt (new)
        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.organization_id, u.department_id, u.password_hash,
                   o.name as organization_name,
                   d.name as department_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.username = ${username}
            AND u.is_active = true
        `;

        if (user.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        let isValidPassword = false;
        const storedHash = user[0].password_hash;

        // Check if password is bcrypt format (starts with $2b$)
        if (storedHash.startsWith('$2b$')) {
            // New bcrypt verification
            isValidPassword = await bcrypt.compare(password, storedHash);
        } else {
            // Legacy SHA256 verification
            const sha256Hash = hashPassword(password);
            isValidPassword = (sha256Hash === storedHash);
            
            // Auto-migrate to bcrypt on successful login
            if (isValidPassword) {
                try {
                    const newBcryptHash = await hashPasswordBcrypt(password);
                    await prisma.$queryRaw`
                        UPDATE users 
                        SET password_hash = ${newBcryptHash},
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ${user[0].id}::uuid
                    `;
                    console.log(`🔄 Auto-migrated password for user: ${user[0].username}`);
                } catch (migrationError) {
                    console.error('Failed to auto-migrate password:', migrationError.message);
                }
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user[0].id,
                username: user[0].username,
                email: user[0].email,
                organization_id: user[0].organization_id,
                department_id: user[0].department_id
            },
            process.env.JWT_SECRET || 'secret_key',
            { expiresIn: '1d' }
        );

        // Remove password_hash from response
        const { password_hash, ...userWithoutPassword } = user[0];

        res.status(200).json({
            success: true,
            data: {
                token,
                user: userWithoutPassword
            },
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message || 'Unknown error'
        });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const { organization_id } = req.query;

        let users;
        
        if (organization_id) {
            users = await prisma.$queryRaw`
                SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                       u.organization_id, u.department_id,
                       o.name as organization_name,
                       d.name as department_name,
                       u.created_at, u.updated_at
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE u.organization_id = ${organization_id}::uuid
                ORDER BY u.created_at DESC
            `;
        } else {
            users = await prisma.$queryRaw`
                SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                       u.organization_id, u.department_id,
                       o.name as organization_name,
                       d.name as department_name,
                       u.created_at, u.updated_at
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN departments d ON u.department_id = d.id
                ORDER BY u.created_at DESC
            `;
        }

        res.status(200).json({
            success: true,
            data: users,
            count: users.length,
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users',
            error: error.message || 'Unknown error'
        });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                   u.organization_id, u.department_id,
                   o.name as organization_name,
                   d.name as department_name,
                   u.created_at, u.updated_at
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ${id}::uuid AND u.is_active = true
        `;

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user[0],
            message: 'User retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user',
            error: error.message || 'Unknown error'
        });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { organization_id, department_id, full_name, email, phone } = req.body;

        const updatedUser = await prisma.$queryRaw`
            UPDATE users 
            SET organization_id = COALESCE(${organization_id || null}::uuid, organization_id),
                department_id = COALESCE(${department_id || null}::uuid, department_id),
                full_name = COALESCE(${full_name}, full_name),
                email = COALESCE(${email}, email),
                phone = COALESCE(${phone}, phone),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}::uuid AND is_active = true
            RETURNING id, organization_id, department_id, username, full_name, email, phone, updated_at
        `;

        if (updatedUser.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedUser[0],
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message || 'Unknown error'
        });
    }
};

// Logout user
export const logoutUser = async (req, res) => {
    try {
        // Lấy user từ token hoặc session (giả sử đã xác thực)
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Chưa đăng nhập' });
        }
        
        // Log activity (optional - if you have logging system)
        // await prisma.logs.create({
        //     data: {
        //         user_id: user.id,
        //         action: 'logout',
        //         details: 'Đăng xuất thành công',
        //         target: user.username,
        //         created_at: getVietnamDate()
        //     }
        // });

        return res.json({ 
            success: true,
            message: 'Đăng xuất thành công' 
        });
    } catch (err) {
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
};

// Delete user placeholder (implement if needed)
export const deleteUser = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Delete user functionality not implemented yet'
    });
};

// Delete all users except admin placeholder
export const deleteAllUsersExceptAdmin = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Mass delete functionality not implemented yet'
    });
};