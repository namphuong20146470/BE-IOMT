import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all device categories (with hierarchy)
export const getAllDeviceCategories = async (req, res) => {
    try {
        const categories = await prisma.$queryRaw`
            WITH RECURSIVE category_tree AS (
                -- Base case: root categories
                SELECT id, name, description, parent_id, 0 as level,
                       ARRAY[name::varchar] as path
                FROM device_categories 
                WHERE parent_id IS NULL
                
                UNION ALL
                
                -- Recursive case: child categories
                SELECT dc.id, dc.name, dc.description, dc.parent_id, ct.level + 1,
                       ct.path || ARRAY[dc.name::varchar]
                FROM device_categories dc
                JOIN category_tree ct ON dc.parent_id = ct.id
            )
            SELECT * FROM category_tree
            ORDER BY path
        `;

        res.status(200).json({
            success: true,
            data: categories,
            count: categories.length,
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

// Get root categories only
export const getRootCategories = async (req, res) => {
    try {
        const rootCategories = await prisma.$queryRaw`
            SELECT id, name, description, parent_id
            FROM device_categories 
            WHERE parent_id IS NULL
            ORDER BY name
        `;

        res.status(200).json({
            success: true,
            data: rootCategories,
            count: rootCategories.length,
            message: 'Root categories retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching root categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch root categories',
            error: error.message
        });
    }
};

// Get child categories by parent ID
export const getChildCategories = async (req, res) => {
    try {
        const { parentId } = req.params;
        
        const childCategories = await prisma.$queryRaw`
            SELECT id, name, description, parent_id
            FROM device_categories 
            WHERE parent_id = ${parentId}::uuid
            ORDER BY name
        `;

        res.status(200).json({
            success: true,
            data: childCategories,
            count: childCategories.length,
            message: 'Child categories retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching child categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch child categories',
            error: error.message
        });
    }
};

// Create device category
export const createDeviceCategory = async (req, res) => {
    try {
        const { name, description, parent_id } = req.body;

        // Debug logging
        console.log('🔍 Create category data:', {
            name,
            description,
            parent_id,
            parent_id_type: typeof parent_id
        });

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Convert parent_id to string if it's a number (để tránh lỗi cast)
        const parentId = parent_id ? String(parent_id) : null;
        console.log('🎯 Converted parentId:', parentId, 'type:', typeof parentId);

        // Check if parent exists (if provided)
        if (parentId) {
            const parentExists = await prisma.$queryRaw`
                SELECT id FROM device_categories WHERE id = ${parentId}::uuid
            `;
            if (parentExists.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Parent category not found'
                });
            }
        }

        let newCategory;
        
        if (parentId) {
            console.log('📝 Creating category with parent:', parentId);
            newCategory = await prisma.$queryRaw`
                INSERT INTO device_categories (name, description, parent_id)
                VALUES (${name}, ${description || null}, ${parentId}::uuid)
                RETURNING *
            `;
        } else {
            console.log('📝 Creating root category');
            newCategory = await prisma.$queryRaw`
                INSERT INTO device_categories (name, description, parent_id)
                VALUES (${name}, ${description || null}, NULL)
                RETURNING *
            `;
        }

        res.status(201).json({
            success: true,
            data: newCategory[0],
            message: 'Device category created successfully'
        });
    } catch (error) {
        console.error('Error creating device category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create device category',
            error: error.message
        });
    }
};

// Update device category
export const updateDeviceCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, parent_id } = req.body;

        // Check if category exists
        const existingCategory = await prisma.$queryRaw`
            SELECT id FROM device_categories WHERE id = ${id}::uuid
        `;
        if (existingCategory.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device category not found'
            });
        }

        // Prevent circular reference (category cannot be parent of itself)
        if (parent_id === id) {
            return res.status(400).json({
                success: false,
                message: 'Category cannot be parent of itself'
            });
        }

        let updatedCategory;
        
        if (parent_id !== undefined) {
            if (parent_id === null) {
                updatedCategory = await prisma.$queryRaw`
                    UPDATE device_categories 
                    SET name = COALESCE(${name}, name),
                        description = COALESCE(${description}, description),
                        parent_id = NULL
                    WHERE id = ${id}::uuid
                    RETURNING *
                `;
            } else {
                updatedCategory = await prisma.$queryRaw`
                    UPDATE device_categories 
                    SET name = COALESCE(${name}, name),
                        description = COALESCE(${description}, description),
                        parent_id = ${parent_id}::uuid
                    WHERE id = ${id}::uuid
                    RETURNING *
                `;
            }
        } else {
            updatedCategory = await prisma.$queryRaw`
                UPDATE device_categories 
                SET name = COALESCE(${name}, name),
                    description = COALESCE(${description}, description)
                WHERE id = ${id}::uuid
                RETURNING *
            `;
        }

        res.status(200).json({
            success: true,
            data: updatedCategory[0],
            message: 'Device category updated successfully'
        });
    } catch (error) {
        console.error('Error updating device category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device category',
            error: error.message
        });
    }
};

// Delete device category
export const deleteDeviceCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category has children
        const hasChildren = await prisma.$queryRaw`
            SELECT id FROM device_categories WHERE parent_id = ${id}::uuid LIMIT 1
        `;
        if (hasChildren.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with child categories'
            });
        }

        // Check if category has device models
        const hasModels = await prisma.$queryRaw`
            SELECT id FROM device_models WHERE category_id = ${id}::uuid LIMIT 1
        `;
        if (hasModels.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with existing device models'
            });
        }

        await prisma.$queryRaw`
            DELETE FROM device_categories WHERE id = ${id}::uuid
        `;

        res.status(200).json({
            success: true,
            message: 'Device category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete device category',
            error: error.message
        });
    }
};

// Get category with models count
export const getCategoryWithStats = async (req, res) => {
    try {
        const { id } = req.params;

        const categoryStats = await prisma.$queryRaw`
            SELECT 
                dc.id, dc.name, dc.description, dc.parent_id,
                COUNT(dm.id)::integer as models_count,
                COUNT(d.id)::integer as devices_count
            FROM device_categories dc
            LEFT JOIN device_models dm ON dc.id = dm.category_id
            LEFT JOIN device d ON dm.id = d.model_id
            WHERE dc.id = ${id}::uuid
            GROUP BY dc.id, dc.name, dc.description, dc.parent_id
        `;

        if (categoryStats.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: categoryStats[0],
            message: 'Category statistics retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching category statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category statistics',
            error: error.message
        });
    }
};
