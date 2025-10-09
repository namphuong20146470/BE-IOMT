import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get organizations accessible to user
export const getOrganizations = async (req, res) => {
    try {
        const userOrgId = req.user?.organization_id;

        // Case 1: JWT không có org_id
        if (userOrgId === undefined) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        let organizations;

        if (userOrgId === null) {
            // Case 2: System Admin → xem tất cả
            organizations = await prisma.$queryRaw`
                SELECT 
                    id, name, code, license_number, address, phone, email, 
                    website, description, status, created_at
                FROM organizations 
                WHERE status = 'ACTIVE'
                ORDER BY name
            `;
        } else {
            // Case 3: User bình thường → chỉ xem tổ chức của mình
            organizations = await prisma.$queryRaw`
                SELECT 
                    id, name, code, license_number, address, phone, email, 
                    website, description, status, created_at
                FROM organizations 
                WHERE id = ${userOrgId}::uuid
                AND status = 'ACTIVE'
                ORDER BY name
            `;
        }

        res.status(200).json({
            success: true,
            data: organizations,
            message: 'Organizations retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organizations',
            error: error.message
        });
    }
};


// Get departments by organization
export const getDepartments = async (req, res) => {
    try {
        const { organization_id } = req.query;
        
        // **SECURITY: Validate organization access**
        const userOrgId = req.user?.organization_id;
        if (!userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'User organization not found'
            });
        }

        // If organization_id provided, must match user's organization
        if (organization_id && organization_id !== userOrgId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Cannot access departments from different organization'
            });
        }

        // Use user's organization if not specified
        const targetOrgId = organization_id || userOrgId;

        const departments = await prisma.$queryRaw`
            SELECT 
                id, name, code, description, manager_name,
                contact_phone, contact_email, organization_id, created_at
            FROM departments 
            WHERE organization_id = ${targetOrgId}::uuid
            AND status = 'active'
            ORDER BY name
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
            message: 'Failed to fetch departments',
            error: error.message
        });
    }
};

// Get device models with categories
export const getDeviceModels = async (req, res) => {
    try {
        const { category, manufacturer, search } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (category) {
            whereConditions.push(`dc.name ILIKE $${paramIndex}`);
            params.push(`%${category}%`);
            paramIndex++;
        }

        if (manufacturer) {
            whereConditions.push(`m.name ILIKE $${paramIndex}`);
            params.push(`%${manufacturer}%`);
            paramIndex++;
        }

        if (search) {
            whereConditions.push(`(dm.name ILIKE $${paramIndex} OR dm.model_number ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const models = await prisma.$queryRawUnsafe(`
            SELECT 
                dm.id, dm.name, dm.model_number, dm.specifications,
                dc.name as category_name, dc.description as category_description,
                m.name as manufacturer_name, m.country as manufacturer_country,
                s.name as supplier_name
            FROM device_models dm
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN manufacturers m ON dm.manufacturer_id = m.id
            LEFT JOIN suppliers s ON dm.supplier_id = s.id
            ${whereClause}
            ORDER BY dc.name, dm.name
        `, ...params);

        res.status(200).json({
            success: true,
            data: models,
            message: 'Device models retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device models:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device models',
            error: error.message
        });
    }
};

// Get device categories
export const getDeviceCategories = async (req, res) => {
    try {
        const categories = await prisma.$queryRaw`
            SELECT 
                id, name, description, parent_id,
                (SELECT COUNT(*)::integer FROM device_models WHERE category_id = dc.id) as model_count
            FROM device_categories dc
            ORDER BY name
        `;

        res.status(200).json({
            success: true,
            data: categories,
            message: 'Device categories retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device categories',
            error: error.message
        });
    }
};

// Get manufacturers
export const getManufacturers = async (req, res) => {
    try {
        const { search } = req.query;

        let whereClause = '';
        let params = [];

        if (search) {
            whereClause = 'WHERE name ILIKE $1 OR country ILIKE $1';
            params.push(`%${search}%`);
        }

        const manufacturers = await prisma.$queryRawUnsafe(`
            SELECT 
                id, name, country, website, contact_email,
                (SELECT COUNT(*)::integer FROM device_models WHERE manufacturer_id = m.id) as model_count
            FROM manufacturers m
            ${whereClause}
            ORDER BY name
        `, ...params);

        res.status(200).json({
            success: true,
            data: manufacturers,
            message: 'Manufacturers retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching manufacturers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch manufacturers',
            error: error.message
        });
    }
};

// Get measurements
export const getMeasurements = async (req, res) => {
    try {
        const { search, data_type } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (search) {
            whereConditions.push(`name ILIKE $${paramIndex}`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (data_type) {
            whereConditions.push(`data_type = $${paramIndex}::measurement_data_type`);
            params.push(data_type);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const measurements = await prisma.$queryRawUnsafe(`
            SELECT 
                id, name, data_type, unit, validation_rules
            FROM measurements
            ${whereClause}
            ORDER BY name
        `, ...params);

        res.status(200).json({
            success: true,
            data: measurements,
            message: 'Measurements retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching measurements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch measurements',
            error: error.message
        });
    }
};

// Create measurements in batch
export const createMeasurements = async (req, res) => {
    try {
        const { measurements } = req.body;

        if (!measurements || !Array.isArray(measurements) || measurements.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Measurements array is required'
            });
        }

        const createdMeasurements = [];
        const errors = [];

        for (const measurement of measurements) {
            try {
                const { name, data_type, unit, validation_rules, description } = measurement;

                if (!name || !data_type) {
                    errors.push({ name, error: 'Name and data_type are required' });
                    continue;
                }

                // Check if measurement already exists
                const existing = await prisma.$queryRaw`
                    SELECT id FROM measurements WHERE name = ${name}
                `;

                if (existing.length > 0) {
                    errors.push({ name, error: 'Measurement already exists' });
                    continue;
                }

                const newMeasurement = await prisma.$queryRaw`
                    INSERT INTO measurements (
                        name, data_type, unit, validation_rules, description
                    ) VALUES (
                        ${name},
                        ${data_type}::measurement_data_type,
                        ${unit || 'EMPTY'},
                        ${JSON.stringify(validation_rules || {})}::jsonb,
                        ${description || ''}
                    )
                    RETURNING id, name, data_type, unit
                `;

                createdMeasurements.push(newMeasurement[0]);

            } catch (error) {
                errors.push({ name: measurement.name, error: error.message });
            }
        }

        res.status(201).json({
            success: true,
            data: {
                created_count: createdMeasurements.length,
                measurements: createdMeasurements,
                errors: errors
            },
            message: `${createdMeasurements.length} measurements created successfully`
        });

    } catch (error) {
        console.error('Error creating measurements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create measurements',
            error: error.message
        });
    }
};

// Get user profile with organization/department info
export const getUserProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const userProfile = await prisma.$queryRaw`
            SELECT 
                u.id, u.username, u.email, u.full_name, u.phone,
                u.organization_id, u.department_id, u.status, u.created_at,
                o.name as organization_name, o.code as organization_code,
                d.name as department_name, d.code as department_code
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ${userId}::uuid
        `;

        if (userProfile.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        // Remove sensitive data
        const profile = userProfile[0];
        delete profile.password;

        res.status(200).json({
            success: true,
            data: profile,
            message: 'User profile retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile',
            error: error.message
        });
    }
};