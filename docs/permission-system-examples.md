# Permission System Integration - Examples

## 🚀 Quick Start

### 1. Run Migration
```bash
# Run the permission system migration
node migrations/migrate-permissions.js

# Verify migration
node migrations/migrate-permissions.js --verify-only
```

### 2. Update Routes with Permissions

```javascript
// routes/deviceRoutes.js - Updated with RBAC
import express from 'express';
import authMiddleware, { requirePermission, auditCRUD } from '../middleware/authMiddleware.js';
import { getAllDevices, createDevice, updateDevice, deleteDevice } from '../controllers/deviceController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Device management with permissions and audit logging
router.get('/devices', 
  requirePermission('device.read'),
  auditCRUD('device'),
  getAllDevices
);

router.post('/devices', 
  requirePermission('device.create'),
  auditCRUD('device'),
  createDevice
);

router.put('/devices/:id', 
  requirePermission('device.update', 'device'),
  auditCRUD('device'),
  updateDevice
);

router.delete('/devices/:id', 
  requirePermission('device.delete', 'device'),
  auditCRUD('device'),
  deleteDevice
);

export default router;
```

### 3. Update Controllers with Permission Checks

```javascript
// controllers/deviceController.js - Enhanced with permissions
import permissionService from '../services/PermissionService.js';
import auditService from '../services/AuditService.js';

export const getAllDevices = async (req, res) => {
  try {
    // Additional organization-level permission check
    const canViewAllOrgs = await permissionService.hasPermission(
      req.user.id,
      'device.manage'
    );

    const where = {};
    if (!canViewAllOrgs) {
      // Limit to user's organization if no global permissions
      where.organization_id = req.user.organization_id;
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        model: true,
        organization: true,
        department: true
      }
    });

    // Log successful read operation
    await auditService.batchLog({
      ...req.auditContext,
      action: 'read',
      resourceType: 'device',
      success: true,
      newValues: { count: devices.length }
    });

    res.json({
      success: true,
      data: devices,
      user_permissions: {
        can_create: await permissionService.hasPermission(req.user.id, 'device.create'),
        can_update: await permissionService.hasPermission(req.user.id, 'device.update'),
        can_delete: await permissionService.hasPermission(req.user.id, 'device.delete')
      }
    });
  } catch (error) {
    await auditService.log({
      ...req.auditContext,
      action: 'read',
      resourceType: 'device',
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching devices'
    });
  }
};
```

### 4. Session-based Authentication

```javascript
// controllers/authController.js - Updated with session management
import { sessionManager } from '../middleware/authMiddleware.js';
import auditService from '../services/AuditService.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate user credentials (existing logic)
    const user = await validateCredentials(username, password);
    if (!user) {
      await auditService.logLogin(
        null, null, req.ip, req.get('User-Agent'), false, 'Invalid credentials'
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create session
    const sessionData = await sessionManager.createSession(
      user.id,
      req.get('User-Agent'),
      req.ip
    );

    // Log successful login
    await auditService.logLogin(
      user.id, user.organization_id, req.ip, req.get('User-Agent')
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        organization: user.organization_name
      },
      session: {
        token: sessionData.session_token,
        expires_at: sessionData.expires_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken) {
      await sessionManager.invalidateSession(sessionToken);
    }

    await auditService.logLogout(
      req.user.id, req.user.organization_id, req.ip, req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};
```

### 5. Permission Management Controller

```javascript
// controllers/permissionController.js - New controller
import permissionService from '../services/PermissionService.js';
import auditService from '../services/AuditService.js';

export const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user can view other users' permissions
    const canViewOthers = await permissionService.hasPermission(
      req.user.id,
      'user.manage'
    );

    if (userId !== req.user.id && !canViewOthers) {
      return res.status(403).json({
        success: false,
        message: 'Cannot view other users permissions'
      });
    }

    const permissions = await permissionService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching permissions'
    });
  }
};

export const assignRole = async (req, res) => {
  try {
    const { userId, roleId, departmentId, validUntil } = req.body;

    // Check permission to assign roles
    const canAssignRoles = await permissionService.hasPermission(
      req.user.id,
      'role.assign'
    );

    if (!canAssignRoles) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: cannot assign roles'
      });
    }

    const assignment = await permissionService.assignRoleToUser(
      userId,
      roleId,
      req.user.organization_id,
      req.user.id,
      {
        department_id: departmentId,
        valid_until: validUntil
      }
    );

    // Log role assignment
    await auditService.logRoleAssigned(
      userId, roleId, req.user.id, req.user.organization_id,
      req.ip, req.get('User-Agent')
    );

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning role'
    });
  }
};
```

## 🔐 Available Permissions

### User Management
- `user.create` - Create new users
- `user.read` - View user information
- `user.update` - Update user information
- `user.delete` - Delete users
- `user.list` - View list of users
- `user.manage` - Full user management

### Device Management
- `device.create` - Add new devices
- `device.read` - View device information
- `device.update` - Update device information
- `device.delete` - Delete devices
- `device.manage` - Full device management
- `device.configure` - Configure device settings

### Alert & Monitoring
- `alert.read` - View alerts
- `alert.acknowledge` - Acknowledge alerts
- `alert.resolve` - Resolve alerts
- `alert.create` - Create alerts
- `alert.manage` - Full alert management

### System Administration
- `system.audit` - View audit logs
- `system.settings` - System configuration
- `system.backup` - System backup
- `system.maintenance` - System maintenance

## 👥 Default Roles

### Super Admin
- All permissions in the system
- Can manage organizations and users across all orgs

### Organization Admin
- Full access within their organization
- User, device, and alert management
- Cannot access other organizations

### Department Manager
- Limited user management within department
- Device monitoring and basic configuration
- Alert acknowledgment and resolution

### Device Manager
- Full device management and configuration
- Alert rule creation and management
- Device category management

### Technician
- Device configuration and updates
- Alert acknowledgment and resolution
- Read-only access to reports

### Operator
- Device monitoring
- Alert acknowledgment
- Basic reporting

### Viewer
- Read-only access to all resources
- No modification permissions

## 🛡️ Security Features

### Session Management
```javascript
// Client-side usage
const sessionToken = 'your-session-token';

// Include in requests
fetch('/api/devices', {
  headers: {
    'X-Session-Token': sessionToken
  }
});
```

### Audit Logging
All user actions are automatically logged:
- Login/logout events
- Permission checks (granted/denied)
- CRUD operations on resources
- Role and permission assignments

### Rate Limiting & Security
- Session timeout (default: 8 hours)
- Automatic cleanup of expired sessions
- IP address tracking
- Device fingerprinting support

## 📊 Monitoring & Analytics

### Audit Dashboard
```javascript
// Get security statistics
const stats = await auditService.getAuditStats(organizationId, 7); // Last 7 days

// Get failed login attempts
const securityLogs = await auditService.getSecurityLogs(organizationId, 24); // Last 24 hours
```

### Permission Analytics
```javascript
// Get user's effective permissions
const permissions = await permissionService.getUserPermissions(userId);

// Check specific permission
const hasPermission = await permissionService.hasPermission(userId, 'device.create');
```

## 🔧 Maintenance

### Daily Cleanup
Set up a cron job to run daily maintenance:

```bash
# In your cron jobs
0 2 * * * psql -d your_database -c "SELECT daily_permission_maintenance();"
```

Or in Node.js:
```javascript
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await prisma.$executeRaw`SELECT daily_permission_maintenance()`;
  console.log('Daily permission maintenance completed');
});
```

### Cache Management
```javascript
// Invalidate user cache when permissions change
await permissionService.invalidateUserCache(userId);

// Cleanup expired caches
await permissionService.cleanupExpiredCaches();
```

## 🚀 Testing

### Run Integration Tests
```bash
npm test -- permission-integration.test.js
```

### Manual Testing
```javascript
// Test permission checking
node -e "
import permissionService from './services/PermissionService.js';
const hasPermission = await permissionService.hasPermission('user-id', 'device.read');
console.log('Has permission:', hasPermission);
"
```

## 🔄 Migration Steps

1. **Backup Database**
   ```bash
   pg_dump your_database > backup_before_migration.sql
   ```

2. **Run Migration**
   ```bash
   node migrations/migrate-permissions.js
   ```

3. **Update Prisma Client**
   ```bash
   npm run prisma:generate
   ```

4. **Test Integration**
   ```bash
   npm test
   ```

5. **Deploy & Monitor**
   - Deploy with rolling restart
   - Monitor audit logs for any issues
   - Verify all routes work correctly

## 🆘 Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check user has required role/permission
   - Verify organization membership
   - Check session validity

2. **Slow Permission Checks**
   - Enable permission caching
   - Check database indexes
   - Monitor cache hit rates

3. **Migration Issues**
   - Check database permissions
   - Verify Prisma schema is up to date
   - Review migration logs

### Debug Mode
```javascript
// Enable debug logging
process.env.NODE_ENV = 'development';
process.env.DEBUG_PERMISSIONS = 'true';
```