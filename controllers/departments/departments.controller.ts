import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateDepartmentRequest {
    organization_id: string;
    name: string;
    description?: string;
    code?: string;
}

interface DepartmentResponse {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    code: string | null;
    created_at: Date;
    updated_at: Date;
}

export const createDepartment = async (req: Request<{}, {}, CreateDepartmentRequest>, res: Response) => {
    try {
        const { organization_id, name, description, code } = req.body;

        const department = await prisma.$queryRaw<DepartmentResponse[]>`
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
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getDepartmentsByOrganization = async (req: Request<{ organization_id: string }>, res: Response) => {
    try {
        const { organization_id } = req.params;

        const departments = await prisma.$queryRaw<DepartmentResponse[]>`
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
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};