 // shared/validation/pdu-schemas.js
import { z } from 'zod';

// Base validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const nonEmptyStringSchema = (maxLength = 255) => 
    z.string().min(1, 'Field is required').max(maxLength, `Maximum ${maxLength} characters allowed`);

// PDU Type and Status Enums
export const pduTypeSchema = z.enum(['standard', 'smart', 'switched', 'metered'], {
    errorMap: () => ({ message: 'PDU type must be one of: standard, smart, switched, metered' })
});

export const pduStatusSchema = z.enum(['active', 'inactive', 'maintenance'], {
    errorMap: () => ({ message: 'PDU status must be one of: active, inactive, maintenance' })
});

export const outletStatusSchema = z.enum(['active', 'idle', 'error', 'inactive'], {
    errorMap: () => ({ message: 'Outlet status must be one of: active, idle, error, inactive' })
});

export const deviceActionSchema = z.enum(['turn_on', 'turn_off', 'reset', 'toggle'], {
    errorMap: () => ({ message: 'Action must be one of: turn_on, turn_off, reset, toggle' })
});

// Network validation schemas
export const ipAddressSchema = z.string().ip('Invalid IP address format').optional();
export const macAddressSchema = z.string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format')
    .optional();

export const mqttTopicSchema = z.string()
    .regex(/^[a-zA-Z0-9_\/\-]+$/, 'MQTT topic can only contain letters, numbers, underscores, hyphens, and forward slashes')
    .max(100, 'MQTT topic maximum 100 characters')
    .optional();

// Date validation schemas
export const dateTimeSchema = z.string().datetime('Invalid datetime format').optional();
export const futureDateSchema = z.string().datetime().refine(
    (date) => new Date(date) > new Date(),
    { message: 'Date must be in the future' }
).optional();

// PDU Outlet Configuration Schema
export const outletConfigSchema = z.object({
    outlet_number: z.number().int().min(1, 'Outlet number must be at least 1').max(48, 'Maximum 48 outlets supported'),
    name: nonEmptyStringSchema(100).optional(),
    is_enabled: z.boolean().default(true),
    max_power_watts: positiveNumberSchema.optional(),
    voltage_rating: positiveNumberSchema.optional(),
    connector_type: z.string().max(50, 'Connector type maximum 50 characters').optional(),
    mqtt_topic_suffix: z.string().max(100, 'MQTT topic suffix maximum 100 characters').optional()
});

// Main PDU Schemas
export const createPDUSchema = z.object({
    // Required fields
    name: nonEmptyStringSchema(100),
    code: nonEmptyStringSchema(50),
    type: pduTypeSchema,
    organization_id: uuidSchema,
    outlet_count: z.number().int().min(1, 'At least 1 outlet required').max(48, 'Maximum 48 outlets supported'),
    voltage_rating: positiveNumberSchema,
    max_current: positiveNumberSchema,

    // Optional fields
    department_id: uuidSchema.optional(),
    location: z.string().max(200, 'Location maximum 200 characters').optional(),
    description: z.string().max(500, 'Description maximum 500 characters').optional(),
    max_power_watts: positiveNumberSchema.optional(),
    mqtt_base_topic: mqttTopicSchema,
    manufacturer: z.string().max(100, 'Manufacturer maximum 100 characters').optional(),
    model: z.string().max(100, 'Model maximum 100 characters').optional(),
    serial_number: z.string().max(100, 'Serial number maximum 100 characters').optional(),
    firmware_version: z.string().max(50, 'Firmware version maximum 50 characters').optional(),
    ip_address: ipAddressSchema,
    mac_address: macAddressSchema,
    installation_date: dateTimeSchema,
    warranty_end: futureDateSchema,
    notes: z.string().max(1000, 'Notes maximum 1000 characters').optional(),
    outlets_config: z.array(outletConfigSchema).optional()
});

export const updatePDUSchema = z.object({
    // All fields optional for updates
    name: nonEmptyStringSchema(100).optional(),
    code: nonEmptyStringSchema(50).optional(),
    type: pduTypeSchema.optional(),
    department_id: uuidSchema.optional(),
    location: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    voltage_rating: positiveNumberSchema.optional(),
    max_current: positiveNumberSchema.optional(),
    max_power_watts: positiveNumberSchema.optional(),
    mqtt_base_topic: mqttTopicSchema,
    manufacturer: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serial_number: z.string().max(100).optional(),
    firmware_version: z.string().max(50).optional(),
    ip_address: ipAddressSchema,
    mac_address: macAddressSchema,
    installation_date: dateTimeSchema,
    warranty_end: dateTimeSchema,
    notes: z.string().max(1000).optional(),
    is_active: z.boolean().optional(),
    status: pduStatusSchema.optional()
});

// Outlet Schemas
export const updateOutletSchema = z.object({
    name: z.string().max(100, 'Name maximum 100 characters').optional(),
    is_enabled: z.boolean().optional(),
    max_power_watts: positiveNumberSchema.optional(),
    voltage_rating: positiveNumberSchema.optional(),
    connector_type: z.string().max(50, 'Connector type maximum 50 characters').optional(),
    notes: z.string().max(500, 'Notes maximum 500 characters').optional(),
    mqtt_topic_suffix: z.string().max(100, 'MQTT topic suffix maximum 100 characters').optional()
});

export const assignDeviceSchema = z.object({
    device_id: uuidSchema,
    notes: z.string().max(500, 'Notes maximum 500 characters').optional()
});

export const unassignDeviceSchema = z.object({
    notes: z.string().max(500, 'Notes maximum 500 characters').optional()
});

export const transferDeviceSchema = z.object({
    from_outlet_id: uuidSchema,
    to_outlet_id: uuidSchema,
    notes: z.string().max(500, 'Notes maximum 500 characters').optional()
});

export const bulkAssignSchema = z.object({
    assignments: z.array(z.object({
        outlet_id: uuidSchema,
        device_id: uuidSchema,
        notes: z.string().max(500).optional()
    })).min(1, 'At least one assignment required').max(50, 'Maximum 50 assignments per request')
});

export const outletControlSchema = z.object({
    action: deviceActionSchema,
    force: z.boolean().default(false)
});

// Query parameter schemas
export const paginationSchema = z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).refine(n => n > 0, 'Page must be greater than 0').default('1'),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').default('20')
});

export const sortSchema = z.object({
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc'], {
        errorMap: () => ({ message: 'Sort order must be "asc" or "desc"' })
    }).default('asc')
});

export const pduQuerySchema = z.object({
    ...paginationSchema.shape,
    ...sortSchema.shape,
    organization_id: uuidSchema.optional(),
    department_id: uuidSchema.optional(),
    type: pduTypeSchema.optional(),
    status: pduStatusSchema.optional(),
    location: z.string().min(1, 'Location filter cannot be empty').optional(),
    search: z.string().min(1, 'Search term cannot be empty').optional(),
    include_stats: z.string().transform(val => val === 'true').optional(),
    sort_by: z.enum(['name', 'code', 'type', 'created_at', 'updated_at'], {
        errorMap: () => ({ message: 'Invalid sort field for PDUs' })
    }).default('name')
});

export const outletQuerySchema = z.object({
    ...paginationSchema.shape,
    ...sortSchema.shape,
    pdu_id: uuidSchema.optional(),
    organization_id: uuidSchema.optional(),
    department_id: uuidSchema.optional(),
    status: outletStatusSchema.optional(),
    assigned: z.enum(['true', 'false'], {
        errorMap: () => ({ message: 'Assigned filter must be "true" or "false"' })
    }).transform(val => val === 'true').optional(),
    search: z.string().min(1, 'Search term cannot be empty').optional(),
    include_device: z.string().transform(val => val === 'true').default(false),
    include_data: z.string().transform(val => val === 'true').default(false),
    sort_by: z.enum(['outlet_number', 'status', 'assigned_at', 'last_data_at'], {
        errorMap: () => ({ message: 'Invalid sort field for outlets' })
    }).default('outlet_number')
});

export const outletDataQuerySchema = z.object({
    date_from: dateTimeSchema,
    date_to: dateTimeSchema,
    interval: z.enum(['minute', 'hour', 'day'], {
        errorMap: () => ({ message: 'Interval must be one of: minute, hour, day' })
    }).default('hour'),
    metrics: z.string()
        .regex(/^(power|voltage|current)(,(power|voltage|current))*$/, 'Metrics must be comma-separated list of: power, voltage, current')
        .optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 1000, 'Limit must be between 1 and 1000').default('100')
});

export const statisticsQuerySchema = z.object({
    organization_id: uuidSchema.optional(),
    department_id: uuidSchema.optional(),
    date_from: dateTimeSchema,
    date_to: dateTimeSchema
});

// Device Assignment Validation Schemas
export const validateAssignmentSchema = z.object({
    outlet_id: uuidSchema,
    device_id: uuidSchema
});

export const validateBulkAssignmentSchema = z.object({
    assignments: z.array(z.object({
        outlet_id: uuidSchema,
        device_id: uuidSchema
    })).min(1, 'At least one assignment required').max(100, 'Maximum 100 assignments per validation')
});

export const validateTransferSchema = z.object({
    from_outlet_id: uuidSchema,
    to_outlet_id: uuidSchema
});

export const availableResourcesQuerySchema = z.object({
    organization_id: uuidSchema.optional(),
    department_id: uuidSchema.optional(),
    resource_type: z.enum(['devices', 'outlets'], {
        errorMap: () => ({ message: 'Resource type must be "devices" or "outlets"' })
    }).default('devices')
});

export const assignmentHistoryQuerySchema = z.object({
    resource_type: z.enum(['device', 'outlet'], {
        errorMap: () => ({ message: 'Resource type must be "device" or "outlet"' })
    }).default('device'),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').default('50')
});

export const checkConflictsSchema = z.object({
    outlet_id: uuidSchema,
    device_id: uuidSchema
});

// Comprehensive validation helper
export const validatePDUData = (data, isUpdate = false) => {
    const schema = isUpdate ? updatePDUSchema : createPDUSchema;
    
    try {
        const validated = schema.parse(data);
        
        // Additional business logic validation
        const warnings = [];
        
        // Check power calculations
        if (validated.max_power_watts && validated.voltage_rating && validated.max_current) {
            const calculatedPower = validated.voltage_rating * validated.max_current;
            if (validated.max_power_watts > calculatedPower * 1.1) { // 10% tolerance
                warnings.push(`Specified max power (${validated.max_power_watts}W) exceeds calculated power (${calculatedPower}W) by more than 10%`);
            }
        }
        
        // Check outlet count vs configuration
        if (validated.outlets_config && validated.outlet_count) {
            if (validated.outlets_config.length > validated.outlet_count) {
                throw new Error('Outlet configuration count exceeds specified outlet count');
            }
        }
        
        // Check MQTT topic format
        if (validated.mqtt_base_topic && !validated.mqtt_base_topic.startsWith('/')) {
            warnings.push('MQTT base topic should start with "/"');
        }
        
        return {
            success: true,
            data: validated,
            warnings
        };
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                errors: error.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message,
                    received: e.received
                }))
            };
        }
        
        return {
            success: false,
            errors: [{ message: error.message }]
        };
    }
};

// Export all schemas as a single object for convenience
export const pduSchemas = {
    // Entity schemas
    createPDU: createPDUSchema,
    updatePDU: updatePDUSchema,
    updateOutlet: updateOutletSchema,
    assignDevice: assignDeviceSchema,
    unassignDevice: unassignDeviceSchema,
    transferDevice: transferDeviceSchema,
    bulkAssign: bulkAssignSchema,
    outletControl: outletControlSchema,
    
    // Query schemas
    pduQuery: pduQuerySchema,
    outletQuery: outletQuerySchema,
    outletData: outletDataQuerySchema,
    statistics: statisticsQuerySchema,
    
    // Assignment schemas
    validateAssignment: validateAssignmentSchema,
    validateBulkAssignment: validateBulkAssignmentSchema,
    validateTransfer: validateTransferSchema,
    availableResources: availableResourcesQuerySchema,
    assignmentHistory: assignmentHistoryQuerySchema,
    checkConflicts: checkConflictsSchema,
    
    // Utility schemas
    pagination: paginationSchema,
    sort: sortSchema,
    uuid: uuidSchema,
    positiveNumber: positiveNumberSchema,
    nonEmptyString: nonEmptyStringSchema
};

export default pduSchemas;