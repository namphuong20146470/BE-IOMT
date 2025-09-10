import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type OrganizationType = 'hospital' | 'factory' | 'school' | 'office' | 'laboratory';

interface CreateOrganizationRequest {
    name: string;
    type: OrganizationType;
    address?: string;
    phone?: string;
    email?: string;
    license_number?: string;
}

interface OrganizationResponse {
    id: string;
    name: string;
    type: OrganizationType;
    address: string | null;
    phone: string | null;
    email: string | null;
    license_number: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export const createOrganization = async (req: Request<{}, {}, CreateOrganizationRequest>, res: Response) => {
    try {
        const { name, type, address, phone, email, license_number } = req.body;

        const organization = await prisma.$queryRaw<OrganizationResponse[]>`
            INSERT INTO organizations (name, type, address, phone, email, license_number)
            VALUES (${name}, ${type}, ${address}, ${phone}, ${email}, ${license_number})
            RETURNING id, name, type, created_at
        `;

        res.status(201).json({
            success: true,
            data: organization[0],
            message: 'Organization created successfully'
        });
    } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create organization',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getAllOrganizations = async (req: Request, res: Response) => {
    try {
        const organizations = await prisma.$queryRaw<OrganizationResponse[]>`
            SELECT id, name, type, address, phone, email, 
                   license_number, is_active, created_at
            FROM organizations
            WHERE is_active = true
            ORDER BY created_at DESC
        `;

        res.status(200).json({
            success: true,
            data: organizations,
            message: 'Organizations retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve organizations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};