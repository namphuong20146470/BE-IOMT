# Permission Hiding System - Architecture

## 📋 Overview
System để ẩn các permissions nhạy cảm (như `system.admin`) khỏi UI và API assignment.

## 🏗️ Architecture Pattern

### ✅ Đúng Pattern: Separation of Concerns

```
┌─────────────────────────────────────────┐
│  Constants Layer                         │
│  - HIDDEN_PERMISSIONS                    │
│  - Helper functions                      │
│  - Single source of truth                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Service Layer (Business Logic)          │
│  - Filter permissions using helpers      │
│  - Validate assignments                  │
│  - Apply business rules                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Repository Layer (Data Access)          │
│  - Return raw data from DB               │
│  - No business logic                     │
│  - Pure data operations                  │
└──────────────────────────────────────────┘
```

## 📁 File Structure

```
shared/
  constants/
    permissions.constants.js   ← Single source of truth
    
features/
  permissions/
    permission.service.js      ← Apply filters here
    permission.repository.js   ← Returns raw data
    
  roles/
    role.service.js           ← Validate assignments here
```

## 🔧 Usage Examples

### 1. Filter Permissions in Service

```javascript
import { filterHiddenPermissions } from '../../shared/constants/permissions.constants.js';

class PermissionService {
  async getAllPermissions() {
    const rawPermissions = await repository.findAll();
    
    // ✅ Filter at service layer
    return filterHiddenPermissions(rawPermissions);
  }
}
```

### 2. Validate Assignment

```javascript
import { validatePermissionAssignment } from '../../shared/constants/permissions.constants.js';

class RoleService {
  async assignPermission(roleId, permissionName) {
    // ✅ Validate before assigning
    validatePermissionAssignment(permissionName); // Throws if hidden
    
    await repository.assign(roleId, permissionName);
  }
}
```

### 3. Check Individual Permission

```javascript
import { isHiddenPermission } from '../../shared/constants/permissions.constants.js';

if (isHiddenPermission('system.admin')) {
  // Handle hidden permission
}
```

## 🎯 Benefits

### ✅ Single Source of Truth
- All hidden permissions defined in ONE place
- Easy to add/remove hidden permissions
- Consistent across entire application

### ✅ Maintainability
- Change logic once, applies everywhere
- No scattered hard-coded values
- Easy to test

### ✅ Separation of Concerns
- Repository = Pure data access
- Service = Business logic
- Constants = Configuration

### ✅ Flexibility
- Easy to extend (e.g., role-based visibility)
- Can add permission levels
- Future-proof architecture

## 🔐 Security Features

1. **UI Filtering**: Hidden permissions don't appear in lists
2. **Assignment Validation**: Cannot assign via API
3. **Centralized Control**: Single point to manage restrictions
4. **Type Safety**: Helper functions prevent typos

## 🚀 Adding New Hidden Permission

```javascript
// shared/constants/permissions.constants.js
export const HIDDEN_PERMISSIONS = [
    'system.admin',
    'system.root',      // ← Just add here
    'system.debug'      // ← And here
];
```

That's it! No need to modify 6+ files.

## ❌ Anti-Patterns (What NOT to do)

### Don't: Hard-code in Repository
```javascript
// ❌ BAD
where: {
  name: { not: 'system.admin' }  // Hard-coded, repeated
}
```

### Don't: Scatter Logic
```javascript
// ❌ BAD - Logic in multiple places
if (perm.name !== 'system.admin') { ... }  // File 1
if (perm.name !== 'system.admin') { ... }  // File 2
if (perm.name !== 'system.admin') { ... }  // File 3
```

### Don't: Mix Concerns
```javascript
// ❌ BAD - Business logic in repository
repository.findAssignablePermissions() {
  // Repository shouldn't know business rules
}
```

## 🧪 Testing

```javascript
import { isHiddenPermission, filterHiddenPermissions } from './permissions.constants';

describe('Permission Filtering', () => {
  test('should identify hidden permissions', () => {
    expect(isHiddenPermission('system.admin')).toBe(true);
    expect(isHiddenPermission('user.read')).toBe(false);
  });
  
  test('should filter out hidden permissions', () => {
    const perms = [
      { name: 'user.read' },
      { name: 'system.admin' },
      { name: 'device.read' }
    ];
    
    const filtered = filterHiddenPermissions(perms);
    expect(filtered).toHaveLength(2);
    expect(filtered.find(p => p.name === 'system.admin')).toBeUndefined();
  });
});
```

## 🔮 Future Enhancements

### Option 1: Database Flag (Recommended)
```sql
ALTER TABLE permissions 
ADD COLUMN is_assignable BOOLEAN DEFAULT true;

UPDATE permissions 
SET is_assignable = false 
WHERE name = 'system.admin';
```

Then update constants to check DB flag.

### Option 2: Role-Based Visibility
```javascript
export const getVisiblePermissions = (permissions, userRole) => {
  if (userRole === 'SUPER_ADMIN') {
    return permissions; // See all
  }
  
  return filterHiddenPermissions(permissions);
};
```

### Option 3: Permission Levels
```javascript
export const PERMISSION_LEVELS = {
  SYSTEM: 100,
  ADMIN: 50,
  USER: 10
};

export const filterByLevel = (permissions, userLevel) => {
  return permissions.filter(p => p.level <= userLevel);
};
```

## 📚 References

- **DRY Principle**: Don't Repeat Yourself
- **SoC**: Separation of Concerns
- **Single Responsibility**: Each layer has one job
- **SOLID Principles**: Open/Closed, Dependency Inversion

---

**Author**: Refactored Architecture
**Date**: 2025-12-19
**Pattern**: Constants → Service → Repository
