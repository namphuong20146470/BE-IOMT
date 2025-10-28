import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Validation helper
const validateSpecification = (spec) => {
    const errors = [];
    
    if (!spec.field_name || typeof spec.field_name !== 'string') {
        errors.push('field_name is required and must be a string');
    } else if (spec.field_name.length > 100) {
        errors.push('field_name must not exceed 100 characters');
    }
    
    if (!spec.field_name_vi || typeof spec.field_name_vi !== 'string') {
        errors.push('field_name_vi is required and must be a string');
    } else if (spec.field_name_vi.length > 100) {
        errors.push('field_name_vi must not exceed 100 characters');
    }
    
    if (!spec.value || typeof spec.value !== 'string') {
        errors.push('value is required and must be a string');
    } else if (spec.value.length > 255) {
        errors.push('value must not exceed 255 characters');
    }
    
    if (spec.unit && spec.unit.length > 50) {
        errors.push('unit must not exceed 50 characters');
    }
    
    if (spec.display_order !== undefined && spec.display_order !== null) {
        const order = parseInt(spec.display_order);
        if (isNaN(order) || order < 0) {
            errors.push('display_order must be a positive integer');
        }
    }
    
    return errors;
};

// Get specification field templates (for autocomplete)
export const getSpecificationFields = async (req, res) => {
    try {
        const { search, category_id } = req.query;

        // Build query using Prisma's type-safe approach
        const whereConditions = {};
        
        if (search) {
            whereConditions.OR = [
                { field_name_vi: { contains: search, mode: 'insensitive' } },
                { field_name: { contains: search, mode: 'insensitive' } }
            ];
        }
        
        if (category_id) {
            whereConditions.device_model = {
                category_id: category_id
            };
        }

        // Use Prisma groupBy for better type safety
        const fields = await prisma.specifications.groupBy({
            by: ['field_name', 'field_name_vi', 'unit'],
            where: whereConditions,
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 50
        });

        // Get sample values for each field
        const enrichedFields = await Promise.all(
            fields.map(async (field) => {
                const samples = await prisma.specifications.findMany({
                    where: {
                        field_name: field.field_name,
                        field_name_vi: field.field_name_vi,
                        unit: field.unit
                    },
                    select: { value: true },
                    distinct: ['value'],
                    orderBy: { value: 'asc' },
                    take: 10
                });

                return {
                    field_name: field.field_name,
                    field_name_vi: field.field_name_vi,
                    unit: field.unit,
                    usage_count: field._count.id,
                    sample_values: samples.map(s => s.value)
                };
            })
        );

        res.status(200).json({
            success: true,
            data: enrichedFields,
            message: 'Specification fields retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching specification fields:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specification fields',
            error: error.message
        });
    }
};

// Get specifications for a device model
export const getModelSpecifications = async (req, res) => {
    try {
        const { device_model_id } = req.params;

        if (!device_model_id) {
            return res.status(400).json({
                success: false,
                message: 'Device model ID is required'
            });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(device_model_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device model ID format'
            });
        }

        const specifications = await prisma.specifications.findMany({
            where: {
                device_model_id: device_model_id
            },
            orderBy: [
                { display_order: 'asc' },
                { field_name_vi: 'asc' }
            ]
        });

        res.status(200).json({
            success: true,
            data: specifications,
            message: 'Model specifications retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching model specifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch model specifications',
            error: error.message
        });
    }
};

// Create or update specifications for a device model (with transaction)
export const upsertModelSpecifications = async (req, res) => {
    try {
        const { device_model_id } = req.params;
        const { specifications } = req.body;

        if (!device_model_id) {
            return res.status(400).json({
                success: false,
                message: 'Device model ID is required'
            });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(device_model_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device model ID format'
            });
        }

        if (!specifications || !Array.isArray(specifications)) {
            return res.status(400).json({
                success: false,
                message: 'Specifications array is required'
            });
        }

        if (specifications.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Specifications array cannot be empty'
            });
        }

        // Validate all specifications first
        const validationErrors = [];
        specifications.forEach((spec, index) => {
            const errors = validateSpecification(spec);
            if (errors.length > 0) {
                validationErrors.push({
                    index,
                    field_name: spec.field_name,
                    errors
                });
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        // Use transaction for atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Verify device model exists
            const model = await tx.device_models.findUnique({
                where: { id: device_model_id }
            });

            if (!model) {
                throw new Error('Device model not found');
            }

            // Process all specifications
            const upsertedSpecs = [];

            for (const spec of specifications) {
                const upserted = await tx.specifications.upsert({
                    where: {
                        device_model_id_field_name: {
                            device_model_id: device_model_id,
                            field_name: spec.field_name
                        }
                    },
                    update: {
                        field_name_vi: spec.field_name_vi,
                        value: spec.value,
                        unit: spec.unit || null,
                        description: spec.description || null,
                        display_order: spec.display_order !== undefined ? parseInt(spec.display_order) : null,
                        updated_at: new Date()
                    },
                    create: {
                        device_model_id: device_model_id,
                        field_name: spec.field_name,
                        field_name_vi: spec.field_name_vi,
                        value: spec.value,
                        unit: spec.unit || null,
                        description: spec.description || null,
                        display_order: spec.display_order !== undefined ? parseInt(spec.display_order) : null
                    }
                });

                upsertedSpecs.push(upserted);
            }

            return upsertedSpecs;
        });

        res.status(200).json({
            success: true,
            data: {
                updated_count: result.length,
                specifications: result
            },
            message: `${result.length} specifications processed successfully`
        });

    } catch (error) {
        console.error('Error upserting specifications:', error);
        
        if (error.message === 'Device model not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to process specifications',
            error: error.message
        });
    }
};

// Delete a specification
export const deleteSpecification = async (req, res) => {
    try {
        const { specification_id } = req.params;

        if (!specification_id) {
            return res.status(400).json({
                success: false,
                message: 'Specification ID is required'
            });
        }

        // Validate and parse ID
        const id = parseInt(specification_id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid specification ID'
            });
        }

        const deleted = await prisma.specifications.delete({
            where: { id: id },
            select: {
                id: true,
                field_name: true,
                field_name_vi: true
            }
        });

        res.status(200).json({
            success: true,
            data: deleted,
            message: 'Specification deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting specification:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Specification not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete specification',
            error: error.message
        });
    }
};

// Update a specific specification
export const updateSpecification = async (req, res) => {
    try {
        const { device_model_id, spec_id } = req.params;
        const { value, numeric_value, unit, description, field_name_vi, display_order, is_visible } = req.body;

        // Validate required parameters
        if (!device_model_id || !spec_id) {
            return res.status(400).json({
                success: false,
                message: 'Device model ID and specification ID are required'
            });
        }

        // Validate UUID format for device_model_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(device_model_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid device model ID format'
            });
        }

        // Validate spec_id is numeric
        const specificationId = parseInt(spec_id, 10);
        if (isNaN(specificationId) || specificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid specification ID'
            });
        }

        // Validate at least one field to update
        if (!value && !numeric_value && !unit && !description && !field_name_vi && 
            display_order === undefined && is_visible === undefined) {
            return res.status(400).json({
                success: false,
                message: 'At least one field must be provided for update'
            });
        }

        // Build update data
        const updateData = {
            updated_at: new Date()
        };

        if (value !== undefined) {
            if (typeof value !== 'string' || value.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: 'Value must be a string with maximum 255 characters'
                });
            }
            updateData.value = value;
        }

        if (numeric_value !== undefined) {
            if (numeric_value !== null) {
                const numericVal = parseFloat(numeric_value);
                if (isNaN(numericVal)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Numeric value must be a valid number'
                    });
                }
                updateData.numeric_value = numericVal;
            } else {
                updateData.numeric_value = null;
            }
        }

        if (unit !== undefined) {
            if (unit && (typeof unit !== 'string' || unit.length > 50)) {
                return res.status(400).json({
                    success: false,
                    message: 'Unit must be a string with maximum 50 characters'
                });
            }
            updateData.unit = unit || null;
        }

        if (description !== undefined) {
            if (description && (typeof description !== 'string' || description.length > 500)) {
                return res.status(400).json({
                    success: false,
                    message: 'Description must be a string with maximum 500 characters'
                });
            }
            updateData.description = description || null;
        }

        if (field_name_vi !== undefined) {
            if (!field_name_vi || typeof field_name_vi !== 'string' || field_name_vi.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Vietnamese field name must be a string with maximum 100 characters'
                });
            }
            updateData.field_name_vi = field_name_vi;
        }

        if (display_order !== undefined) {
            if (display_order !== null) {
                const order = parseInt(display_order);
                if (isNaN(order) || order < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Display order must be a positive integer or null'
                    });
                }
                updateData.display_order = order;
            } else {
                updateData.display_order = null;
            }
        }

        if (is_visible !== undefined) {
            updateData.is_visible = Boolean(is_visible);
        }

        // Update specification with transaction for safety
        const result = await prisma.$transaction(async (tx) => {
            // Verify specification exists and belongs to the device model
            const existingSpec = await tx.specifications.findUnique({
                where: { 
                    id: specificationId 
                },
                include: {
                    device_model: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!existingSpec) {
                throw new Error('Specification not found');
            }

            if (existingSpec.device_model_id !== device_model_id) {
                throw new Error('Specification does not belong to the specified device model');
            }

            // Update the specification
            const updated = await tx.specifications.update({
                where: { id: specificationId },
                data: updateData,
                include: {
                    device_model: {
                        select: {
                            id: true,
                            name: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return updated;
        });

        res.status(200).json({
            success: true,
            data: result,
            message: 'Specification updated successfully'
        });

    } catch (error) {
        console.error('Error updating specification:', error);
        
        if (error.message === 'Specification not found') {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.message === 'Specification does not belong to the specified device model') {
            return res.status(403).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Specification not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update specification',
            error: error.message
        });
    }
};

// Get specification statistics
export const getSpecificationStats = async (req, res) => {
    try {
        // Get field usage stats
        const fieldStats = await prisma.specifications.groupBy({
            by: ['field_name', 'field_name_vi'],
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 20
        });

        // Get units for each field
        const enrichedFieldStats = await Promise.all(
            fieldStats.map(async (stat) => {
                const units = await prisma.specifications.findMany({
                    where: {
                        field_name: stat.field_name,
                        field_name_vi: stat.field_name_vi,
                        unit: { not: null }
                    },
                    select: { unit: true },
                    distinct: ['unit']
                });

                return {
                    type: 'field_usage',
                    name: stat.field_name_vi,
                    field_name: stat.field_name,
                    count: stat._count.id,
                    units: units.map(u => u.unit).filter(Boolean).sort()
                };
            })
        );

        // Get unit usage stats
        const unitStats = await prisma.specifications.groupBy({
            by: ['unit'],
            where: {
                unit: { not: null }
            },
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 15
        });

        // Get fields for each unit
        const enrichedUnitStats = await Promise.all(
            unitStats.map(async (stat) => {
                const fields = await prisma.specifications.findMany({
                    where: { unit: stat.unit },
                    select: { field_name_vi: true },
                    distinct: ['field_name_vi'],
                    orderBy: { field_name_vi: 'asc' }
                });

                return {
                    type: 'unit_usage',
                    name: stat.unit,
                    count: stat._count.id,
                    fields: fields.map(f => f.field_name_vi)
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                field_usage: enrichedFieldStats,
                unit_usage: enrichedUnitStats
            },
            message: 'Specification statistics retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching specification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specification statistics',
            error: error.message
        });
    }
};