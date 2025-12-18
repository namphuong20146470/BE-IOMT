import express from 'express';
import { authMiddleware } from '../../shared/middleware/authMiddleware.js';
import { requirePermission, requireOrganization } from '../../shared/middleware/rbacMiddleware.js';

// Device Category Controllers
import {
    getAllDeviceCategories,
    getRootCategories,
    getChildCategories,
    createDeviceCategory,
    updateDeviceCategory,
    deleteDeviceCategory,
    getCategoryWithStats
} from './deviceCategory.controller.js';

// Device Model Controllers  
import {
    getAllDeviceModels,
    getDeviceModelById,
    createDeviceModel,
    updateDeviceModel,
    deleteDeviceModel,
    getModelsByCategory,
    getManufacturers,
    getSuppliers,
    createManufacturer,
    createSupplier
} from './deviceModel.controller.js';

// Device Controllers
import {
    getAllDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
    restoreDevice,
    getDeletedDevices,
    getDeviceStatistics,
    validateAssetTag,
    validateSerialNumber,
    changeDeviceVisibility,
    getDevicesByVisibility,
    assignDeviceToDepartment
} from './device.controller.js';

// Note: Device Connectivity functionality has been migrated to socket-based MQTT architecture

// Warranty Controllers
import {
    getWarrantyByDevice,
    getAllWarranties,
    createWarranty,
    updateWarranty,
    deleteWarranty,
    getWarrantyStatistics,
    getExpiringWarranties
} from './warranty.controller.js';

// Device History Controllers (Legacy - only in controllers/)
import {
    getDeviceHistory,
    getDeviceRealtimeData,
    getDeviceDataSummary
} from '../../controllers/devices/deviceHistory.controller.js';

const router = express.Router();

// ====================================================================
// DEVICE CATEGORIES ROUTES
// ====================================================================

// GET /device-categories - Get all categories (hierarchical)
router.get('/device-categories', authMiddleware, requirePermission('device.read'), getAllDeviceCategories);

// GET /device-categories/root - Get root categories only
router.get('/device-categories/root', authMiddleware, getRootCategories);

// GET /device-categories/:parentId/children - Get child categories
router.get('/device-categories/:parentId/children', authMiddleware, getChildCategories);

// GET /device-categories/:id/stats - Get category with statistics
router.get('/device-categories/:id/stats', authMiddleware, requirePermission('device.read'), getCategoryWithStats);

// POST /device-categories - Create device category (Admin only)
router.post('/device-categories', authMiddleware, requirePermission('device.manage'), createDeviceCategory);

// PUT /device-categories/:id - Update device category (Admin only)
router.put('/device-categories/:id', authMiddleware, requirePermission('device.manage'), updateDeviceCategory);

// DELETE /device-categories/:id - Delete device category (Admin only)
router.delete('/device-categories/:id', authMiddleware, requirePermission('device.manage'), deleteDeviceCategory);

// ====================================================================
// DEVICE MODELS ROUTES
// ====================================================================

// GET /device-models - Get all device models with filtering
router.get('/device-models', authMiddleware, requirePermission('device.read'), getAllDeviceModels);

// GET /device-models/manufacturers - Get manufacturers list
router.get('/device-models/manufacturers', authMiddleware, getManufacturers);

// GET /device-models/suppliers - Get suppliers list
router.get('/device-models/suppliers', authMiddleware, getSuppliers);

// POST /manufacturers - Create manufacturer
router.post('/manufacturers', authMiddleware, requirePermission('device.manage'), createManufacturer);

// POST /suppliers - Create supplier
router.post('/suppliers', authMiddleware, requirePermission('device.manage'), createSupplier);

// GET /device-models/:id - Get device model by ID
router.get('/device-models/:id', authMiddleware, requirePermission('device.read'), getDeviceModelById);

// GET /device-models/category/:categoryId - Get models by category
router.get('/device-models/category/:categoryId', authMiddleware, requirePermission('device.read'), getModelsByCategory);

// POST /device-models - Create device model (Admin only)
router.post('/device-models', authMiddleware, requirePermission('device.manage'), createDeviceModel);

// PUT /device-models/:id - Update device model (Admin only)
router.put('/device-models/:id', authMiddleware, requirePermission('device.manage'), updateDeviceModel);

// DELETE /device-models/:id - Delete device model (Admin only)
router.delete('/device-models/:id', authMiddleware, requirePermission('device.manage'), deleteDeviceModel);

// ====================================================================
// DEVICES ROUTES
// ====================================================================

// GET /devices - Get all devices with filtering and pagination
router.get('/', authMiddleware, requirePermission('device.read'), getAllDevices);

// GET /devices/statistics - Get device statistics
router.get('/statistics', authMiddleware, requirePermission('device.read'), getDeviceStatistics);

// GET /devices/validate/serial - Validate serial number uniqueness
router.get('/validate/serial', authMiddleware, requirePermission('device.read'), validateSerialNumber);

// GET /devices/validate/asset-tag - Validate asset tag uniqueness
router.get('/validate/asset-tag', authMiddleware, requirePermission('device.read'), validateAssetTag);

// GET /devices/visibility/:visibility - Get devices by visibility (public/department/private/all)
router.get('/visibility/:visibility', authMiddleware, requirePermission('device.read'), getDevicesByVisibility);

// GET /devices/deleted - Get deleted devices (for restore)
router.get('/deleted', authMiddleware, requirePermission('device.read'), getDeletedDevices);

// GET /devices/:id - Get device by ID with full details
router.get('/:id', authMiddleware, requirePermission('device.read'), getDeviceById);

// POST /devices - Create device
router.post('/', authMiddleware, requirePermission('device.create'), createDevice);

// PUT /devices/:id - Update device
router.put('/:id', authMiddleware, requirePermission('device.update'), updateDevice);

// PUT /devices/:id/visibility - Change device visibility
router.put('/:id/visibility', authMiddleware, requirePermission('device.update'), changeDeviceVisibility);

// PUT /devices/:id/department - Assign device to department
router.put('/:id/department', authMiddleware, requirePermission('device.update'), assignDeviceToDepartment);

// POST /devices/:id/restore - Restore deleted device
router.post('/:id/restore', authMiddleware, requirePermission('device.delete'), restoreDevice);

// DELETE /devices/:id - Delete device (soft delete)
router.delete('/:id', authMiddleware, requirePermission('device.delete'), deleteDevice);

// ====================================================================
// DEVICE DATA & HISTORY ROUTES
// ====================================================================

// GET /devices/:id/realtime - Get latest sensor data for device
router.get('/:id/realtime', 
    authMiddleware, 
    requirePermission('device.read'), 
    getDeviceRealtimeData
);

// GET /devices/:id/history - Get sensor data history for device
router.get('/:id/history', 
    authMiddleware, 
    requirePermission('device.read'), 
    getDeviceHistory
);

// GET /devices/:id/summary - Get data statistics summary for device
router.get('/:id/summary', 
    authMiddleware, 
    requirePermission('device.read'), 
    getDeviceDataSummary
);

// ====================================================================
// SOCKET-BASED MQTT ROUTES (Replaced Device Connectivity)
// ====================================================================
// Note: Device connectivity is now managed through socket-based MQTT architecture
// See /api/sockets and /api/mqtt endpoints for MQTT configuration and management

// ====================================================================
// WARRANTY ROUTES
// ====================================================================

// GET /warranties - Get all warranties with filtering
router.get('/warranties', getAllWarranties);

// GET /warranties/statistics - Get warranty statistics
router.get('/warranties/statistics', getWarrantyStatistics);

// GET /warranties/expiring - Get expiring warranties
router.get('/warranties/expiring', getExpiringWarranties);

// GET /warranties/device/:deviceId - Get warranty by device ID
router.get('/warranties/device/:deviceId', getWarrantyByDevice);

// POST /warranties - Create warranty info
router.post('/warranties', authMiddleware, createWarranty);

// PUT /warranties/:id - Update warranty info
router.put('/warranties/:id', authMiddleware, updateWarranty);

// DELETE /warranties/:id - Delete warranty info
router.delete('/warranties/:id', authMiddleware, deleteWarranty);

export default router;
