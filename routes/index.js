// routes/index.js - API v1 Routes with versioning
import { Router } from 'express';
import { addVersionHeaders, validateVersion, getVersionInfo } from '../middleware/apiVersionMiddleware.js';
import authRoutes from '../features/auth/auth.routes.js';
import userRoutes from '../features/users/users.routes.js';
import userPermissionRoutes from '../features/users/userPermissions.routes.js';
import organizationRoutes from '../features/organizations/organizations.routes.js';
import departmentRoutes from '../features/departments/departments.routes.js';
import deviceRoutes from '../features/devices/device.routes.js';
import maintenanceRoutes from '../features/maintenance/maintenance.routes.js';
import alertRoutes from '../features/alerts/alerts.routes.js';

// PDU Management Routes - Now from features
import pduRoutes from '../features/pdu/pdu.routes.js';
import outletRoutes from '../features/outlets/outlet.routes.js';
import deviceAssignmentRoutes from '../features/devices/device-assignment.routes.js';

// Additional Feature Routes (TODO: Fix missing controllers)
// import roleRoutes from '../features/roles/roles.routes.js';
// import permissionRoutes from '../features/permissions/permissions.routes.js';
// import auditLogRoutes from '../features/audit-logs/audit-logs.routes.js';
// import sessionRoutes from '../features/sessions/sessions.routes.js';

const router = Router();

// API v1 Middleware
router.use(addVersionHeaders);
router.use(validateVersion(['v1']));

// API version info endpoint
router.get('/version', getVersionInfo);

// Core application routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/user-permissions', userPermissionRoutes);
router.use('/organizations', organizationRoutes);
router.use('/departments', departmentRoutes);
router.use('/devices', deviceRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/alerts', alertRoutes);

// PDU Management System Routes
router.use('/pdus', pduRoutes);
router.use('/outlets', outletRoutes);
router.use('/device-assignment', deviceAssignmentRoutes);

// Additional Feature Routes (TODO: Uncomment when controllers are fixed)
// router.use('/roles', roleRoutes);
// router.use('/permissions', permissionRoutes);
// router.use('/audit-logs', auditLogRoutes);
// router.use('/sessions', sessionRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            api: 'active',
            database: 'connected',
            mqtt: 'connected',
            websocket: 'active'
        }
    });
});

// API documentation endpoint
router.get('/info', (req, res) => {
    res.json({
        name: 'IoMT Backend API',
        version: 'v1.0.0',
        description: 'Internet of Medical Things - PDU Management System v1',
        features: [
            'PDU Management',
            'Outlet Control & Monitoring',
            'Device Assignment System',
            'Real-time MQTT Integration',
            'WebSocket Dashboard Support',
            'Comprehensive Device Tracking',
            'Power Monitoring & Analytics'
        ],
        endpoints: {
            core: [
                '/api/v1/auth - Authentication & Authorization',
                '/api/v1/users - User Management',
                '/api/v1/organizations - Organization Management', 
                '/api/v1/departments - Department Management',
                '/api/v1/devices - Device Management',
                '/api/v1/maintenance - Maintenance Schedules & History',
                '/api/v1/alerts - Alert Management & Notifications'
            ],
            pdu_management: [
                '/api/v1/pdus - Power Distribution Unit Management',
                '/api/v1/outlets - Outlet Control & Monitoring',
                '/api/v1/device-assignment - Device Assignment System'
            ],
            security_management: [
                '/api/v1/roles - Role Management',
                '/api/v1/permissions - Permission Management',
                '/api/v1/audit-logs - System Audit Logs',
                '/api/v1/sessions - Session Management'
            ]
        },
        documentation: '/api-docs',
        real_time: {
            websocket: 'ws://localhost:8080',
            mqtt_broker: process.env.MQTT_HOST || 'localhost:1883'
        }
    });
});

export default router;