# 🏥 DEVICE MANAGEMENT API ROUTES

## 📋 **OVERVIEW**

Comprehensive REST API endpoints for managing IoMT device ecosystem including categories, models, devices, connectivity, and warranties.

**Base URL:** `/devices`

---

## 🗂️ **DEVICE CATEGORIES**

### **GET /devices/device-categories**
**Description:** Get all device categories in hierarchical structure  
**Permission:** `device.read`  
**Query Parameters:**
- `include_children` (boolean) - Include child categories
- `depth` (number) - Maximum depth level

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-medical-equipment",
      "name": "Medical Equipment",
      "description": "All types of medical equipment",
      "parent_id": null,
      "children": [...]
    }
  ]
}
```

### **GET /devices/device-categories/root**
**Description:** Get root categories only  
**Permission:** Authentication required  

### **GET /devices/device-categories/:parentId/children**
**Description:** Get child categories of specific parent  
**Permission:** Authentication required  
**URL Parameters:**
- `parentId` (string) - Parent category ID

### **GET /devices/device-categories/:id/stats**
**Description:** Get category with device statistics  
**Permission:** `device.read`  
**URL Parameters:**
- `id` (string) - Category ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cat-monitoring",
    "name": "Monitoring Devices",
    "total_models": 5,
    "total_devices": 12,
    "active_devices": 10
  }
}
```

### **POST /devices/device-categories**
**Description:** Create new device category  
**Permission:** `device.manage`  
**Request Body:**
```json
{
  "name": "New Category",
  "description": "Category description",
  "parent_id": "parent-category-id" // optional
}
```

### **PUT /devices/device-categories/:id**
**Description:** Update device category  
**Permission:** `device.manage`  
**Request Body:**
```json
{
  "name": "Updated Category Name",
  "description": "Updated description"
}
```

### **DELETE /devices/device-categories/:id**
**Description:** Delete device category  
**Permission:** `device.manage`  
**Note:** Cannot delete categories with existing models

---

## 🔧 **DEVICE MODELS**

### **GET /devices/device-models**
**Description:** Get all device models with filtering  
**Permission:** `device.read`  
**Query Parameters:**
- `category_id` (string) - Filter by category
- `manufacturer_id` (string) - Filter by manufacturer
- `search` (string) - Search in name/description
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "model-philips-mx800",
      "name": "IntelliVue MX800",
      "manufacturer": {
        "id": "mfg-philips",
        "name": "Philips Healthcare"
      },
      "category": {
        "id": "cat-monitoring",
        "name": "Monitoring Devices"
      },
      "specifications": [...],
      "device_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "pages": 1
  }
}
```

### **GET /devices/device-models/manufacturers**
**Description:** Get list of manufacturers  
**Permission:** Authentication required  

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "mfg-philips",
      "name": "Philips Healthcare",
      "country": "Netherlands",
      "model_count": 5
    }
  ]
}
```

### **GET /devices/device-models/:id**
**Description:** Get device model by ID with full details  
**Permission:** `device.read`  

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "model-philips-mx800",
    "name": "IntelliVue MX800",
    "model_number": "MX800-2024",
    "description": "Advanced patient monitoring system",
    "category": {...},
    "manufacturer": {...},
    "supplier": {...},
    "specifications": [
      {
        "id": "spec-1",
        "value": "19-inch color touchscreen",
        "unit": "inch",
        "specification_fields": {
          "field_name": "display",
          "field_name_vi": "Màn hình",
          "data_type": "text"
        }
      }
    ],
    "devices": [...]
  }
}
```

### **GET /devices/device-models/category/:categoryId**
**Description:** Get device models by category  
**Permission:** `device.read`  

### **POST /devices/device-models**
**Description:** Create new device model  
**Permission:** `device.manage`  
**Request Body:**
```json
{
  "name": "New Model",
  "model_number": "NM-2024",
  "description": "Model description",
  "category_id": "category-id",
  "manufacturer_id": "manufacturer-id",
  "supplier_id": "supplier-id", // optional
  "specifications": [
    {
      "field_id": "field-id",
      "value": "Specification value",
      "unit": "unit",
      "numeric_value": 100 // for numeric fields
    }
  ]
}
```

### **PUT /devices/device-models/:id**
**Description:** Update device model  
**Permission:** `device.manage`  

### **DELETE /devices/device-models/:id**
**Description:** Delete device model  
**Permission:** `device.manage`  
**Note:** Cannot delete models with existing devices

---

## 🔌 **DEVICES**

### **GET /devices/devices**
**Description:** Get all devices with filtering and pagination  
**Permission:** `device.read`  
**Query Parameters:**
- `model_id` (string) - Filter by model
- `organization_id` (string) - Filter by organization
- `department_id` (string) - Filter by department
- `status` (enum) - Filter by status: active, inactive, maintenance, decommissioned
- `search` (string) - Search in serial number, asset tag, location
- `page` (number) - Page number
- `limit` (number) - Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "device-id",
      "serial_number": "PH-MX800-ICU-001",
      "asset_tag": "ICU-MON-001",
      "status": "active",
      "location": "ICU Room 101",
      "model": {
        "name": "IntelliVue MX800",
        "manufacturer": "Philips Healthcare"
      },
      "organization": {...},
      "department": {...},
      "connectivity": {...},
      "warranty": {...}
    }
  ],
  "pagination": {...}
}
```

### **GET /devices/devices/statistics**
**Description:** Get device statistics  
**Permission:** `device.read`  

**Response:**
```json
{
  "success": true,
  "data": {
    "total_devices": 150,
    "by_status": {
      "active": 120,
      "maintenance": 15,
      "inactive": 10,
      "decommissioned": 5
    },
    "by_category": {...},
    "by_department": {...},
    "connectivity_status": {
      "connected": 100,
      "disconnected": 20,
      "error": 5
    }
  }
}
```

### **GET /devices/devices/:id**
**Description:** Get device by ID with full details  
**Permission:** `device.read`  

### **POST /devices/devices**
**Description:** Create new device  
**Permission:** `device.create`  
**Request Body:**
```json
{
  "model_id": "model-id",
  "organization_id": "org-id",
  "department_id": "dept-id",
  "serial_number": "UNIQUE-SERIAL",
  "asset_tag": "ASSET-001",
  "location": "Room 101",
  "purchase_date": "2024-01-15",
  "installation_date": "2024-01-20",
  "notes": "Device notes"
}
```

### **PUT /devices/devices/:id**
**Description:** Update device information  
**Permission:** `device.update`  

### **DELETE /devices/devices/:id**
**Description:** Delete device (soft delete)  
**Permission:** `device.delete`  

---

## 📡 **DEVICE CONNECTIVITY**

### **GET /devices/device-connectivity**
**Description:** Get all device connectivity configurations  
**Query Parameters:**
- `status` (enum) - connected, disconnected, error
- `protocol` (enum) - mqtt, http, websocket

### **GET /devices/device-connectivity/device/:deviceId**
**Description:** Get connectivity configuration for specific device  

### **POST /devices/device-connectivity**
**Description:** Create device connectivity configuration  
**Request Body:**
```json
{
  "device_id": "device-id",
  "mqtt_user": "device_user",
  "mqtt_pass": "secure_password",
  "mqtt_topic": "iomt/device/001",
  "broker_host": "mqtt.hospital.local",
  "broker_port": 8883,
  "use_ssl": true,
  "data_format": "json"
}
```

---

## 📋 **WARRANTIES**

### **GET /devices/warranties**
**Description:** Get all warranty information  

### **GET /devices/warranties/expiring**
**Description:** Get expiring warranties  
**Query Parameters:**
- `days` (number) - Days until expiration (default: 30)

### **GET /devices/warranties/device/:deviceId**
**Description:** Get warranty for specific device  

### **POST /devices/warranties**
**Description:** Create warranty record  
**Request Body:**
```json
{
  "device_id": "device-id",
  "warranty_start": "2024-01-20",
  "warranty_end": "2027-01-20",
  "provider": "Philips Healthcare Vietnam"
}
```

---

## 🔒 **PERMISSIONS REQUIRED**

| Permission | Description |
|------------|-------------|
| `device.read` | View devices, models, categories |
| `device.create` | Create new devices |
| `device.update` | Update device information |
| `device.delete` | Delete devices |
| `device.manage` | Full device management (categories, models) |

---

## 📝 **NOTES**

1. **Authentication:** All endpoints require valid JWT token unless marked as public
2. **Authorization:** Permission-based access control for different operations
3. **Organization Scope:** Data is filtered by user's organization unless system admin
4. **Rate Limiting:** API rate limiting may apply
5. **Pagination:** Use `page` and `limit` parameters for large datasets
6. **Search:** Text search is case-insensitive and supports partial matches
7. **Filtering:** Multiple filters can be combined using AND logic

---

## 🚀 **FRONTEND USAGE EXAMPLES**

### **Device Categories Management Page**
```javascript
// Get all categories for tree view
const categories = await api.get('/devices/device-categories');

// Create new category
const newCategory = await api.post('/devices/device-categories', {
  name: 'ICU Equipment',
  parent_id: 'cat-medical-equipment'
});
```

### **Device Models Management Page**
```javascript
// Get models with filtering
const models = await api.get('/devices/device-models', {
  params: {
    category_id: 'cat-monitoring',
    search: 'Philips',
    page: 1,
    limit: 20
  }
});

// Get model details with specifications
const modelDetails = await api.get(`/devices/device-models/${modelId}`);
```

### **Device Inventory Page**
```javascript
// Get devices with advanced filtering
const devices = await api.get('/devices/devices', {
  params: {
    status: 'active',
    department_id: 'dept-icu',
    search: 'monitor'
  }
});

// Get device statistics for dashboard
const stats = await api.get('/devices/devices/statistics');
```