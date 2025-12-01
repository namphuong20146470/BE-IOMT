# Device Visibility System - Frontend Documentation

## 📋 Tổng quan

Hệ thống **Device Visibility** cho phép kiểm soát ai có thể xem thiết bị trong organization. Có 3 mức độ visibility:

- **🌍 Public**: Hiển thị cho toàn organization
- **🏢 Department**: Chỉ hiển thị cho department được gán
- **🔒 Private**: Chỉ Admin/Manager thấy được

## 🎯 Business Logic

### Visibility Rules

| Visibility | Department ID | Ai thấy được |
|-----------|---------------|-------------|
| `public` | `null` hoặc có value | Tất cả users trong org |
| `department` | **Bắt buộc có** | Chỉ users trong department đó |
| `private` | `null` hoặc có value | Chỉ Admin/Manager |

### Auto-Assignment khi tạo thiết bị

```javascript
// Logic tự động
if (department_id) {
    visibility = 'department'  // Có department → department visibility
} else {
    visibility = 'private'     // Không có department → private
}
```

## 🔌 API Endpoints

### 1. Lấy danh sách thiết bị (có visibility filtering)

```http
GET /api/devices
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "serial_number": "12345",
            "visibility": "public",
            "visibility_scope": "Organization-wide",
            "department_name": "Emergency Department",
            // ... other fields
        }
    ]
}
```

**Visibility Scope Values:**
- `"Organization-wide"` → Public device
- `"Emergency Department only"` → Department device
- `"Private access"` → Private device
- `"Unassigned department"` → Department visibility nhưng chưa gán dept

### 2. Thay đổi visibility

```http
PUT /api/devices/:id/visibility
```

**Request Body:**
```json
{
    "visibility": "public" | "department" | "private"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "visibility": "public",
        "updated_at": "2025-11-18T10:30:00Z"
    },
    "message": "Device visibility updated successfully"
}
```

### 3. Lấy thiết bị theo visibility

```http
GET /api/devices/visibility/:visibility
```

**Parameters:**
- `:visibility` → `public` | `department` | `private` | `all`

**Query Parameters:**
```
?organization_id=uuid    # Optional (System Admin only)
?department_id=uuid      # Optional
?page=1                  # Optional
?limit=50               # Optional
```

## 🛡️ Permission System

### Quyền xem thiết bị

| User Role | Public | Department | Private |
|-----------|--------|------------|---------|
| **System Admin** | ✅ All | ✅ All | ✅ All |
| **Organization Admin** | ✅ All | ✅ All | ✅ All |
| **Device Manager** | ✅ All | ✅ All | ✅ All |
| **Department Manager** | ✅ All | ✅ All | ✅ All |
| **Regular User** | ✅ All | ✅ Own dept only | ❌ None |

### Quyền thay đổi visibility

```javascript
// Permissions required for each visibility level
{
    "public": ["device.manage", "organization.admin", "system.admin"],
    "department": ["device.create", "department.manage", "organization.admin"],
    "private": ["device.create", "department.manage", "organization.admin"]
}
```

## 💻 Frontend Implementation Guide

### 1. Device List Component

```typescript
interface Device {
    id: string;
    serial_number: string;
    visibility: 'public' | 'department' | 'private';
    visibility_scope: string;
    department_name?: string;
    // ... other fields
}

// API call
const fetchDevices = async (filters = {}) => {
    const response = await fetch('/api/devices?' + new URLSearchParams(filters));
    return response.json();
};
```

### 2. Visibility Badge Component

```tsx
const VisibilityBadge = ({ visibility, scope }: { 
    visibility: Device['visibility'], 
    scope: string 
}) => {
    const config = {
        public: { color: 'green', icon: '🌍', label: 'Public' },
        department: { color: 'blue', icon: '🏢', label: 'Department' },
        private: { color: 'red', icon: '🔒', label: 'Private' }
    };
    
    const { color, icon, label } = config[visibility];
    
    return (
        <Badge color={color} title={scope}>
            {icon} {label}
        </Badge>
    );
};
```

### 3. Visibility Change Modal

```tsx
const ChangeVisibilityModal = ({ device, onUpdate }: {
    device: Device;
    onUpdate: (device: Device) => void;
}) => {
    const [visibility, setVisibility] = useState(device.visibility);
    
    const handleUpdate = async () => {
        const response = await fetch(`/api/devices/${device.id}/visibility`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility })
        });
        
        if (response.ok) {
            const updated = await response.json();
            onUpdate({ ...device, ...updated.data });
        }
    };
    
    // Show warning for department visibility without department
    const showDepartmentWarning = visibility === 'department' && !device.department_id;
    
    return (
        <Modal>
            <RadioGroup value={visibility} onChange={setVisibility}>
                <Radio value="public">🌍 Public - Organization-wide</Radio>
                <Radio value="department">🏢 Department - Restricted access</Radio>
                <Radio value="private">🔒 Private - Admin only</Radio>
            </RadioGroup>
            
            {showDepartmentWarning && (
                <Alert type="warning">
                    Device must be assigned to a department first
                </Alert>
            )}
            
            <Button onClick={handleUpdate} disabled={showDepartmentWarning}>
                Update Visibility
            </Button>
        </Modal>
    );
};
```

### 4. Permission-Based UI

```tsx
const DeviceActions = ({ device, user }: {
    device: Device;
    user: User;
}) => {
    const canChangeVisibility = hasPermission(user, [
        'device.manage', 
        'organization.admin', 
        'system.admin'
    ]);
    
    const canSetPublic = hasPermission(user, [
        'device.manage',
        'organization.admin', 
        'system.admin'
    ]);
    
    return (
        <Menu>
            {canChangeVisibility && (
                <MenuItem onClick={() => openVisibilityModal(device)}>
                    Change Visibility
                </MenuItem>
            )}
        </Menu>
    );
};
```

## 🎨 UI/UX Guidelines

### Visibility Indicators

```css
/* Visibility badge colors */
.visibility-public { 
    background: #10B981; /* Green */
    color: white;
}

.visibility-department { 
    background: #3B82F6; /* Blue */
    color: white;
}

.visibility-private { 
    background: #EF4444; /* Red */
    color: white;
}
```

### Filter Component

```tsx
const VisibilityFilter = ({ onChange }: { onChange: (visibility: string) => void }) => {
    return (
        <Select placeholder="Filter by visibility" onChange={onChange}>
            <Option value="">All devices</Option>
            <Option value="public">🌍 Public only</Option>
            <Option value="department">🏢 Department only</Option>
            <Option value="private">🔒 Private only</Option>
        </Select>
    );
};
```

## 📱 Mobile Considerations

### Responsive Visibility Badges

```tsx
const MobileVisibilityBadge = ({ device }: { device: Device }) => {
    // On mobile, show icon only with tooltip
    const isMobile = useIsMobile();
    
    if (isMobile) {
        return (
            <Tooltip title={device.visibility_scope}>
                <span className={`visibility-${device.visibility}`}>
                    {getVisibilityIcon(device.visibility)}
                </span>
            </Tooltip>
        );
    }
    
    return <VisibilityBadge {...device} />;
};
```

## ⚠️ Error Handling

### Common Error Scenarios

```typescript
const handleVisibilityError = (error: ApiError) => {
    switch (error.code) {
        case 'PRIVATE_DEVICES_ACCESS_DENIED':
            showError('You do not have permission to view private devices');
            break;
            
        case 'DEPARTMENT_ASSIGNMENT_REQUIRED':
            showWarning('Device must be assigned to a department first');
            break;
            
        case 'INVALID_VISIBILITY':
            showError('Invalid visibility value selected');
            break;
            
        default:
            showError('Failed to update device visibility');
    }
};
```

## 🧪 Testing Scenarios

### Test Cases for FE

1. **Regular User**:
   - ✅ Thấy public devices từ toàn org
   - ✅ Thấy department devices của mình
   - ❌ Không thấy private devices
   - ❌ Không thấy department devices khác

2. **Department Manager**:
   - ✅ Thấy tất cả devices (public, department, private)
   - ✅ Có thể thay đổi visibility

3. **Visibility Changes**:
   - ✅ Department → Public: Success
   - ✅ Public → Private: Success  
   - ❌ Unassigned device → Department: Error

4. **Filter & Search**:
   - ✅ Filter by visibility works
   - ✅ Search respects visibility rules
   - ✅ Pagination works với visibility filtering

## 📞 API Response Examples

### Device List Response
```json
{
    "success": true,
    "data": [
        {
            "id": "device-1",
            "serial_number": "12345",
            "visibility": "public",
            "visibility_scope": "Organization-wide",
            "department_id": null,
            "department_name": null
        },
        {
            "id": "device-2", 
            "serial_number": "67890",
            "visibility": "department",
            "visibility_scope": "Emergency Department only",
            "department_id": "dept-1",
            "department_name": "Emergency Department"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 50,
        "total": 2,
        "pages": 1
    }
}
```

### Error Responses
```json
// Permission denied for private devices
{
    "success": false,
    "message": "Permission denied: Cannot view private devices",
    "code": "PRIVATE_DEVICES_ACCESS_DENIED"
}

// Invalid visibility change
{
    "success": false,
    "message": "Cannot set department visibility for device without department assignment",
    "hint": "Assign device to a department first, or use public/private visibility"
}
```

---

## 🚀 Quick Start Checklist

- [ ] Implement `VisibilityBadge` component
- [ ] Add visibility filter to device list
- [ ] Create visibility change modal
- [ ] Handle permission-based UI rendering  
- [ ] Add error handling for visibility operations
- [ ] Test with different user roles
- [ ] Implement mobile-responsive design

**Questions?** Contact Backend team về API details hoặc Business team về visibility rules!