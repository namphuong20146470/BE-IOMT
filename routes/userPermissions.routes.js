import express from 'express';
import {
    getUserPermissions,
    grantPermissionToUser,
    revokePermissionFromUser,
    bulkUpdateUserPermissions,
    getUserPermissionOverrides,
    checkUserPermission
} from '../controllers/permission/userPermissions.controller.js';

// Import auth middleware
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * 🚀 User Permissions Routes
 * 
 * These routes handle individual user permission grants/revokes
 * using the user_permissions table for overrides.
 * 
 * Logic:
 * - is_active = true: GRANT additional permission to user
 * - is_active = false: REVOKE permission from user (even if in role)
 * - Time-based permissions supported (valid_from/valid_until)
 */

// ====================================================================
// PERMISSION QUERY ROUTES
// ====================================================================

/**
 * Get user's effective permissions
 * GET /user-permissions/:userId
 * Query: ?detailed=true&include_overrides=true
 * 
 * Returns combined permissions from roles + user overrides
 * Response: { permissions: ["code1", "code2"], permission_overrides: [...] }
 */
router.get('/:userId', authMiddleware, getUserPermissions);

/**
 * Check if user has specific permission
 * GET /user-permissions/:userId/check/:permissionCode
 * 
 * Returns: { has_permission: boolean }
 */
router.get('/:userId/check/:permissionCode', authMiddleware, checkUserPermission);

/**
 * Get user's permission overrides (grant/revoke history)
 * GET /user-permissions/:userId/overrides
 * Query: ?active_only=true&limit=10&offset=0
 * 
 * Returns: { overrides: [...], pagination: {...} }
 */
router.get('/:userId/overrides', authMiddleware, getUserPermissionOverrides);

// ====================================================================
// PERMISSION MANAGEMENT ROUTES
// ====================================================================

/**
 * Grant additional permission to user
 * POST /user-permissions/:userId/grant
 * Body: {
 *   permission_code: "device.delete",
 *   valid_until: "2025-12-31T23:59:59Z", // optional
 *   notes: "Temporary permission for project"
 * }
 * 
 * Creates user_permissions record with is_active = true
 */
router.post('/:userId/grant', authMiddleware, grantPermissionToUser);

/**
 * Revoke permission from user
 * POST /user-permissions/:userId/revoke
 * Body: {
 *   permission_code: "device.delete",
 *   notes: "Security violation - access revoked"
 * }
 * 
 * Creates/updates user_permissions record with is_active = false
 */
router.post('/:userId/revoke', authMiddleware, revokePermissionFromUser);

/**
 * Bulk grant/revoke permissions
 * POST /user-permissions/:userId/bulk
 * Body: {
 *   grants: ["device.create", "device.edit"],
 *   revokes: ["device.delete"],
 *   notes: "Updated permissions for project role change"
 * }
 */
router.post('/:userId/bulk', authMiddleware, bulkUpdateUserPermissions);

// ====================================================================
// EXAMPLES AND DOCUMENTATION
// ====================================================================

/**
 * 📚 API Usage Examples:
 * 
 * 1. Grant temporary admin permission:
 * POST /user-permissions/user-123/grant
 * {
 *   "permission_code": "admin.full_access",
 *   "valid_until": "2025-12-31T23:59:59Z",
 *   "notes": "Temporary admin access while CTO is on leave"
 * }
 * 
 * 2. Revoke delete permission (even if user has it from role):
 * POST /user-permissions/user-123/revoke
 * {
 *   "permission_code": "device.delete",
 *   "notes": "Security violation - remove delete access"
 * }
 * 
 * 3. Bulk update for role change:
 * POST /user-permissions/user-123/bulk
 * {
 *   "grants": ["project.manage", "budget.approve"],
 *   "revokes": ["device.delete"],
 *   "notes": "Promoted to Project Manager - updated permissions"
 * }
 * 
 * 4. Check permission:
 * GET /user-permissions/user-123/check/device.delete
 * Response: { "has_permission": false }
 * 
 * 5. Get all effective permissions:
 * GET /user-permissions/user-123?detailed=true&include_overrides=true
 * Response: {
 *   "permissions": [...],
 *   "permission_overrides": [
 *     { "action": "granted", "permission": "...", "valid_until": "..." },
 *     { "action": "revoked", "permission": "...", "notes": "..." }
 *   ]
 * }
 */

export default router;