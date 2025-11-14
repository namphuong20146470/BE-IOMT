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
            specifications: model.specifications || {}, // JSONB format
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
                manufacturers: {
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        website: true
                    }
                },
                suppliers: {
                    select: {
                        id: true,
                        name: true,
                        country: true,
                        website: true
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
                }
            }
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'Device model not found'
            });
        }

        // Format model with JSONB specifications
        const formattedModel = {
            id: model.id,
            name: model.name,
            manufacturer: model.manufacturers?.name || null,
            manufacturer_id: model.manufacturer_id,
            manufacturer_info: model.manufacturers,
            supplier_id: model.supplier_id,
            supplier_info: model.suppliers,
            model_number: model.model_number,
            category: model.category,
            devices_count: model.devices.length,
            devices: model.devices,
            created_at: model.created_at,
            updated_at: model.updated_at,
            specifications: model.specifications || {} // JSONB format
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

// Create device model with JSONB specifications support
export const createDeviceModel = async (req, res) => {
    try {
        const { 
            category_id, 
            name, 
            manufacturer_id, 
            supplier_id,
            model_number, 
            specifications 
        } = req.body;

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

        // ✅ Validate manufacturer if provided
        if (manufacturer_id) {
            const manufacturerExists = await prisma.manufacturers.findUnique({
                where: { id: manufacturer_id }
            });
            
            if (!manufacturerExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Manufacturer not found'
                });
            }
        }

        // ✅ Validate supplier if provided
        if (supplier_id) {
            const supplierExists = await prisma.suppliers.findUnique({
                where: { id: supplier_id }
            });
            
            if (!supplierExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Supplier not found'
                });
            }
        }

        // ✅ Validate specifications JSON structure
        let validatedSpecs = {};
        if (specifications) {
            try {
                validatedSpecs = typeof specifications === 'string' 
                    ? JSON.parse(specifications) 
                    : specifications;
                
                // Basic validation - ensure it's an object
                if (typeof validatedSpecs !== 'object' || Array.isArray(validatedSpecs)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Specifications must be a valid JSON object'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid specifications JSON format'
                });
            }
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

        // 🆕 Create new model with JSONB specifications
        const newModel = await prisma.device_models.create({
            data: {
                category_id,
                name: trimmedName,
                manufacturer_id: manufacturer_id || null,
                supplier_id: supplier_id || null,
                model_number: model_number?.trim() || null,
                specifications: validatedSpecs,
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
                        country: true
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
                manufacturer_id: newModel.manufacturer_id,
                manufacturer: newModel.manufacturers,
                supplier_id: newModel.supplier_id,
                supplier: newModel.suppliers,
                model_number: newModel.model_number,
                category_id: newModel.category_id,
                category: newModel.category,
                specifications: newModel.specifications,
                created_at: newModel.created_at,
                updated_at: newModel.updated_at
            },
            message: 'Device model created successfully',
            specifications_info: {
                format: 'JSONB',
                description: 'Specifications are stored in flexible JSONB format',
                example_update: `PUT /devices/models/${newModel.id} with {"specifications": {"electrical": {"voltage": "220V"}}}`
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

// Update device model with JSONB specifications support
export const updateDeviceModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            category_id, 
            name, 
            manufacturer_id, 
            supplier_id,
            model_number, 
            specifications 
        } = req.body;

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

        // Check manufacturer exists (if provided)
        if (manufacturer_id) {
            const manufacturerExists = await prisma.manufacturers.findUnique({
                where: { id: manufacturer_id }
            });
            
            if (!manufacturerExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Manufacturer not found'
                });
            }
        }

        // Check supplier exists (if provided)
        if (supplier_id) {
            const supplierExists = await prisma.suppliers.findUnique({
                where: { id: supplier_id }
            });
            
            if (!supplierExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Supplier not found'
                });
            }
        }

        // Build update data
        const updateData = {
            updated_at: new Date()
        };

        if (category_id !== undefined) updateData.category_id = category_id;
        if (name !== undefined) updateData.name = name;
        if (manufacturer_id !== undefined) updateData.manufacturer_id = manufacturer_id;
        if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
        if (model_number !== undefined) updateData.model_number = model_number;

        // Handle specifications update
        if (specifications !== undefined) {
            try {
                let validatedSpecs = typeof specifications === 'string' 
                    ? JSON.parse(specifications) 
                    : specifications;
                
                // If null, set to empty object
                if (validatedSpecs === null) {
                    validatedSpecs = {};
                }
                
                // Validate it's an object
                if (typeof validatedSpecs !== 'object' || Array.isArray(validatedSpecs)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Specifications must be a valid JSON object'
                    });
                }
                
                updateData.specifications = validatedSpecs;
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid specifications JSON format'
                });
            }
        }

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
                        country: true
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

        // Use Prisma ORM with updated JSONB specifications
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
                        country: true
                    }
                },
                devices: {
                    select: {
                        id: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Format response with JSONB specifications
        const formattedModels = models.map(model => ({
            id: model.id,
            name: model.name,
            manufacturer: model.manufacturers?.name || null,
            manufacturer_info: model.manufacturers,
            supplier_info: model.suppliers,
            model_number: model.model_number,
            category: model.category,
            devices_count: model.devices.length,
            created_at: model.created_at,
            updated_at: model.updated_at,
            ...(include_specs === 'true' && {
                specifications: model.specifications || {} // JSONB format
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
