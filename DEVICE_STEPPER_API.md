# API Stepper Modal - Thêm Thiết Bị IoMT

## Mục lục
1. [Tổng quan](#tổng-quan)
2. [Authentication & Permissions](#authentication--permissions)
3. [Luồng Stepper Modal](#luồng-stepper-modal)
4. [API Endpoints Chi Tiết](#api-endpoints-chi-tiết)
5. [Ví dụ Request/Response](#ví-dụ-requestresponse)
6. [Validation & Error Handling](#validation--error-handling)
7. [Frontend Implementation Tips](#frontend-implementation-tips)

## Tổng quan

Stepper Modal để thêm thiết bị IoMT bao gồm 3 bước chính:
1. **Chọn Model & Category** - Lựa chọn loại thiết bị
2. **Thông tin thiết bị** - Nhập thông tin cơ bản
3. **Kết nối MQTT** - Cấu hình kết nối IoT

Base URL: `http://localhost:3030/devices`

## Authentication & Permissions

### Required Headers
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### Permission Levels
- `device.read` - Xem thông tin thiết bị
- `device.create` - Tạo thiết bị mới
- `device.update` - Cập nhật thiết bị
- `device.manage` - Quản lý model/category
- `device.delete` - Xóa thiết bị

## Luồng Stepper Modal

### Step 1: Chọn Model & Category
```
1. Lấy danh sách categories
2. User chọn category
3. Lấy models theo category
4. User chọn model (hoặc tạo mới)
5. Lấy manufacturers (nếu cần tạo model mới)
```

### Step 2: Thông tin thiết bị
```
1. User nhập thông tin thiết bị
2. Gọi API tạo device
3. Lưu device_id để dùng cho step 3
```

### Step 3: Kết nối MQTT
```
1. User nhập thông tin MQTT
2. Gọi API tạo device connectivity
3. (Optional) Test kết nối MQTT
4. Hoàn thành
```

## API Endpoints Chi Tiết

### 1. Device Categories

#### GET /device-categories
Lấy tất cả categories (cây phân cấp)
- **Auth**: Required, `device.read`
- **Response**: Danh sách categories với children

#### GET /device-categories/root
Lấy root categories
- **Auth**: Required
- **Response**: Danh sách root categories

#### GET /device-categories/:parentId/children
Lấy child categories
- **Auth**: Required
- **Params**: `parentId` (UUID)

### 2. Device Models

#### GET /device-models
Lấy tất cả device models
- **Auth**: Required, `device.read`
- **Query params**:
  - `category_id` (UUID) - Filter theo category
  - `manufacturer_id` (UUID) - Filter theo manufacturer
  - `search` (string) - Tìm kiếm theo tên
  - `page`, `limit` - Pagination

#### GET /device-models/category/:categoryId
Lấy models theo category
- **Auth**: Required, `device.read`
- **Params**: `categoryId` (UUID)

#### GET /device-models/manufacturers
Lấy danh sách manufacturers
- **Auth**: Required
- **Response**: Danh sách manufacturers

#### POST /device-models
Tạo device model mới
- **Auth**: Required, `device.manage`
- **Body**: Model data

### 3. Devices (Core)

#### POST /devices
Tạo thiết bị mới (Step 2)
- **Auth**: Required, `device.create`
- **Body**: Device data

#### GET /devices/:id
Lấy thông tin thiết bị
- **Auth**: Required, `device.read`
- **Params**: `id` (UUID)

#### PUT /devices/:id
Cập nhật thiết bị
- **Auth**: Required, `device.update`
- **Params**: `id` (UUID)
- **Body**: Device data

### 4. Device Connectivity (MQTT)

#### POST /device-connectivity
Tạo kết nối MQTT (Step 3)
- **Auth**: Required
- **Body**: Connectivity data

#### GET /device-connectivity/device/:deviceId
Lấy thông tin kết nối theo device
- **Params**: `deviceId` (UUID)

#### PUT /device-connectivity/:id
Cập nhật kết nối
- **Auth**: Required
- **Params**: `id` (UUID)
- **Body**: Connectivity data

#### PUT /device-connectivity/device/:deviceId/heartbeat
Cập nhật heartbeat (test kết nối)
- **Params**: `deviceId` (UUID)

## Ví dụ Request/Response

### 1. Lấy Categories
```bash
curl -X GET "http://localhost:3030/devices/device-categories" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-uuid-1",
      "name": "Medical Devices",
      "description": "Thiết bị y tế",
      "parent_id": null,
      "children": [
        {
          "id": "cat-uuid-2",
          "name": "Monitors",
          "description": "Thiết bị giám sát",
          "parent_id": "cat-uuid-1"
        }
      ]
    }
  ]
}
```

### 2. Lấy Models theo Category
```bash
curl -X GET "http://localhost:3030/devices/device-models/category/cat-uuid-2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "model-uuid-1",
      "name": "Patient Monitor PM-2000",
      "model_number": "PM2000",
      "category_id": "cat-uuid-2",
      "manufacturer": {
        "id": "mfg-uuid-1",
        "name": "MedTech Corp"
      }
    }
  ]
}
```

### 3. Tạo Device (Step 2)
```bash
curl -X POST "http://localhost:3030/devices/devices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "model-uuid-1",
    "organization_id": "org-uuid-1",
    "serial_number": "SN123456789",
    "asset_tag": "ASSET-001",
    "department_id": "dept-uuid-1",
    "status": "active",
    "purchase_date": "2025-10-01",
    "installation_date": "2025-10-15",
    "location": "ICU Room 301",
    "notes": "Thiết bị giám sát bệnh nhân chính"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "device-uuid-1",
    "model_id": "model-uuid-1",
    "organization_id": "org-uuid-1",
    "serial_number": "SN123456789",
    "asset_tag": "ASSET-001",
    "status": "active",
    "created_at": "2025-10-24T07:00:00Z",
    "updated_at": "2025-10-24T07:00:00Z"
  },
  "message": "Device created successfully"
}
```

### 4. Tạo MQTT Connectivity (Step 3)
```bash
curl -X POST "http://localhost:3030/devices/device-connectivity" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-uuid-1",
    "mqtt_user": "device_SN123456789",
    "mqtt_pass": "secure_password_123",
    "mqtt_topic": "iot/org1/SN123456789",
    "broker_host": "mqtt.iomt.local",
    "broker_port": 1883,
    "ssl_enabled": false,
    "heartbeat_interval": 300,
    "is_active": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conn-uuid-1",
    "device_id": "device-uuid-1",
    "mqtt_user": "device_SN123456789",
    "mqtt_topic": "iot/org1/SN123456789",
    "broker_host": "mqtt.iomt.local",
    "broker_port": 1883,
    "ssl_enabled": false,
    "heartbeat_interval": 300,
    "is_active": true,
    "last_connected": null,
    "created_at": "2025-10-24T07:05:00Z"
  },
  "message": "Device connectivity created successfully"
}
```

### 5. Test MQTT Connection (Heartbeat)
```bash
curl -X PUT "http://localhost:3030/devices/device-connectivity/device/device-uuid-1/heartbeat" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_id": "device-uuid-1",
    "last_connected": "2025-10-24T07:10:00Z"
  },
  "message": "Heartbeat updated successfully"
}
```

## Validation & Error Handling

### Common Validation Rules

#### Device Creation
- `serial_number`: Required, unique, max 255 chars
- `model_id`: Required, valid UUID, must exist
- `organization_id`: Required, valid UUID, must exist
- `status`: Enum (`active`, `inactive`, `maintenance`, `decommissioned`)
- `purchase_date`, `installation_date`: ISO date format (YYYY-MM-DD)

#### MQTT Connectivity
- `device_id`: Required, valid UUID, must exist
- `mqtt_topic`: Required, max 255 chars
- `broker_host`: Required, max 255 chars
- `broker_port`: Integer, 1-65535
- `heartbeat_interval`: Integer, min 60 seconds

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "serial_number",
      "message": "Serial number is required"
    },
    {
      "field": "model_id",
      "message": "Invalid model ID format"
    }
  ]
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### 409 Conflict - Duplicate Serial
```json
{
  "success": false,
  "message": "Serial number already exists",
  "error": "Duplicate entry for serial_number"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Device model not found"
}
```

## Frontend Implementation Tips

### React/Vue Stepper Example Structure

```javascript
// Step 1: Model Selection
const Step1ModelSelection = () => {
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    // Load categories on mount
    fetchCategories();
  }, []);

  useEffect(() => {
    // Load models when category changes
    if (selectedCategory) {
      fetchModelsByCategory(selectedCategory.id);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/devices/device-categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data.data);
    } catch (error) {
      showError('Không thể tải danh sách categories');
    }
  };

  // ... rest of component
};

// Step 2: Device Info
const Step2DeviceInfo = ({ selectedModel, onDeviceCreated }) => {
  const [formData, setFormData] = useState({
    serial_number: '',
    asset_tag: '',
    organization_id: '',
    department_id: '',
    status: 'active',
    purchase_date: '',
    installation_date: '',
    location: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const deviceData = {
        ...formData,
        model_id: selectedModel.id
      };
      
      const response = await axios.post('/devices/devices', deviceData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      onDeviceCreated(response.data.data);
    } catch (error) {
      if (error.response?.status === 400) {
        showValidationErrors(error.response.data.errors);
      } else if (error.response?.status === 409) {
        showError('Số serial đã tồn tại');
      } else {
        showError('Không thể tạo thiết bị');
      }
    }
  };

  // ... form JSX
};

// Step 3: MQTT Setup
const Step3MQTTSetup = ({ device, onComplete }) => {
  const [mqttData, setMqttData] = useState({
    mqtt_user: `device_${device.serial_number}`,
    mqtt_pass: '',
    mqtt_topic: `iot/${device.organization_id}/${device.serial_number}`,
    broker_host: 'mqtt.iomt.local',
    broker_port: 1883,
    ssl_enabled: false,
    heartbeat_interval: 300,
    is_active: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const connectivityData = {
        ...mqttData,
        device_id: device.id
      };
      
      const response = await axios.post('/devices/device-connectivity', connectivityData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      onComplete(response.data.data);
    } catch (error) {
      showError('Không thể tạo kết nối MQTT');
    }
  };

  const testConnection = async () => {
    try {
      await axios.put(`/devices/device-connectivity/device/${device.id}/heartbeat`);
      showSuccess('Kết nối MQTT thành công');
    } catch (error) {
      showError('Không thể kết nối MQTT');
    }
  };

  // ... form JSX with test button
};
```

### Error Handling Best Practices

```javascript
const handleApiError = (error, context = '') => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        if (data.errors) {
          // Show validation errors
          data.errors.forEach(err => {
            showFieldError(err.field, err.message);
          });
        } else {
          showError(data.message || 'Dữ liệu không hợp lệ');
        }
        break;
        
      case 401:
        showError('Phiên đăng nhập đã hết hạn');
        redirectToLogin();
        break;
        
      case 403:
        showError('Bạn không có quyền thực hiện thao tác này');
        break;
        
      case 409:
        showError('Dữ liệu đã tồn tại (Serial number trùng lặp)');
        break;
        
      case 404:
        showError('Không tìm thấy dữ liệu');
        break;
        
      default:
        showError(`Lỗi hệ thống ${context}`);
    }
  } else {
    showError('Không thể kết nối đến server');
  }
};
```

### State Management (Redux/Zustand)

```javascript
// Store for stepper state
const useStepperStore = create((set, get) => ({
  currentStep: 1,
  selectedCategory: null,
  selectedModel: null,
  createdDevice: null,
  mqttConnectivity: null,
  
  setCurrentStep: (step) => set({ currentStep: step }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setCreatedDevice: (device) => set({ createdDevice: device }),
  setMqttConnectivity: (connectivity) => set({ mqttConnectivity: connectivity }),
  
  reset: () => set({
    currentStep: 1,
    selectedCategory: null,
    selectedModel: null,
    createdDevice: null,
    mqttConnectivity: null
  }),
  
  canProceedToStep: (step) => {
    const state = get();
    switch (step) {
      case 2:
        return !!state.selectedModel;
      case 3:
        return !!state.createdDevice;
      default:
        return true;
    }
  }
}));
```

## Testing với Curl/Postman

### 1. Test toàn bộ flow
```bash
# 1. Get categories
curl -X GET "http://localhost:3030/devices/device-categories" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Get models by category
curl -X GET "http://localhost:3030/devices/device-models/category/CATEGORY_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Create device
curl -X POST "http://localhost:3030/devices/devices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @device_payload.json

# 4. Create MQTT connectivity
curl -X POST "http://localhost:3030/devices/device-connectivity" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @mqtt_payload.json

# 5. Test heartbeat
curl -X PUT "http://localhost:3030/devices/device-connectivity/device/DEVICE_ID/heartbeat"
```

### 2. Payload files

**device_payload.json:**
```json
{
  "model_id": "2fee7c2b-6be2-41e1-8303-7ba75d2954ea",
  "organization_id": "org-uuid-here",
  "serial_number": "SN123456789",
  "asset_tag": "ASSET-001",
  "status": "active",
  "purchase_date": "2025-10-01",
  "installation_date": "2025-10-15",
  "location": "ICU Room 301",
  "notes": "Test device"
}
```

**mqtt_payload.json:**
```json
{
  "device_id": "device-uuid-from-step2",
  "mqtt_user": "device_SN123456789",
  "mqtt_pass": "secure_password_123",
  "mqtt_topic": "iot/org1/SN123456789",
  "broker_host": "mqtt.iomt.local",
  "broker_port": 1883,
  "ssl_enabled": false,
  "heartbeat_interval": 300,
  "is_active": true
}
```

---

## Ghi chú quan trọng

1. **Serial Number**: Phải unique trong toàn hệ thống
2. **MQTT Topic**: Recommend format `iot/{org_id}/{serial_number}`
3. **Permissions**: Kiểm tra permissions trước khi hiển thị UI
4. **Validation**: Luôn validate ở frontend trước khi gửi API
5. **Error Handling**: Hiển thị lỗi thân thiện với người dùng
6. **Loading States**: Hiển thị loading khi gọi API
7. **Auto-save**: Consider auto-save draft để tránh mất dữ liệu

Tài liệu này cung cấp tất cả thông tin cần thiết để implement Stepper Modal thêm thiết bị IoMT. Nếu cần thêm thông tin chi tiết về endpoint nào, vui lòng hỏi thêm.