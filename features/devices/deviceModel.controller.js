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
        
        // Build where conditions
        let whereConditions = {};
        
        if (category_id) {
            whereConditions.category_id = category_id;
        }
        
        if (manufacturer) {
            whereConditions.manufacturers = {
                name: {
                    contains: manufacturer,
                    mode: 'insensitive'
                }
            };
        }

        const models = await prisma.device_models.findMany({
            where: whereConditions,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                manufacturers: {
                    select: {
                        id: true,
                        name: true,
                        country: true
                    }
                },
                suppliers: {
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        website: true,
                        contact_info: true
                    }
                },
                devices: {
                    select: {
                        id: true
                    }
                },
                specifications: {
                    include: {
                        specification_fields: {
                            select: {
                                field_name: true,
                                field_name_vi: true,
                                field_name_en: true,
                                unit: true,
                                data_type: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { name: 'asc' }
            ]
        });

        // Format response
        const formattedModels = models.map(model => ({
            id: model.id,
            name: model.name,
            manufacturer: model.manufacturers?.name || null,
            manufacturer_country: model.manufacturers?.country || null,
            supplier: model.suppliers?.name || null,
            model_number: model.model_number,
            category_id: model.category_id,
            category_name: model.category?.name,
            category_description: model.category?.description,
            devices_count: model.devices.length,
            specifications: model.specifications.map(spec => ({
                id: spec.id,
                field_name: spec.specification_fields?.field_name,
                field_name_vi: spec.specification_fields?.field_name_vi,
                field_name_en: spec.specification_fields?.field_name_en,
                value: spec.value,
                unit: spec.specification_fields?.unit,
                data_type: spec.specification_fields?.data_type
            })),
            created_at: model.created_at,
            created_at: model.created_at,
            updated_at: model.updated_at
        }));

        res.status(200).json({
            success: true,
            data: formattedModels,
            count: formattedModels.length,
            message: 'Device models retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device models:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device models',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get device model by ID
export const getDeviceModelById = async (req, res) => {
    try {
        const { id } = req.params;

        const model = await prisma.device_models.findUnique({
            where: {
                id: id
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                devices: {
                    select: {
                        id: true,
                        serial_number: true,
                        asset_tag: true,
                        status: true,
                        location: true
                    }
                },
                specifications: {
                    include: {
                        specification_fields: {
                            select: {
                                field_name: true,
                                field_name_vi: true,
                                field_name_en: true,
                                unit: true,
                                category: true,
                                data_type: true,
                                placeholder: true,
                                help_text: true
                            }
                        }
                    },
                    orderBy: {
                        display_order: 'asc'
                    }
                }
            }
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'Device model not found'
            });
        }

        // Format specifications
        const formattedModel = {
            id: model.id,
            name: model.name,
            manufacturer: model.manufacturer,
            model_number: model.model_number,
            description: model.description,
            category: model.category,
            devices_count: model.devices.length,
            devices: model.devices,
            created_at: model.created_at,
            updated_at: model.updated_at,
            specifications: model.specifications?.map(spec => ({
                id: spec.id,
                field_name: spec.specification_fields?.field_name,
                field_name_vi: spec.specification_fields?.field_name_vi,
                field_name_en: spec.specification_fields?.field_name_en,
                value: spec.value,
                unit: spec.unit || spec.specification_fields?.unit,
                description: spec.description,
                display_order: spec.display_order,
                numeric_value: spec.numeric_value,
                is_visible: spec.is_visible,
                category: spec.specification_fields?.category,
                data_type: spec.specification_fields?.data_type,
                placeholder: spec.specification_fields?.placeholder,
                help_text: spec.specification_fields?.help_text,
                created_at: spec.created_at,
                updated_at: spec.updated_at
            })) || []
        };

        res.status(200).json({
            success: true,
            data: formattedModel,
            message: 'Device model retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch device model',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Create device model (Simple version)
export const createDeviceModel = async (req, res) => {
    try {
        const { category_id, name, manufacturer, model_number, description } = req.body;

        // 📋 Basic validation
        if (!category_id || !name) {
            return res.status(400).json({
                success: false,
                message: 'Category ID and name are required',
                details: {
                    category_id: !category_id ? 'Category ID is required' : null,
                    name: !name ? 'Device name is required' : null
                }
            });
        }

        // Trim and validate lengths
        const trimmedName = name.trim();
        if (trimmedName.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Device name cannot be empty'
            });
        }

        if (trimmedName.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Device name too long (max 255 characters)'
            });
        }

        // ✅ Check if category exists
        const categoryExists = await prisma.device_categories.findUnique({
            where: { id: category_id },
            select: { id: true, name: true, description: true }
        });
        
        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                message: 'Device category not found'
            });
        }

        // 🔍 Simple duplicate check (by name only for simplicity)
        const duplicateCheck = await prisma.device_models.findFirst({
            where: {
                name: {
                    equals: trimmedName,
                    mode: 'insensitive'
                }
            }
        });
        
        if (duplicateCheck) {
            return res.status(400).json({
                success: false,
                message: 'Device model with this name already exists',
                existing_model: {
                    id: duplicateCheck.id,
                    name: duplicateCheck.name,
                    manufacturer: duplicateCheck.manufacturer
                }
            });
        }

        // 🆕 Create new model (simplified)
        const newModel = await prisma.device_models.create({
            data: {
                category_id,
                name: trimmedName,
                manufacturer: manufacturer?.trim() || null,
                model_number: model_number?.trim() || null,
                description: description?.trim() || null,
                created_at: new Date(),
                updated_at: new Date()
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });

        console.log(`✅ Created device model: ${newModel.name} (${newModel.id})`);

        res.status(201).json({
            success: true,
            data: {
                id: newModel.id,
                name: newModel.name,
                manufacturer: newModel.manufacturer,
                model_number: newModel.model_number,
                description: newModel.description,
                category_id: newModel.category_id,
                category: newModel.category,
                created_at: newModel.created_at,
                updated_at: newModel.updated_at
            },
            message: 'Device model created successfully',
            next_step: {
                action: 'add_specifications',
                endpoint: `/specifications/models/${newModel.id}`,
                description: 'You can now add technical specifications to this model'
            }
        });
    } catch (error) {
        console.error('❌ Error creating device model:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Device model already exists (unique constraint violation)'
            });
        }
        
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID (foreign key constraint)'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create device model',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update device model
export const updateDeviceModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, manufacturer, model_number, description } = req.body;

        // Check if model exists
        const existingModel = await prisma.device_models.findUnique({
            where: { id: id }
        });
        
        if (!existingModel) {
            return res.status(404).json({
                success: false,
                message: 'Device model not found'
            });
        }

        // Check category exists (if provided)
        if (category_id) {
            const categoryExists = await prisma.device_categories.findUnique({
                where: { id: category_id }
            });
            
            if (!categoryExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Device category not found'
                });
            }
        }

        // Build update data
        const updateData = {
            updated_at: new Date()
        };

        if (category_id !== undefined) updateData.category_id = category_id;
        if (name !== undefined) updateData.name = name;
        if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
        if (model_number !== undefined) updateData.model_number = model_number;
        if (description !== undefined) updateData.description = description;

        const updatedModel = await prisma.device_models.update({
            where: { id: id },
            data: updateData,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: updatedModel,
            message: 'Device model updated successfully'
        });
    } catch (error) {
        console.error('Error updating device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update device model',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete device model
export const deleteDeviceModel = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if model has devices
        const hasDevices = await prisma.device.findFirst({
            where: { model_id: id }
        });
        
        if (hasDevices) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete model with existing devices'
            });
        }

        await prisma.device_models.delete({
            where: { id: id }
        });

        res.status(200).json({
            success: true,
            message: 'Device model deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device model:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete device model',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get models by category
export const getModelsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { include_specs = 'false' } = req.query;

        // Use Prisma ORM instead of raw SQL to avoid schema issues
        const models = await prisma.device_models.findMany({
            where: {
                category_id: categoryId
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                devices: {
                    select: {
                        id: true
                    }
                },
                ...(include_specs === 'true' && {
                    specifications: {
                        include: {
                            specification_fields: {
                                select: {
                                    field_name: true,
                                    field_name_vi: true,
                                    field_name_en: true,
                                    unit: true,
                                    category: true,
                                    data_type: true,
                                    placeholder: true,
                                    help_text: true
                                }
                            }
                        }
                    }
                })
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Format response
        const formattedModels = models.map(model => ({
            id: model.id,
            name: model.name,
            manufacturer: model.manufacturer,
            model_number: model.model_number,
            description: model.description,
            category: model.category,
            devices_count: model.devices.length,
            created_at: model.created_at,
            updated_at: model.updated_at,
            ...(include_specs === 'true' && {
                specifications: model.specifications?.map(spec => ({
                    id: spec.id,
                    field_name: spec.specification_fields?.field_name,
                    field_name_vi: spec.specification_fields?.field_name_vi,
                    field_name_en: spec.specification_fields?.field_name_en,
                    value: spec.value,
                    unit: spec.unit || spec.specification_fields?.unit,
                    description: spec.description,
                    display_order: spec.display_order,
                    numeric_value: spec.numeric_value,
                    is_visible: spec.is_visible,
                    category: spec.specification_fields?.category,
                    data_type: spec.specification_fields?.data_type,
                    placeholder: spec.specification_fields?.placeholder,
                    help_text: spec.specification_fields?.help_text
                })) || []
            })
        }));

        res.status(200).json({
            success: true,
            data: formattedModels,
            count: formattedModels.length,
            message: 'Models by category retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching models by category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch models by category',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get manufacturers list
export const getManufacturers = async (req, res) => {
    try {
        // Get all manufacturers that have device models
        const manufacturers = await prisma.manufacturers.findMany({
            where: {
                device_models: {
                    some: {} // Has at least one device model
                }
            },
            include: {
                _count: {
                    select: {
                        device_models: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Format response
        const formattedManufacturers = manufacturers.map(item => ({
            id: item.id,
            name: item.name,
            country: item.country,
            website: item.website,
            models_count: item._count.device_models
        }));

        res.status(200).json({
            success: true,
            data: formattedManufacturers,
            count: formattedManufacturers.length,
            message: 'Manufacturers list retrieved successfully'
        });
    } catch (error) {
        console.error('Error fetching manufacturers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch manufacturers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
