# 🎨 Permission Management UI/UX Workflow

## 📋 Luồng gán quyền cho Role

### **Step 1: Lấy danh sách Permission Groups**

```http
GET /api/v1/permission-groups?include_permissions=false
```

**Purpose:** Hiển thị danh sách nhóm quyền với số lượng permissions trong mỗi nhóm.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Quản trị hệ thống",
      "description": "Các quyền quản trị và cấu hình hệ thống cốt lõi",
      "color": "#FF5722",
      "icon": "shield-check",
      "permission_count": 8,
      "is_active": true
    },
    {
      "id": "55555555-5555-5555-5555-555555555555",
      "name": "Quản lý thiết bị",
      "description": "Quản lý thiết bị, models và cấu hình thiết bị",
      "color": "#FF9800",
      "icon": "devices",
      "permission_count": 9,
      "is_active": true
    }
  ]
}
```

**UI Component:**
```jsx
<PermissionGroupList>
  {groups.map(group => (
    <GroupCard 
      key={group.id}
      color={group.color}
      icon={group.icon}
      title={group.name}
      count={group.permission_count}
      onClick={() => selectGroup(group.id)}
    />
  ))}
</PermissionGroupList>
```

---

### **Step 2: Xem chi tiết quyền trong nhóm đã chọn**

```http
GET /api/v1/permission-groups/:groupId?include_permissions=true
```

**Purpose:** Khi user click vào 1 group, load danh sách permissions trong group đó.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Quản lý thiết bị",
    "description": "Quản lý thiết bị, models và cấu hình thiết bị",
    "color": "#FF9800",
    "icon": "devices",
    "permission_count": 9,
    "permissions": [
      {
        "id": "176e1c64-f927-44c6-ae32-9f60bd472396",
        "name": "device.manage",
        "description": "Manage all device operations",
        "resource": "device",
        "action": "manage",
        "priority": 100
      },
      {
        "id": "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
        "name": "device.create",
        "description": "Create new devices",
        "resource": "device",
        "action": "create",
        "priority": 90
      },
      {
        "id": "165cdf8c-d7fd-4d37-b55e-def97de15f0e",
        "name": "device.read",
        "description": "View device information",
        "resource": "device",
        "action": "read",
        "priority": 80
      }
    ]
  }
}
```

**UI Component:**
```jsx
<PermissionGroupDetail group={selectedGroup}>
  <GroupHeader color={group.color}>
    <Icon name={group.icon} />
    <Title>{group.name}</Title>
    <Badge>{group.permission_count} quyền</Badge>
  </GroupHeader>
  
  <PermissionList>
    <Checkbox 
      label="Chọn tất cả nhóm" 
      onChange={handleSelectAllGroup}
    />
    <Divider />
    
    {group.permissions.map(perm => (
      <PermissionItem key={perm.id}>
        <Checkbox 
          value={selectedPermissions.includes(perm.id)}
          onChange={() => togglePermission(perm.id)}
        />
        <PermissionInfo>
          <Name>{perm.description}</Name>
          <Code>{perm.name}</Code>
          <Priority level={perm.priority} />
        </PermissionInfo>
      </PermissionItem>
    ))}
  </PermissionList>
</PermissionGroupDetail>
```

---

### **Step 3a: Gán toàn bộ nhóm quyền cho Role**

```http
POST /api/v1/roles/:roleId/permissions/bulk
```

**Request Body:**
```json
{
  "group_id": "55555555-5555-5555-5555-555555555555",
  "assign_all": true
}
```

**Purpose:** User click "Chọn tất cả nhóm" → Gán tất cả 9 permissions của nhóm "Quản lý thiết bị" cho role.

**Response:**
```json
{
  "success": true,
  "message": "Assigned 9 permissions from group 'Quản lý thiết bị' to role",
  "data": {
    "role_id": "role-uuid",
    "group_id": "55555555-5555-5555-5555-555555555555",
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

### **Step 3b: Gán một số quyền được chọn trong nhóm**

```http
POST /api/v1/roles/:roleId/permissions/bulk
```

**Request Body:**
```json
{
  "permission_ids": [
    "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
    "165cdf8c-d7fd-4d37-b55e-def97de15f0e",
    "05c02cb9-20de-4f13-9d2a-7d8aae805464"
  ]
}
```

**Purpose:** User chọn từng quyền riêng lẻ (ví dụ: device.create, device.read, device.update) → Gán chỉ 3 permissions này cho role.

**Response:**
```json
{
  "success": true,
  "message": "Assigned 3 permissions to role",
  "data": {
    "role_id": "role-uuid",
    "assigned_count": 3,
    "permissions": [
      "device.create",
      "device.read",
      "device.update"
    ]
  }
}
```

---

### **Step 4: Lấy quyền hiện tại của Role (để hiển thị UI checked)**

```http
GET /api/v1/roles/:roleId/permissions?grouped=true
```

**Purpose:** Khi mở modal/page gán quyền, cần biết role hiện tại đã có quyền gì để:
- Tick checkbox các quyền đã có
- Hiển thị số lượng quyền đã chọn trong mỗi group

**Response:**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "role-uuid",
      "name": "Technician",
      "description": "Technical staff role"
    },
    "total_permissions": 15,
    "grouped_permissions": {
      "11111111-1111-1111-1111-111111111111": {
        "group_name": "Quản trị hệ thống",
        "group_color": "#FF5722",
        "group_icon": "shield-check",
        "total_in_group": 8,
        "assigned_count": 0,
        "permissions": []
      },
      "55555555-5555-5555-5555-555555555555": {
        "group_name": "Quản lý thiết bị",
        "group_color": "#FF9800",
        "group_icon": "devices",
        "total_in_group": 9,
        "assigned_count": 5,
        "permissions": [
          {
            "id": "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
            "name": "device.create",
            "description": "Create new devices"
          },
          {
            "id": "165cdf8c-d7fd-4d37-b55e-def97de15f0e",
            "name": "device.read",
            "description": "View device information"
          }
        ]
      },
      "cccccccc-cccc-cccc-cccc-cccccccccccc": {
        "group_name": "Quản lý Bảo trì",
        "group_color": "#673AB7",
        "group_icon": "tools",
        "total_in_group": 4,
        "assigned_count": 4,
        "all_assigned": true,
        "permissions": [
          {
            "id": "perm-1",
            "name": "maintenance.create",
            "description": "Create maintenance logs"
          },
          {
            "id": "perm-2",
            "name": "maintenance.read",
            "description": "View maintenance logs"
          },
          {
            "id": "perm-3",
            "name": "maintenance.update",
            "description": "Update maintenance logs"
          },
          {
            "id": "perm-4",
            "name": "maintenance.delete",
            "description": "Delete maintenance logs"
          }
        ]
      }
    }
  }
}
```

**UI State Management:**
```jsx
// Khi load role permissions
const rolePerms = await getRolePermissions(roleId, { grouped: true });

// Set initial state cho checkboxes
const initialSelected = rolePerms.grouped_permissions
  .flatMap(group => group.permissions.map(p => p.id));

setSelectedPermissions(initialSelected);

// Hiển thị badge số lượng
<GroupCard>
  <Badge>{group.assigned_count} / {group.total_in_group}</Badge>
  {group.all_assigned && <Icon name="check-circle" color="green" />}
</GroupCard>
```

---

### **Step 5: Gỡ quyền khỏi Role**

```http
DELETE /api/v1/roles/:roleId/permissions/bulk
```

**Request Body:**
```json
{
  "permission_ids": [
    "cc89f68c-f037-4206-a32c-9def2f7f8ae5",
    "165cdf8c-d7fd-4d37-b55e-def97de15f0e"
  ]
}
```

**Or remove entire group:**
```json
{
  "group_id": "55555555-5555-5555-5555-555555555555"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 2 permissions from role",
  "data": {
    "role_id": "role-uuid",
    "removed_count": 2,
    "remaining_permissions": 13
  }
}
```

---

## 🎯 Complete UI/UX Flow

### **Màn hình chính: Role Permission Assignment**

```
┌─────────────────────────────────────────────────────────────┐
│  Gán quyền cho Role: Technician                     [Save]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 🛡️ Quản trị   │  │ 🏢 Tổ chức    │  │ 👥 Người dùng │      │
│  │ hệ thống      │  │               │  │               │      │
│  │ 0/8 quyền     │  │ 0/13 quyền    │  │ 0/9 quyền     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 📱 Thiết bị   │  │ 🔧 Bảo trì    │  │ 📊 Báo cáo    │      │
│  │ 5/9 quyền ⚠️  │  │ 4/4 quyền ✅  │  │ 0/3 quyền     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### **Click vào nhóm "Thiết bị" → Mở chi tiết:**

```
┌─────────────────────────────────────────────────────────────┐
│  📱 Quản lý thiết bị                              [< Quay lại] │
├─────────────────────────────────────────────────────────────┤
│  Quản lý thiết bị, models và cấu hình thiết bị              │
│                                                               │
│  ☐ Chọn tất cả nhóm (9 quyền)                   5/9 đã chọn │
│  ────────────────────────────────────────────────────────   │
│                                                               │
│  ☑ device.manage      - Quản lý tất cả thiết bị    [Cao]   │
│  ☑ device.create      - Tạo thiết bị mới           [Cao]   │
│  ☑ device.read        - Xem thông tin thiết bị     [TB]    │
│  ☑ device.update      - Cập nhật thiết bị          [TB]    │
│  ☐ device.delete      - Xóa thiết bị               [Cao]   │
│  ☑ device.list        - Danh sách thiết bị         [Thấp]  │
│  ☐ device.monitor     - Giám sát thiết bị          [TB]    │
│  ☐ device.configure   - Cấu hình thiết bị          [Cao]   │
│  ☐ device.calibrate   - Hiệu chuẩn thiết bị        [Cao]   │
│                                                               │
│  [Hủy]                                              [Lưu]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 API Endpoints Summary

### **For Permission Groups UI**
1. `GET /api/v1/permission-groups` - List all groups với count
2. `GET /api/v1/permission-groups/:id?include_permissions=true` - Chi tiết group

### **For Role Permission Management**
3. `GET /api/v1/roles/:roleId/permissions?grouped=true` - Quyền hiện tại (grouped)
4. `POST /api/v1/roles/:roleId/permissions/bulk` - Gán permissions (array hoặc group)
5. `DELETE /api/v1/roles/:roleId/permissions/bulk` - Gỡ permissions

---

## 📡 **Detailed API Specifications**

### **1. GET /api/v1/permission-groups**
Load danh sách permission groups để hiển thị cards.

**Query:** `?include_permissions=false` (chỉ cần count)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Quản lý thiết bị",
      "color": "#FF9800",
      "icon": "devices",
      "permission_count": 9
    }
  ]
}
```

---

### **2. GET /api/v1/permission-groups/:id?include_permissions=true**
Khi user click vào group card, load chi tiết permissions.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Quản lý thiết bị",
    "permission_count": 9,
    "permissions": [
      {
        "id": "perm-uuid",
        "name": "device.create",
        "description": "Create new devices",
        "priority": 90
      }
    ]
  }
}
```

---

### **3. GET /api/v1/roles/:roleId/permissions?grouped=true**
Load quyền hiện tại của role, nhóm theo permission groups.

**NEW FEATURE:** Query parameter `grouped=true` returns permissions organized by groups.

**Response:**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "role-uuid",
      "name": "Technician"
    },
    "total_permissions": 15,
    "grouped_permissions": {
      "55555555-5555-5555-5555-555555555555": {
        "group_name": "Quản lý thiết bị",
        "group_color": "#FF9800",
        "group_icon": "devices",
        "total_in_group": 9,
        "assigned_count": 5,
        "all_assigned": false,
        "permissions": [
          {
            "id": "uuid",
            "name": "device.create",
            "description": "Create new devices"
          }
        ]
      }
    }
  }
}
```

---

### **4. POST /api/v1/roles/:roleId/permissions/bulk**
Gán nhiều permissions hoặc cả group cho role.

**NEW ENDPOINT:** Bulk operation for assigning permissions.

**Option A - Assign entire group:**
```json
{
  "group_id": "55555555-5555-5555-5555-555555555555"
}
```

**Option B - Assign specific permissions:**
```json
{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2",
    "perm-uuid-3"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned 9 permissions to role",
  "data": {
    "role_id": "role-uuid",
    "assigned_count": 9,
    "permissions": [
      "device.manage",
      "device.create",
      "device.read"
    ],
    "group_id": "55555555-5555-5555-5555-555555555555"
  }
}
```

---

### **5. DELETE /api/v1/roles/:roleId/permissions/bulk**
Gỡ nhiều permissions hoặc cả group khỏi role.

**NEW ENDPOINT:** Bulk operation for removing permissions.

**Option A - Remove entire group:**
```json
{
  "group_id": "55555555-5555-5555-5555-555555555555"
}
```

**Option B - Remove specific permissions:**
```json
{
  "permission_ids": [
    "perm-uuid-1",
    "perm-uuid-2"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 2 permissions from role",
  "data": {
    "role_id": "role-uuid",
    "removed_count": 2,
    "remaining_permissions": 13,
    "group_id": "55555555-5555-5555-5555-555555555555"
  }
}
```

---

## 💡 Frontend State Management Example

```typescript
interface PermissionUIState {
  // Step 1: Load groups
  groups: PermissionGroup[];
  selectedGroupId: string | null;
  
  // Step 2: Load group detail
  groupDetail: PermissionGroupDetail | null;
  
  // Step 3: Current selections
  selectedPermissions: Set<string>;
  
  // Step 4: Role's current permissions
  rolePermissions: Map<string, Permission[]>; // grouped by group_id
  
  // UI states
  loading: boolean;
  saving: boolean;
}

// Actions
async function handleSelectGroup(groupId: string) {
  const detail = await fetchGroupDetail(groupId);
  setGroupDetail(detail);
}

async function handleToggleGroup(groupId: string) {
  if (isGroupFullySelected(groupId)) {
    // Remove all from group
    await removeGroupFromRole(roleId, groupId);
  } else {
    // Add all from group
    await assignGroupToRole(roleId, groupId);
  }
}

async function handleSavePermissions() {
  const addedIds = getAddedPermissions();
  const removedIds = getRemovedPermissions();
  
  if (addedIds.length) {
    await assignPermissionsToRole(roleId, addedIds);
  }
  
  if (removedIds.length) {
    await removePermissionsFromRole(roleId, removedIds);
  }
}
```

---

## 📊 Recommended UX Patterns

### **1. Progressive Disclosure**
- Bước 1: Hiển thị groups với số lượng (overview)
- Bước 2: Click group → Hiển thị chi tiết permissions
- Bước 3: Click save → Apply changes

### **2. Visual Feedback**
- ✅ Green check: Tất cả quyền trong group đã được chọn
- ⚠️ Orange warning: Một số quyền được chọn
- ⭕ Gray circle: Chưa chọn quyền nào
- Badge số: `5/9` = 5 đã chọn / 9 tổng số

### **3. Bulk Actions**
- Checkbox "Chọn tất cả nhóm" ở đầu mỗi group
- Indeterminate state khi chọn một phần
- Quick toggle entire group on/off

### **4. Search & Filter**
- Search box: Tìm permission theo tên
- Filter: Theo priority (High/Medium/Low)
- Filter: Theo resource/action

---

## 🎨 Color Coding (Current Groups)

| Color | Group | Usage |
|-------|-------|-------|
| #FF5722 | Quản trị hệ thống | Critical system operations |
| #2196F3 | Quản lý tổ chức | Organization structure |
| #4CAF50 | Quản lý người dùng | User management |
| #9C27B0 | Vai trò & quyền | Role/permission admin |
| #FF9800 | Thiết bị | Device operations |
| #00BCD4 | Dữ liệu | Data management |
| #F44336 | Cảnh báo | Alerts & notifications |
| #673AB7 | Bảo trì | Maintenance operations |

Use these colors for:
- Group card backgrounds (20% opacity)
- Group headers
- Permission badges
- Category icons
