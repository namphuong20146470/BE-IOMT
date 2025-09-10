import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createDepartment = async (req, res) => {
    try {
        const { organization_id, name, description, code } = req.body;

        const department = await prisma.$queryRaw`
            INSERT INTO departments (organization_id, name, description, code)
            VALUES (${organization_id}::uuid, ${name}, ${description}, ${code})
            RETURNING id, organization_id, name, description, code, created_at, updated_at
        `;

        res.status(201).json({
            success: true,
            data: department[0],
            message: 'Department created successfully'
        });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create department',
            error: error.message || 'Unknown error'
        });
    }
};

export const getDepartmentsByOrganization = async (req, res) => {
    try {
        const { organization_id } = req.params;

        const departments = await prisma.$queryRaw`
            SELECT id, organization_id, name, description, code, created_at, updated_at
            FROM departments
            WHERE organization_id = ${organization_id}::uuid
            ORDER BY created_at DESC
        `;

        res.status(200).json({
            success: true,
            data: departments,
            message: 'Departments retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve departments',
            error: error.message || 'Unknown error'
        });
    }
};

export const getAllDepartments = async (req, res) => {
    try {
        const departments = await prisma.$queryRaw`
            SELECT d.id, d.organization_id, d.name, d.description, d.code, 
                   d.created_at, d.updated_at,
                   o.name as organization_name
            FROM departments d
            LEFT JOIN organizations o ON d.organization_id = o.id
            ORDER BY d.created_at DESC
        `;

        res.status(200).json({
            success: true,
            data: departments,
            count: departments.length,
            message: 'All departments retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching all departments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve departments',
            error: error.message || 'Unknown error'
        });
    }
};

export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, code } = req.body;

        const department = await prisma.$queryRaw`
            UPDATE departments 
            SET name = COALESCE(${name}, name),
                description = COALESCE(${description}, description),
                code = COALESCE(${code}, code),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}::uuid
            RETURNING id, organization_id, name, description, code, updated_at
        `;

        if (department.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        res.status(200).json({
            success: true,
            data: department[0],
            message: 'Department updated successfully'
        });
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update department',
            error: error.message || 'Unknown error'
        });
    }
};
