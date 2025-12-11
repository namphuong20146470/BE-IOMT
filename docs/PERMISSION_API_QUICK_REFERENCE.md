# 🎯 Permission Management - API Quick Reference

## 📋 **Luồng UI/UX - Gán quyền cho Role**

### **Step 1: Hiển thị danh sách Permission Groups**

```http
GET /api/v1/permission-groups?include_permissions=false
```

**UI:** Grid của cards hiển thị các nhóm quyền

```json
{
  "data": [
    {
      "id": "55555555-5555-5555-5555-555555555555",
      "name": "Quản lý thiết bị",
      "color": "#FF9800",
      "icon": "devices",
      "permission_count": 9
    }
  ]
}
```

---

### **Step 2: Load quyền hiện tại của Role (grouped)**

```http
GET /api/v1/roles/:roleId/permissions?grouped=true
```

**UI:** Hiển thị badge số lượng trên mỗi group card

```json
{
  "data": {
    "total_permissions": 15,
    "grouped_permissions": {
      "55555555-...": {
        "group_name": "Quản lý thiết bị",
        "total_in_group": 9,
        "assigned_count": 5,
        "all_assigned": false,
        "permissions": [...]
      }
    }
  }
}
```

**Badge Display:**
- `5/9` - 5 đã chọn / 9 tổng số
- ✅ Green: `all_assigned: true`
- ⚠️ Orange: `assigned_count > 0 && !all_assigned`
- ⭕ Gray: `assigned_count === 0`

---

### **Step 3: Click vào Group → Xem chi tiết**

```http
GET /api/v1/permission-groups/:groupId?include_permissions=true
```

**UI:** Modal/Panel hiển thị checkboxes cho từng permission

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Quản lý thiết bị",
    "permissions": [
      {
        "id": "perm-1",
        "name": "device.manage",
        "description": "Manage all device operations",
        "priority": 100
      },
      {
        "id": "perm-2",
        "name": "device.create",
        "description": "Create new devices",
        "priority": 90
      }
    ]
  }
}
```

**UI State:**
```jsx
// Merge role's current permissions với group detail
const rolePerms = groupedPermissions['55555555-...'].permissions;
const allPerms = groupDetail.permissions;

allPerms.forEach(perm => {
  perm.checked = rolePerms.some(rp => rp.id === perm.id);
});
```

---

### **Step 4a: Gán toàn bộ nhóm (Click "Chọn tất cả")**

```http
POST /api/v1/roles/:roleId/permissions/bulk
Content-Type: application/json

{
  "group_id": "55555555-5555-5555-5555-555555555555"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned 9 permissions to role",
  "data": {
    "assigned_count": 9,
    "permissions": [
      "device.manage",
      "device.create",
      "device.read",
      "device.update",
      "device.delete",
      "device.list",
      "device.monitor",
      "device.configure",
      "device.calibrate"
    ]
  }
}
```

---

### **Step 4b: Gán từng quyền được chọn**

```http
POST /api/v1/roles/:roleId/permissions/bulk
Content-Type: application/json

{
  "permission_ids": [
    "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
    "165cdf8c-d7fd-4d37-b55e-def97de15f0e"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned 2 permissions to role",
  "data": {
    "assigned_count": 2,
    "permissions": [
      "device.create",
      "device.read"
    ]
  }
}
```

---

### **Step 5a: Gỡ toàn bộ nhóm**

```http
DELETE /api/v1/roles/:roleId/permissions/bulk
Content-Type: application/json

{
  "group_id": "55555555-5555-5555-5555-555555555555"
}
```

---

### **Step 5b: Gỡ từng quyền được chọn**

```http
DELETE /api/v1/roles/:roleId/permissions/bulk
Content-Type: application/json

{
  "permission_ids": [
    "cc89f68c-f037-4206-a32c-9def2f7f8ae5"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 1 permissions from role",
  "data": {
    "removed_count": 1,
    "remaining_permissions": 14
  }
}
```

---

## 🚀 **Complete Flow Example**

### **Scenario:** Gán quyền "Quản lý thiết bị" cho role "Technician"

```javascript
// 1. Load permission groups
const groups = await fetch('/api/v1/permission-groups');
// Display: Grid of 12 permission group cards

// 2. Load role's current permissions (grouped)
const rolePerms = await fetch('/api/v1/roles/tech-role-id/permissions?grouped=true');
// Display: Badge "5/9" on "Quản lý thiết bị" card

// 3. User clicks "Quản lý thiết bị" card
const groupDetail = await fetch('/api/v1/permission-groups/55555555-5555-5555-5555-555555555555?include_permissions=true');
// Display: Modal with 9 checkboxes (5 checked, 4 unchecked)

// 4. User unchecks "device.delete" and "device.configure"
const unchecked = ['perm-delete-id', 'perm-config-id'];
await fetch('/api/v1/roles/tech-role-id/permissions/bulk', {
  method: 'DELETE',
  body: JSON.stringify({ permission_ids: unchecked })
});
// Result: Now 3/9 permissions assigned

// 5. User checks "device.monitor"
const checked = ['perm-monitor-id'];
await fetch('/api/v1/roles/tech-role-id/permissions/bulk', {
  method: 'POST',
  body: JSON.stringify({ permission_ids: checked })
});
// Result: Now 4/9 permissions assigned

// 6. User clicks "Chọn tất cả nhóm"
await fetch('/api/v1/roles/tech-role-id/permissions/bulk', {
  method: 'POST',
  body: JSON.stringify({ group_id: '55555555-5555-5555-5555-555555555555' })
});
// Result: Now 9/9 permissions assigned ✅
```

---

## 📊 **UI State Management**

### **Component State**

```typescript
interface PermissionManagerState {
  // Data
  groups: PermissionGroup[];
  rolePermissions: GroupedPermissions;
  selectedGroup: PermissionGroupDetail | null;
  
  // UI State
  selectedPermissionIds: Set<string>;
  pendingChanges: {
    toAdd: string[];
    toRemove: string[];
  };
  
  // Loading
  loading: boolean;
  saving: boolean;
}
```

### **Key Functions**

```typescript
// Initialize
async function loadPermissionManager(roleId: string) {
  const [groups, rolePerms] = await Promise.all([
    fetchGroups(),
    fetchRolePermissions(roleId, { grouped: true })
  ]);
  
  return { groups, rolePerms };
}

// Handle group click
async function handleGroupClick(groupId: string) {
  const detail = await fetchGroupDetail(groupId);
  const rolePerms = rolePermissions.grouped_permissions[groupId];
  
  // Mark checked permissions
  detail.permissions.forEach(perm => {
    perm.checked = rolePerms.permissions.some(rp => rp.id === perm.id);
  });
  
  setSelectedGroup(detail);
}

// Handle "Select All Group" checkbox
async function handleToggleAllGroup(groupId: string) {
  const group = rolePermissions.grouped_permissions[groupId];
  
  if (group.all_assigned) {
    // Remove all
    await bulkRemovePermissions(roleId, { group_id: groupId });
  } else {
    // Add all
    await bulkAssignPermissions(roleId, { group_id: groupId });
  }
  
  // Reload
  await reloadRolePermissions(roleId);
}

// Handle individual permission checkbox
function handleTogglePermission(permissionId: string) {
  if (selectedPermissionIds.has(permissionId)) {
    pendingChanges.toRemove.push(permissionId);
    selectedPermissionIds.delete(permissionId);
  } else {
    pendingChanges.toAdd.push(permissionId);
    selectedPermissionIds.add(permissionId);
  }
}

// Save changes
async function handleSave() {
  const { toAdd, toRemove } = pendingChanges;
  
  if (toAdd.length > 0) {
    await bulkAssignPermissions(roleId, { permission_ids: toAdd });
  }
  
  if (toRemove.length > 0) {
    await bulkRemovePermissions(roleId, { permission_ids: toRemove });
  }
  
  // Reset
  pendingChanges = { toAdd: [], toRemove: [] };
  await reloadRolePermissions(roleId);
}
```

---

## 🎨 **Visual Indicators**

### **Group Card Badges**

```jsx
function GroupCard({ group, rolePerms }) {
  const assigned = rolePerms.grouped_permissions[group.id]?.assigned_count || 0;
  const total = group.permission_count;
  
  let badgeColor, icon;
  
  if (assigned === 0) {
    badgeColor = 'gray';
    icon = '⭕';
  } else if (assigned === total) {
    badgeColor = 'green';
    icon = '✅';
  } else {
    badgeColor = 'orange';
    icon = '⚠️';
  }
  
  return (
    <Card style={{ borderLeft: `4px solid ${group.color}` }}>
      <Icon name={group.icon} />
      <Title>{group.name}</Title>
      <Badge color={badgeColor}>
        {icon} {assigned}/{total}
      </Badge>
    </Card>
  );
}
```

### **Permission List with Checkboxes**

```jsx
function PermissionList({ permissions, rolePerms }) {
  const rolePermIds = new Set(rolePerms.permissions.map(p => p.id));
  
  return (
    <div>
      <Checkbox 
        indeterminate={rolePerms.assigned_count > 0 && !rolePerms.all_assigned}
        checked={rolePerms.all_assigned}
        onChange={handleToggleAllGroup}
        label={`Chọn tất cả nhóm (${rolePerms.total_in_group} quyền)`}
      />
      
      <Divider />
      
      {permissions.map(perm => (
        <PermissionRow key={perm.id}>
          <Checkbox 
            checked={rolePermIds.has(perm.id)}
            onChange={() => handleToggle(perm.id)}
          />
          <Info>
            <Name>{perm.description}</Name>
            <Code>{perm.name}</Code>
            <PriorityBadge level={perm.priority} />
          </Info>
        </PermissionRow>
      ))}
    </div>
  );
}
```

---

## ✅ **Validation & Error Handling**

### **Frontend Validation**

```typescript
// Before bulk assign
if (permissionIds.length === 0 && !groupId) {
  throw new Error('Chọn ít nhất 1 quyền hoặc 1 nhóm');
}

// Before bulk remove
if (permissionIds.length === 0 && !groupId) {
  throw new Error('Chọn ít nhất 1 quyền để gỡ');
}
```

### **Backend Error Responses**

```json
// 400 Bad Request
{
  "success": false,
  "message": "Either group_id or permission_ids must be provided"
}

// 404 Not Found
{
  "success": false,
  "message": "Permission group not found"
}

// 403 Forbidden
{
  "success": false,
  "message": "Only system admin can modify system role permissions"
}
```

---

## 📱 **Responsive Design Tips**

### **Desktop (> 1024px)**
- Grid: 3 columns for permission groups
- Modal: Full detail view with all permissions

### **Tablet (768px - 1024px)**
- Grid: 2 columns
- Modal: Scrollable list

### **Mobile (< 768px)**
- Stack: 1 column
- Bottom sheet: Swipe up for details
- Search: Essential for finding permissions

---

## 🔗 **API Endpoints Summary**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/permission-groups` | List groups |
| GET | `/api/v1/permission-groups/:id` | Group detail |
| GET | `/api/v1/roles/:id/permissions?grouped=true` | Role perms (grouped) |
| POST | `/api/v1/roles/:id/permissions/bulk` | Assign perms |
| DELETE | `/api/v1/roles/:id/permissions/bulk` | Remove perms |

---

## 🎯 **Performance Tips**

1. **Cache permission groups** - Rarely change
2. **Debounce checkbox changes** - Wait 300ms before API call
3. **Batch updates** - Collect all changes, send once on Save
4. **Optimistic UI** - Update UI immediately, rollback on error
5. **Pagination** - For roles with 50+ permissions

---

## 🚀 **Ready to Use!**

All endpoints are now implemented and ready for frontend integration. Server restart automatically picks up new routes.
