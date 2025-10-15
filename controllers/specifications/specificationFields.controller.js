import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get specification field templates (master data for autocomplete)
export const getSpecificationFieldsTemplate = async (req, res) => {
    try {
        const { search, category, data_type } = req.query;

        let whereConditions = { is_active: true };

        // Search in Vietnamese, English, or field names
        if (search) {
            whereConditions.OR = [
                { field_name_vi: { contains: search, mode: 'insensitive' } },
                { field_name: { contains: search, mode: 'insensitive' } },
                { field_name_en: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Filter by category
        if (category) {
            whereConditions.category = category;
        }

        // Filter by data type
        if (data_type) {
            whereConditions.data_type = data_type;
        }

        // Get specification fields with usage statistics
        const fields = await prisma.specification_fields.findMany({
            where: whereConditions,
            select: {
                field_name: true,
                field_name_vi: true,
                field_name_en: true,
                unit: true,
                category: true,
                data_type: true,
                placeholder: true,
                help_text: true,
                sort_order: true,
                _count: {
                    select: {
                        specifications: true
                    }
                },
                specifications: {
                    select: {
                        value: true,
                        numeric_value: true
                    },
                    where: {
                        is_visible: true
                    },
                    distinct: ['value'],
                    take: 10,
                    orderBy: {
                        value: 'asc'
                    }
                }
            },
            orderBy: [
                { category: 'asc' },
                { sort_order: 'asc' },
                { field_name_vi: 'asc' }
            ]
        });

        // Format response with sample values and statistics
        const enrichedFields = fields.map(field => ({
            field_name: field.field_name,
            field_name_vi: field.field_name_vi,
            field_name_en: field.field_name_en,
            unit: field.unit,
            category: field.category,
            data_type: field.data_type,
            placeholder: field.placeholder,
            help_text: field.help_text,
            sort_order: field.sort_order,
            usage_count: field._count.specifications,
            sample_values: field.specifications.map(s => s.value),
            avg_numeric_value: field.specifications
                .filter(s => s.numeric_value !== null)
                .reduce((sum, s, _, arr) => {
                    if (arr.length === 0) return null;
                    return sum + Number(s.numeric_value);
                }, 0) / field.specifications.filter(s => s.numeric_value !== null).length || null
        }));

        res.status(200).json({
            success: true,
            data: enrichedFields,
            message: 'Specification field templates retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching specification field templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specification field templates',
            error: error.message
        });
    }
};

// Get specification field categories
export const getSpecificationCategories = async (req, res) => {
    try {
        const categories = await prisma.specification_fields.groupBy({
            by: ['category'],
            where: {
                is_active: true,
                category: { not: null }
            },
            _count: {
                _all: true
            },
            orderBy: {
                category: 'asc'
            }
        });

        const formattedCategories = categories.map(cat => ({
            name: cat.category,
            field_count: cat._count._all
        }));

        res.status(200).json({
            success: true,
            data: formattedCategories,
            message: 'Specification categories retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching specification categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specification categories',
            error: error.message
        });
    }
};

// Create or update specification field template
export const upsertSpecificationField = async (req, res) => {
    try {
        const { 
            field_name, 
            field_name_vi, 
            field_name_en,
            unit, 
            category, 
            data_type,
            placeholder,
            help_text,
            sort_order 
        } = req.body;

        if (!field_name || !field_name_vi) {
            return res.status(400).json({
                success: false,
                message: 'field_name and field_name_vi are required'
            });
        }

        const field = await prisma.specification_fields.upsert({
            where: { field_name },
            update: {
                field_name_vi,
                field_name_en,
                unit,
                category,
                data_type,
                placeholder,
                help_text,
                sort_order,
                updated_at: new Date()
            },
            create: {
                field_name,
                field_name_vi,
                field_name_en,
                unit,
                category,
                data_type: data_type || 'text',
                placeholder,
                help_text,
                sort_order: sort_order || 0
            }
        });

        res.status(200).json({
            success: true,
            data: field,
            message: field ? 'Specification field updated successfully' : 'Specification field created successfully'
        });
    } catch (error) {
        console.error('Error upserting specification field:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save specification field',
            error: error.message
        });
    }
};

// Get enhanced model specifications (with field templates)
export const getEnhancedModelSpecifications = async (req, res) => {
    try {
        const { device_model_id } = req.params;

        if (!device_model_id) {
            return res.status(400).json({
                success: false,
                message: 'Device model ID is required'
            });
        }

        const specifications = await prisma.specifications.findMany({
            where: {
                device_model_id: device_model_id,
                is_visible: true
            },
            include: {
                specification_field: {
                    select: {
                        field_name_vi: true,
                        field_name_en: true,
                        unit: true,
                        category: true,
                        data_type: true,
                        help_text: true
                    }
                }
            },
            orderBy: [
                { display_order: 'asc' },
                { specification_field: { sort_order: 'asc' } },
                { field_name_vi: 'asc' }
            ]
        });

        const groupedSpecs = specifications.reduce((groups, spec) => {
            const category = spec.specification_field?.category || 'general';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push({
                id: spec.id,
                field_name: spec.field_name,
                field_name_vi: spec.field_name_vi,
                field_name_en: spec.specification_field?.field_name_en,
                value: spec.value,
                numeric_value: spec.numeric_value,
                unit: spec.unit || spec.specification_field?.unit,
                description: spec.description,
                display_order: spec.display_order,
                data_type: spec.specification_field?.data_type,
                help_text: spec.specification_field?.help_text
            });
            return groups;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                device_model_id,
                specifications: groupedSpecs,
                total_count: specifications.length
            },
            message: 'Enhanced model specifications retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching enhanced model specifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enhanced model specifications',
            error: error.message
        });
    }
};

export {
    // Re-export existing functions from the original controller
    getSpecificationFields,
    getModelSpecifications,
    upsertModelSpecifications,
    deleteSpecification,
    getSpecificationStats
} from './specifications.controller.js';