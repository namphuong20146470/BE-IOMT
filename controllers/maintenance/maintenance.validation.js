import { body, param, query } from 'express-validator';

// ==================== VALIDATION RULES ====================

export const createMaintenanceValidation = [
    body('device_id')
        .isUUID()
        .withMessage('Device ID must be a valid UUID'),
    
    body('maintenance_type')
        .isIn(['preventive', 'corrective', 'emergency', 'calibration'])
        .withMessage('Invalid maintenance type'),
    
    body('title')
        .isLength({ min: 3, max: 255 })
        .withMessage('Title must be between 3 and 255 characters'),
    
    body('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('performed_date')
        .isISO8601()
        .withMessage('Performed date must be a valid ISO8601 date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            if (date > now) {
                throw new Error('Performed date cannot be in the future');
            }
            return true;
        }),
    
    body('duration_minutes')
        .optional()
        .isInt({ min: 1, max: 10080 }) // Max 1 week in minutes
        .withMessage('Duration must be between 1 and 10080 minutes'),
    
    body('performed_by')
        .optional()
        .isUUID()
        .withMessage('Performed by must be a valid user UUID'),
    
    body('technician_name')
        .optional()
        .isLength({ min: 2, max: 255 })
        .withMessage('Technician name must be between 2 and 255 characters'),
    
    body('department_id')
        .optional()
        .isUUID()
        .withMessage('Department ID must be a valid UUID'),
    
    body('cost')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Cost must be a valid decimal with up to 2 decimal places')
        .custom((value) => {
            if (parseFloat(value) < 0) {
                throw new Error('Cost cannot be negative');
            }
            return true;
        }),
    
    body('currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-character code (e.g., VND, USD)'),
    
    body('status')
        .optional()
        .isIn(['completed', 'failed', 'partial', 'cancelled'])
        .withMessage('Invalid status'),
    
    body('severity')
        .optional()
        .isIn(['routine', 'urgent', 'emergency'])
        .withMessage('Invalid severity'),
    
    body('device_condition')
        .optional()
        .isIn(['excellent', 'good', 'fair', 'poor', 'critical'])
        .withMessage('Invalid device condition'),
    
    body('performance_rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Performance rating must be between 1 and 5'),
    
    body('next_maintenance_date')
        .optional()
        .isISO8601()
        .withMessage('Next maintenance date must be a valid ISO8601 date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            if (date <= now) {
                throw new Error('Next maintenance date must be in the future');
            }
            return true;
        }),
    
    body('next_maintenance_type')
        .optional()
        .isIn(['preventive', 'corrective', 'emergency', 'calibration'])
        .withMessage('Invalid next maintenance type'),
    
    body('parts')
        .optional()
        .isArray()
        .withMessage('Parts must be an array'),
    
    body('parts.*.part_name')
        .if(body('parts').exists())
        .isLength({ min: 1, max: 255 })
        .withMessage('Part name is required and must not exceed 255 characters'),
    
    body('parts.*.quantity')
        .if(body('parts').exists())
        .optional()
        .isInt({ min: 1 })
        .withMessage('Part quantity must be at least 1'),
    
    body('parts.*.unit_price')
        .if(body('parts').exists())
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Unit price must be a valid decimal'),
    
    body('parts.*.total_cost')
        .if(body('parts').exists())
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Total cost must be a valid decimal'),
];

export const updateMaintenanceValidation = [
    param('id')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID'),
    
    body('maintenance_type')
        .optional()
        .isIn(['preventive', 'corrective', 'emergency', 'calibration'])
        .withMessage('Invalid maintenance type'),
    
    body('title')
        .optional()
        .isLength({ min: 3, max: 255 })
        .withMessage('Title must be between 3 and 255 characters'),
    
    body('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('performed_date')
        .optional()
        .isISO8601()
        .withMessage('Performed date must be a valid ISO8601 date')
        .custom((value) => {
            if (value) {
                const date = new Date(value);
                const now = new Date();
                if (date > now) {
                    throw new Error('Performed date cannot be in the future');
                }
            }
            return true;
        }),
    
    body('duration_minutes')
        .optional()
        .isInt({ min: 1, max: 10080 })
        .withMessage('Duration must be between 1 and 10080 minutes'),
    
    body('cost')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Cost must be a valid decimal with up to 2 decimal places')
        .custom((value) => {
            if (value && parseFloat(value) < 0) {
                throw new Error('Cost cannot be negative');
            }
            return true;
        }),
    
    body('status')
        .optional()
        .isIn(['completed', 'failed', 'partial', 'cancelled'])
        .withMessage('Invalid status'),
    
    body('severity')
        .optional()
        .isIn(['routine', 'urgent', 'emergency'])
        .withMessage('Invalid severity'),
    
    body('device_condition')
        .optional()
        .isIn(['excellent', 'good', 'fair', 'poor', 'critical'])
        .withMessage('Invalid device condition'),
    
    body('performance_rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Performance rating must be between 1 and 5'),
];

export const getMaintenanceValidation = [
    param('id')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID')
];

export const deleteMaintenanceValidation = [
    param('id')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID')
];

export const getMaintenanceByDeviceValidation = [
    param('deviceId')
        .isUUID()
        .withMessage('Device ID must be a valid UUID'),
    
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

export const getMaintenanceListValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('device_id')
        .optional()
        .isUUID()
        .withMessage('Device ID must be a valid UUID'),
    
    query('maintenance_type')
        .optional()
        .isIn(['preventive', 'corrective', 'emergency', 'calibration'])
        .withMessage('Invalid maintenance type'),
    
    query('status')
        .optional()
        .isIn(['completed', 'failed', 'partial', 'cancelled'])
        .withMessage('Invalid status'),
    
    query('severity')
        .optional()
        .isIn(['routine', 'urgent', 'emergency'])
        .withMessage('Invalid severity'),
    
    query('date_from')
        .optional()
        .isISO8601()
        .withMessage('Date from must be a valid ISO8601 date'),
    
    query('date_to')
        .optional()
        .isISO8601()
        .withMessage('Date to must be a valid ISO8601 date'),
    
    query('performed_by')
        .optional()
        .isUUID()
        .withMessage('Performed by must be a valid UUID'),
    
    query('sort_by')
        .optional()
        .isIn([
            'performed_date', 'created_at', 'title', 'maintenance_type', 
            'status', 'severity', 'cost', 'duration_minutes'
        ])
        .withMessage('Invalid sort field'),
    
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc'),
    
    query('search')
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage('Search term must be between 1 and 255 characters')
];

// ==================== BULK OPERATIONS VALIDATION ====================

export const bulkCreateMaintenanceValidation = [
    body('maintenances')
        .isArray({ min: 1, max: 50 })
        .withMessage('Must provide 1-50 maintenance records'),
    
    body('maintenances.*.device_id')
        .isUUID()
        .withMessage('Each maintenance record must have a valid device ID'),
    
    body('maintenances.*.maintenance_type')
        .isIn(['preventive', 'corrective', 'emergency', 'calibration'])
        .withMessage('Each maintenance record must have a valid maintenance type'),
    
    body('maintenances.*.title')
        .isLength({ min: 3, max: 255 })
        .withMessage('Each maintenance record must have a title between 3 and 255 characters'),
    
    body('maintenances.*.performed_date')
        .isISO8601()
        .withMessage('Each maintenance record must have a valid performed date')
];

// ==================== PARTS VALIDATION ====================

export const createPartValidation = [
    param('maintenanceId')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID'),
    
    body('part_name')
        .isLength({ min: 1, max: 255 })
        .withMessage('Part name is required and must not exceed 255 characters'),
    
    body('part_number')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Part number must not exceed 100 characters'),
    
    body('quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
    
    body('unit_price')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Unit price must be a valid decimal'),
    
    body('total_cost')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Total cost must be a valid decimal'),
    
    body('supplier')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Supplier name must not exceed 255 characters'),
    
    body('warranty_months')
        .optional()
        .isInt({ min: 0, max: 120 })
        .withMessage('Warranty must be between 0 and 120 months')
];

export const updatePartValidation = [
    param('maintenanceId')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID'),
    
    param('partId')
        .isUUID()
        .withMessage('Part ID must be a valid UUID'),
    
    body('part_name')
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage('Part name must be between 1 and 255 characters'),
    
    body('quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
    
    body('unit_price')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Unit price must be a valid decimal'),
    
    body('total_cost')
        .optional()
        .isDecimal({ decimal_digits: '0,2' })
        .withMessage('Total cost must be a valid decimal')
];

// ==================== FILE UPLOAD VALIDATION ====================

// ==================== MAINTENANCE PARTS VALIDATIONS ====================

export const validateCreatePart = [
    validateUUID('maintenanceId'),

    body('part_name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Part name must be between 2 and 255 characters'),

    validateOptionalString('part_number', 1, 100),
    validateOptionalString('supplier', 1, 255),

    body('quantity')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Quantity must be between 1 and 10000'),

    body('unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Unit price must be a positive number'),

    body('total_cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Total cost must be a positive number'),

    body('warranty_months')
        .optional()
        .isInt({ min: 0, max: 240 })
        .withMessage('Warranty months must be between 0 and 240')
];

export const validateUpdatePart = [
    validateUUID('maintenanceId'),
    validateUUID('partId'),

    validateOptionalString('part_name', 2, 255),
    validateOptionalString('part_number', 1, 100),
    validateOptionalString('supplier', 1, 255),

    body('quantity')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Quantity must be between 1 and 10000'),

    body('unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Unit price must be a positive number'),

    body('total_cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Total cost must be a positive number'),

    body('warranty_months')
        .optional()
        .isInt({ min: 0, max: 240 })
        .withMessage('Warranty months must be between 0 and 240')
];

export const validatePartIds = [
    validateUUID('maintenanceId'),
    validateUUID('partId')
];

export const validateBulkCreateParts = [
    validateUUID('maintenanceId'),

    body('parts')
        .isArray({ min: 1, max: 50 })
        .withMessage('Parts must be an array with 1-50 items'),

    body('parts.*.part_name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Each part name must be between 2 and 255 characters'),

    body('parts.*.part_number')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Part number must not exceed 100 characters'),

    body('parts.*.quantity')
        .optional()
        .isInt({ min: 1, max: 10000 })
        .withMessage('Quantity must be between 1 and 10000'),

    body('parts.*.unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Unit price must be a positive number'),

    body('parts.*.total_cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Total cost must be a positive number'),

    body('parts.*.supplier')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Supplier name must not exceed 255 characters'),

    body('parts.*.warranty_months')
        .optional()
        .isInt({ min: 0, max: 240 })
        .withMessage('Warranty months must be between 0 and 240')
];

export const validatePartsQuery = [
    query('period')
        .optional()
        .isIn(['30', '90', '180', '365'])
        .withMessage('Period must be 30, 90, 180, or 365 days'),

    query('part_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Part name search must be between 2 and 100 characters'),

    query('supplier')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Supplier search must be between 2 and 100 characters')
];

// ==================== FILE UPLOAD & EXPORT VALIDATIONS ====================

export const uploadValidation = [
    param('maintenanceId')
        .isUUID()
        .withMessage('Maintenance ID must be a valid UUID'),
    
    body('file_type')
        .isIn(['photo', 'document', 'report'])
        .withMessage('File type must be photo, document, or report'),
    
    body('description')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Description must not exceed 255 characters')
];

export const exportValidation = [
    query('format')
        .optional()
        .isIn(['excel', 'pdf', 'csv'])
        .withMessage('Export format must be excel, pdf, or csv'),
    
    query('date_from')
        .optional()
        .isISO8601()
        .withMessage('Date from must be a valid ISO8601 date'),
    
    query('date_to')
        .optional()
        .isISO8601()
        .withMessage('Date to must be a valid ISO8601 date')
        .custom((value, { req }) => {
            if (value && req.query.date_from) {
                const dateFrom = new Date(req.query.date_from);
                const dateTo = new Date(value);
                if (dateTo <= dateFrom) {
                    throw new Error('Date to must be after date from');
                }
            }
            return true;
        })
];