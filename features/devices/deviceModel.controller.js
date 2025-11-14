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

// Create device model (Complete version with all fields)
export const createDeviceModel = async (req, res) => {
    try {
        const { 
            category_id, 
            name, 
            model_number, 
            manufacturer_id, 
            supplier_id,
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

        // Validate model_number length if provided
        if (model_number && model_number.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Model number too long (max 100 characters)'
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

        // ✅ Check manufacturer exists if provided
        if (manufacturer_id) {
            const manufacturerExists = await prisma.manufacturers.findUnique({
                where: { id: manufacturer_id },
                select: { id: true, name: true }
            });
            
            if (!manufacturerExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Manufacturer not found',
                    hint: 'Use GET /manufacturers to get valid manufacturer IDs'
                });
            }
        }

        // ✅ Check supplier exists if provided
        if (supplier_id) {
            const supplierExists = await prisma.suppliers.findUnique({
                where: { id: supplier_id },
                select: { id: true, name: true }
            });
            
            if (!supplierExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Supplier not found',
                    hint: 'Use GET /suppliers to get valid supplier IDs'
                });
            }
        }

        // 🔍 Duplicate check by name
        const duplicateByName = await prisma.device_models.findFirst({
            where: {
                name: {
                    equals: trimmedName,
                    mode: 'insensitive'
                }
            }
        });
        
        if (duplicateByName) {
            return res.status(400).json({
                success: false,
                message: 'Device model with this name already exists',
                existing_model: {
                    id: duplicateByName.id,
                    name: duplicateByName.name,
                    model_number: duplicateByName.model_number
                }
            });
        }

        // 🔍 Check model_number uniqueness if provided
        if (model_number && model_number.trim() !== '') {
            const duplicateByModelNumber = await prisma.device_models.findFirst({
                where: {
                    model_number: model_number.trim()
                }
            });
            
            if (duplicateByModelNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Model number already exists',
                    existing_model: {
                        id: duplicateByModelNumber.id,
                        name: duplicateByModelNumber.name,
                        model_number: duplicateByModelNumber.model_number
                    }
                });
            }
        }

        // Validate and parse specifications JSON
        let specsJson = {};
        if (specifications) {
            if (typeof specifications === 'string') {
                try {
                    specsJson = JSON.parse(specifications);
                } catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid specifications JSON format'
                    });
                }
            } else if (typeof specifications === 'object') {
                specsJson = specifications;
            }
        }

        // 🆕 Create new model (complete version)
        const newModel = await prisma.device_models.create({
            data: {
                category_id,
                name: trimmedName,
                model_number: model_number?.trim() || null,
                manufacturer_id: manufacturer_id || null,
                supplier_id: supplier_id || null,
                specifications: specsJson,
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
                        country: true,
                        website: true
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
                }
            }
        });

        console.log(`✅ Created device model: ${newModel.name} (${newModel.id})`);

        res.status(201).json({
            success: true,
            data: {
                id: newModel.id,
                name: newModel.name,
                model_number: newModel.model_number,
                category_id: newModel.category_id,
                category: newModel.category,
                manufacturer_id: newModel.manufacturer_id,
                manufacturer: newModel.manufacturers,
                supplier_id: newModel.supplier_id,
                supplier: newModel.suppliers,
                specifications: newModel.specifications,
                created_at: newModel.created_at,
                updated_at: newModel.updated_at
            },
            message: 'Device model created successfully'
        });
    } catch (error) {
        console.error('❌ Error creating device model:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Device model already exists (unique constraint violation)',
                field: error.meta?.target
            });
        }
        
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Invalid foreign key reference',
                details: 'Check category_id, manufacturer_id, or supplier_id'
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

// Get suppliers list
export const getSuppliers = async (req, res) => {
    try {
        console.log('🔍 [getSuppliers] Request received');
        
        // Get all suppliers that have device models
        const suppliers = await prisma.suppliers.findMany({
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

        console.log(`✅ [getSuppliers] Found ${suppliers.length} suppliers`);

        // Format response
        const formattedSuppliers = suppliers.map(item => ({
            id: item.id,
            name: item.name,
            country: item.country,
            website: item.website,
            contact_info: item.contact_info,
            models_count: item._count.device_models
        }));

        res.status(200).json({
            success: true,
            data: formattedSuppliers,
            count: formattedSuppliers.length,
            message: 'Suppliers list retrieved successfully'
        });
    } catch (error) {
        console.error('❌ [getSuppliers] Error:', error);
        console.error('❌ [getSuppliers] Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch suppliers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// ==========================================
// CREATE MANUFACTURER
// ==========================================
export const createManufacturer = async (req, res) => {
    try {
        const { name, country, website, contact_info } = req.body;

        console.log('📥 Creating manufacturer:', { name, country, website });

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Manufacturer name is required'
            });
        }

        // Check duplicate
        const existing = await prisma.manufacturers.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Manufacturer with this name already exists',
                existing_id: existing.id
            });
        }

        // Validate website URL if provided
        if (website && website.trim() !== '') {
            try {
                new URL(website);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid website URL format'
                });
            }
        }

        // Create manufacturer
        const manufacturer = await prisma.manufacturers.create({
            data: {
                name: name.trim(),
                country: country?.trim() || null,
                website: website?.trim() || null,
                contact_info: contact_info || {}
            }
        });

        console.log('✅ Manufacturer created:', manufacturer.id);

        res.status(201).json({
            success: true,
            message: 'Manufacturer created successfully',
            data: {
                id: manufacturer.id,
                name: manufacturer.name,
                country: manufacturer.country,
                website: manufacturer.website,
                contact_info: manufacturer.contact_info
            }
        });
    } catch (error) {
        console.error('❌ Create manufacturer error:', error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Manufacturer name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create manufacturer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// ==========================================
// CREATE SUPPLIER
// ==========================================
export const createSupplier = async (req, res) => {
    try {
        const { name, country, website, contact_info } = req.body;

        console.log('📥 Creating supplier:', { name, country, website });

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Supplier name is required'
            });
        }

        // Check duplicate
        const existing = await prisma.suppliers.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Supplier with this name already exists',
                existing_id: existing.id
            });
        }

        // Validate website URL if provided
        if (website && website.trim() !== '') {
            try {
                new URL(website);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid website URL format'
                });
            }
        }

        // Create supplier
        const supplier = await prisma.suppliers.create({
            data: {
                name: name.trim(),
                country: country?.trim() || null,
                website: website?.trim() || null,
                contact_info: contact_info || {}
            }
        });

        console.log('✅ Supplier created:', supplier.id);

        res.status(201).json({
            success: true,
            message: 'Supplier created successfully',
            data: {
                id: supplier.id,
                name: supplier.name,
                country: supplier.country,
                website: supplier.website,
                contact_info: supplier.contact_info
            }
        });
    } catch (error) {
        console.error('❌ Create supplier error:', error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Supplier name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create supplier',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
