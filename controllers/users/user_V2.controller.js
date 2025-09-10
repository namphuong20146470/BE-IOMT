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

export const createUserV2 = async (req, res) => {
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

        // Check username exists in BOTH tables
        const existingUserOld = await prisma.$queryRaw`
            SELECT id FROM users WHERE username = ${username}
        `;
        
        const existingUserV2 = await prisma.$queryRaw`
            SELECT id FROM users_v2 WHERE username = ${username}
        `;

        if (existingUserOld.length > 0 || existingUserV2.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }

        const hashedPassword = hashPassword(password);
        
        const newUser = await prisma.$queryRaw`
            INSERT INTO users_v2 (
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
            message: 'User V2 created successfully'
        });
    } catch (error) {
        console.error('Error creating user V2:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user V2',
            error: error.message || 'Unknown error'
        });
    }
};

export const loginV2 = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const hashedPassword = hashPassword(password);

        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.organization_id, u.department_id,
                   o.name as organization_name,
                   d.name as department_name
            FROM users_v2 u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.username = ${username} AND u.password_hash = ${hashedPassword}
            AND u.is_active = true
        `;

        if (user.length === 0) {
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

        res.status(200).json({
            success: true,
            data: {
                token,
                user: user[0]
            },
            message: 'Login V2 successful'
        });
    } catch (error) {
        console.error('Error during login V2:', error);
        res.status(500).json({
            success: false,
            message: 'Login V2 failed',
            error: error.message || 'Unknown error'
        });
    }
};

export const getAllUsersV2 = async (req, res) => {
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
                FROM users_v2 u
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
                FROM users_v2 u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN departments d ON u.department_id = d.id
                ORDER BY u.created_at DESC
            `;
        }

        res.status(200).json({
            success: true,
            data: users,
            count: users.length,
            message: 'Users V2 retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching users V2:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users V2',
            error: error.message || 'Unknown error'
        });
    }
};

export const getUserV2ById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.$queryRaw`
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                   u.organization_id, u.department_id,
                   o.name as organization_name,
                   d.name as department_name,
                   u.created_at, u.updated_at
            FROM users_v2 u
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
            message: 'User V2 retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching user V2:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user V2',
            error: error.message || 'Unknown error'
        });
    }
};

export const updateUserV2 = async (req, res) => {
    try {
        const { id } = req.params;
        const { organization_id, department_id, full_name, email, phone } = req.body;

        const updatedUser = await prisma.$queryRaw`
            UPDATE users_v2 
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
            message: 'User V2 updated successfully'
        });
    } catch (error) {
        console.error('Error updating user V2:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user V2',
            error: error.message || 'Unknown error'
        });
    }
};