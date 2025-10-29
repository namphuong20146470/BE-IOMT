import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { requirePermission, requireOrganization } from '../shared/middleware/rbacMiddleware.js';

// Device Category Controllers
import {
    getAllDeviceCategories,
    getRootCategories,
    getChildCategories,
    createDeviceCategory,
    updateDeviceCategory,
    deleteDeviceCategory,
    getCategoryWithStats
} from '../controllers/devices/deviceCategory.controller.js';

// Device Model Controllers  
import {
    getAllDeviceModels,
    getDeviceModelById,
    createDeviceModel,
    updateDeviceModel,
    deleteDeviceModel,
    getModelsByCategory,
    getManufacturers
} from '../controllers/devices/deviceModel.controller.js';

// Device Controllers
import {
    getAllDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
    getDeviceStatistics,
    validateAssetTag
} from '../controllers/devices/device.controller.js';

// Device Connectivity Controllers
import {
    getDeviceConnectivity,
    getAllDeviceConnectivities,
    createDeviceConnectivity,
    updateDeviceConnectivity,
    updateLastConnected,
    deleteDeviceConnectivity,
    getConnectivityStatistics
} from '../controllers/devices/deviceConnectivity.controller.js';

// Warranty Controllers
import {
    getWarrantyByDevice,
    getAllWarranties,
    createWarranty,
    updateWarranty,
    deleteWarranty,
    getWarrantyStatistics,
    getExpiringWarranties
} from '../controllers/devices/warranty.controller.js';

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
router.get('/devices', authMiddleware, requirePermission('device.read'), getAllDevices);

// GET /devices/statistics - Get device statistics
router.get('/devices/statistics', authMiddleware, requirePermission('device.read'), getDeviceStatistics);

// GET /devices/validate/asset-tag - Validate asset tag uniqueness
router.get('/devices/validate/asset-tag', authMiddleware, requirePermission('device.read'), validateAssetTag);

// GET /devices/:id - Get device by ID with full details
router.get('/devices/:id', authMiddleware, requirePermission('device.read'), getDeviceById);

// POST /devices - Create device
router.post('/devices', authMiddleware, requirePermission('device.create'), createDevice);

// PUT /devices/:id - Update device
router.put('/devices/:id', authMiddleware, requirePermission('device.update'), updateDevice);

// DELETE /devices/:id - Delete device
router.delete('/devices/:id', authMiddleware, requirePermission('device.delete'), deleteDevice);

// ====================================================================
// DEVICE CONNECTIVITY ROUTES
// ====================================================================

// GET /device-connectivity - Get all device connectivities with filtering
router.get('/device-connectivity', getAllDeviceConnectivities);

// GET /device-connectivity/statistics - Get connectivity statistics
router.get('/device-connectivity/statistics', getConnectivityStatistics);

// GET /device-connectivity/device/:deviceId - Get connectivity by device ID
router.get('/device-connectivity/device/:deviceId', getDeviceConnectivity);

// POST /device-connectivity - Create device connectivity
router.post('/device-connectivity', authMiddleware, createDeviceConnectivity);

// PUT /device-connectivity/:id - Update device connectivity
router.put('/device-connectivity/:id', authMiddleware, updateDeviceConnectivity);

// PUT /device-connectivity/device/:deviceId/heartbeat - Update last connected
router.put('/device-connectivity/device/:deviceId/heartbeat', updateLastConnected);

// DELETE /device-connectivity/:id - Delete device connectivity
router.delete('/device-connectivity/:id', authMiddleware, deleteDeviceConnectivity);

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
