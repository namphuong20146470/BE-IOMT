import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getVietnamDate() {
    const now = new Date();
    return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// Get all device models with category info
export const getAllDeviceModels = async (req, res) => {
    try {
        const { category_id, manufacturer } = req.query;
        
        let whereConditions = [];
        let params = [];
        
        if (category_id) {
            whereConditions.push(`dm.category_id = $${params.length + 1}::uuid`);
            params.push(category_id);
        }
        
        if (manufacturer) {
            whereConditions.push(`dm.manufacturer ILIKE $${params.length + 1}`);
            params.push(`%${manufacturer}%`);
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const models = await prisma.$queryRawUnsafe(`
            SELECT 
                dm.id, dm.name, dm.manufacturer, dm.specifications,
                dm.category_id,
                dc.name as category_name,
                dc.description as category_description,
                COUNT(d.id) as devices_count
            FROM device_models dm
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN device d ON dm.id = d.model_id
            ${whereClause}
            GROUP BY dm.id, dm.name, dm.manufacturer, dm.specifications, 
                     dm.category_id, dc.name, dc.description
            ORDER BY dm.manufacturer, dm.name
        `, ...params);

        res.status(200).json({
            success: true,
            data: models,
            count: models.length,
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

// Get device model by ID
export const getDeviceModelById = async (req, res) => {
    try {
        const { id } = req.params;

        const model = await prisma.$queryRaw`
            SELECT 
                dm.id, dm.name, dm.manufacturer, dm.specifications,
                dm.category_id,
                dc.name as category_name,
                dc.description as category_description,
                COUNT(d.id) as devices_count
            FROM device_models dm
            LEFT JOIN device_categories dc ON dm.category_id = dc.id
            LEFT JOIN device d ON dm.id = d.model_id
            WHERE dm.id = ${id}::uuid
            GROUP BY dm.id, dm.name, dm.manufacturer, dm.specifications, 
                     dm.category_id, dc.name, dc.description
        `;

        if (model.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device model not found'
            });
        }

        res.status(200).json({
            success: true,
            data: model[0],
            message: 'Device model retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device model',
            error: error.message
        });
    }
};

// Create device model
export const createDeviceModel = async (req, res) => {
    try {
        const { category_id, name, manufacturer, specifications } = req.body;

        if (!category_id || !name || !manufacturer) {
            return res.status(400).json({
                success: false,
                message: 'Category ID, name, and manufacturer are required'
            });
        }

        // Check if category exists
        const categoryExists = await prisma.$queryRaw`
            SELECT id FROM device_categories WHERE id = ${category_id}::uuid
        `;
        if (categoryExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Device category not found'
            });
        }

        // Check for duplicate model name + manufacturer
        const duplicateCheck = await prisma.$queryRaw`
            SELECT id FROM device_models 
            WHERE name = ${name} AND manufacturer = ${manufacturer}
        `;
        if (duplicateCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Device model with this name and manufacturer already exists'
            });
        }

        const newModel = await prisma.$queryRaw`
            INSERT INTO device_models (category_id, name, manufacturer, specifications)
            VALUES (${category_id}::uuid, ${name}, ${manufacturer}, ${specifications || null})
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            data: newModel[0],
            message: 'Device model created successfully'
        });
    } catch (error) {
        console.error('Error creating device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create device model',
            error: error.message
        });
    }
};

// Update device model
export const updateDeviceModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, manufacturer, specifications } = req.body;

        // Check if model exists
        const existingModel = await prisma.$queryRaw`
            SELECT * FROM device_models WHERE id = ${id}::uuid
        `;
        if (existingModel.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device model not found'
            });
        }

        // Check category exists (if provided)
        if (category_id) {
            const categoryExists = await prisma.$queryRaw`
                SELECT id FROM device_categories WHERE id = ${category_id}::uuid
            `;
            if (categoryExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Device category not found'
                });
            }
        }

        // Build update query dynamically
        let updateFields = [];
        let params = [];
        let paramIndex = 1;

        if (category_id) {
            updateFields.push(`category_id = $${paramIndex}::uuid`);
            params.push(category_id);
            paramIndex++;
        }
        if (name) {
            updateFields.push(`name = $${paramIndex}`);
            params.push(name);
            paramIndex++;
        }
        if (manufacturer) {
            updateFields.push(`manufacturer = $${paramIndex}`);
            params.push(manufacturer);
            paramIndex++;
        }
        if (specifications !== undefined) {
            updateFields.push(`specifications = $${paramIndex}`);
            params.push(specifications);
            paramIndex++;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        params.push(id);
        const updatedModel = await prisma.$queryRawUnsafe(`
            UPDATE device_models 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}::uuid
            RETURNING *
        `, ...params);

        res.status(200).json({
            success: true,
            data: updatedModel[0],
            message: 'Device model updated successfully'
        });
    } catch (error) {
        console.error('Error updating device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device model',
            error: error.message
        });
    }
};

// Delete device model
export const deleteDeviceModel = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if model has devices
        const hasDevices = await prisma.$queryRaw`
            SELECT id FROM device WHERE model_id = ${id}::uuid LIMIT 1
        `;
        if (hasDevices.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete model with existing devices'
            });
        }

        const result = await prisma.$queryRaw`
            DELETE FROM device_models WHERE id = ${id}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'Device model deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete device model',
            error: error.message
        });
    }
};

// Get models by category
export const getModelsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const models = await prisma.$queryRaw`
            SELECT 
                dm.id, dm.name, dm.manufacturer, dm.specifications,
                COUNT(d.id) as devices_count
            FROM device_models dm
            LEFT JOIN device d ON dm.id = d.model_id
            WHERE dm.category_id = ${categoryId}::uuid
            GROUP BY dm.id, dm.name, dm.manufacturer, dm.specifications
            ORDER BY dm.manufacturer, dm.name
        `;

        res.status(200).json({
            success: true,
            data: models,
            count: models.length,
            message: 'Models by category retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching models by category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch models by category',
            error: error.message
        });
    }
};

// Get manufacturers list
export const getManufacturers = async (req, res) => {
    try {
        const manufacturers = await prisma.$queryRaw`
            SELECT DISTINCT manufacturer, COUNT(*) as models_count
            FROM device_models 
            GROUP BY manufacturer
            ORDER BY manufacturer
        `;

        res.status(200).json({
            success: true,
            data: manufacturers,
            count: manufacturers.length,
            message: 'Manufacturers list retrieved successfully'
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
