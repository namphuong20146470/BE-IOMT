import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { requirePermission, requireOrganization } from '../middleware/rbacMiddleware.js';

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
    getDeviceStatistics
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
router.get('/device-categories', getAllDeviceCategories);

// GET /device-categories/root - Get root categories only
router.get('/device-categories/root', getRootCategories);

// GET /device-categories/:parentId/children - Get child categories
router.get('/device-categories/:parentId/children', getChildCategories);

// GET /device-categories/:id/stats - Get category with statistics
router.get('/device-categories/:id/stats', getCategoryWithStats);

// POST /device-categories - Create device category
router.post('/device-categories', authMiddleware, createDeviceCategory);

// PUT /device-categories/:id - Update device category
router.put('/device-categories/:id', authMiddleware, updateDeviceCategory);

// DELETE /device-categories/:id - Delete device category
router.delete('/device-categories/:id', authMiddleware, deleteDeviceCategory);

// ====================================================================
// DEVICE MODELS ROUTES
// ====================================================================

// GET /device-models - Get all device models with filtering
router.get('/device-models', getAllDeviceModels);

// GET /device-models/manufacturers - Get manufacturers list
router.get('/device-models/manufacturers', getManufacturers);

// GET /device-models/:id - Get device model by ID
router.get('/device-models/:id', getDeviceModelById);

// GET /device-models/category/:categoryId - Get models by category
router.get('/device-models/category/:categoryId', getModelsByCategory);

// POST /device-models - Create device model
router.post('/device-models', authMiddleware, createDeviceModel);

// PUT /device-models/:id - Update device model
router.put('/device-models/:id', authMiddleware, updateDeviceModel);

// DELETE /device-models/:id - Delete device model
router.delete('/device-models/:id', authMiddleware, deleteDeviceModel);

// ====================================================================
// DEVICES ROUTES
// ====================================================================

// GET /devices - Get all devices with filtering and pagination
router.get('/devices', authMiddleware, getAllDevices, requirePermission('device.read'));

// GET /devices/statistics - Get device statistics
router.get('/devices/statistics', getDeviceStatistics);

// GET /devices/:id - Get device by ID with full details
router.get('/devices/:id', getDeviceById);

// POST /devices - Create device
router.post('/devices', authMiddleware, createDevice);

// PUT /devices/:id - Update device
router.put('/devices/:id', authMiddleware, updateDevice);

// DELETE /devices/:id - Delete device
router.delete('/devices/:id', authMiddleware, deleteDevice);

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
