# Device Management API Test Samples

## 1. DEVICE CATEGORIES ROUTES

### 1.1 POST /actlog/devices/device-categories - Create Root Categories

**Thiết bị y tế (Root Category)**
```json
{
  "name": "Thiết bị y tế",
  "description": "Tất cả thiết bị y tế trong bệnh viện"
}
```

**Thiết bị IT (Root Category)**
```json
{
  "name": "Thiết bị IT", 
  "description": "Máy tính, mạng, server và thiết bị công nghệ thông tin"
}
```

**Cơ sở hạ tầng (Root Category)**
```json
{
  "name": "Cơ sở hạ tầng",
  "description": "Điều hòa, điện, nước, gas y tế"
}
```

### 1.2 POST /actlog/devices/device-categories - Create Child Categories

**Máy xét nghiệm (Child of Thiết bị y tế)**
```json
{
  "name": "Máy xét nghiệm",
  "description": "Các loại máy xét nghiệm tự động",
  "parent_id": "ROOT_MEDICAL_CATEGORY_UUID"
}
```

**Máy chẩn đoán hình ảnh (Child of Thiết bị y tế)**
```json
{
  "name": "Máy chẩn đoán hình ảnh", 
  "description": "X-quang, CT, MRI, siêu âm",
  "parent_id": "ROOT_MEDICAL_CATEGORY_UUID"
}
```

**Thiết bị hồi sức (Child of Thiết bị y tế)**
```json
{
  "name": "Thiết bị hồi sức",
  "description": "Máy thở, monitor, máy sốc tim", 
  "parent_id": "ROOT_MEDICAL_CATEGORY_UUID"
}
```

**Máy tính & Laptop (Child of Thiết bị IT)**
```json
{
  "name": "Máy tính & Laptop",
  "description": "PC, laptop, workstation",
  "parent_id": "ROOT_IT_CATEGORY_UUID"
}
```

**Thiết bị mạng (Child of Thiết bị IT)**
```json
{
  "name": "Thiết bị mạng",
  "description": "Switch, router, firewall, access point",
  "parent_id": "ROOT_IT_CATEGORY_UUID"
}
```

### 1.3 PUT /actlog/devices/device-categories/{id} - Update Category
```json
{
  "name": "Máy xét nghiệm tự động",
  "description": "Các loại máy xét nghiệm tự động và bán tự động"
}
```

### 1.4 GET Endpoints (No body required)
- `GET /actlog/devices/device-categories` - All categories
- `GET /actlog/devices/device-categories/root` - Root categories only
- `GET /actlog/devices/device-categories/{parentId}/children` - Child categories
- `GET /actlog/devices/device-categories/{id}/stats` - Category statistics

---

## 2. DEVICE MODELS ROUTES

### 2.1 POST /actlog/devices/device-models - Create Device Models

**Cobas 6000 (Lab Equipment)**
```json
{
  "category_id": "LAB_CATEGORY_UUID",
  "name": "Cobas 6000",
  "manufacturer": "Roche Diagnostics",
  "specifications": "Hệ thống xét nghiệm tự động hoàn toàn, 800 test/giờ, hóa sinh và miễn dịch, kết nối LIS"
}
```

**XN-3000 (Hematology Analyzer)**
```json
{
  "category_id": "LAB_CATEGORY_UUID", 
  "name": "XN-3000",
  "manufacturer": "Sysmex",
  "specifications": "Máy đếm tế bào máu tự động, 120 mẫu/giờ, 26 thông số, công nghệ flow cytometry"
}
```

**Multix Select DR (X-Ray)**
```json
{
  "category_id": "IMAGING_CATEGORY_UUID",
  "name": "Multix Select DR",
  "manufacturer": "Siemens Healthineers", 
  "specifications": "Máy X-quang kỹ thuật số, detector phẳng 43x43cm, 125kV, tự động exposure"
}
```

**LOGIQ P9 (Ultrasound)**
```json
{
  "category_id": "IMAGING_CATEGORY_UUID",
  "name": "LOGIQ P9", 
  "manufacturer": "GE Healthcare",
  "specifications": "Máy siêu âm cao cấp, 4D real-time, doppler màu, 15+ transducers"
}
```

**Servo-i (Ventilator)**
```json
{
  "category_id": "ICU_CATEGORY_UUID",
  "name": "Servo-i",
  "manufacturer": "Maquet",
  "specifications": "Máy thở ICU, invasive/non-invasive, NAVA mode, touch screen"
}
```

**Dell Precision 5570 (Workstation)**
```json
{
  "category_id": "COMPUTER_CATEGORY_UUID",
  "name": "Precision 5570",
  "manufacturer": "Dell Technologies",
  "specifications": "Workstation mobile, Intel i7-12700H, 32GB RAM, NVIDIA RTX A2000"
}
```

**Cisco Catalyst 2960-X (Network Switch)**
```json
{
  "category_id": "NETWORK_CATEGORY_UUID",
  "name": "Catalyst 2960-X",
  "manufacturer": "Cisco Systems",
  "specifications": "Managed switch 48 ports GigE, 4x 10G SFP+, PoE+, Layer 2"
}
```

### 2.2 PUT /actlog/devices/device-models/{id} - Update Device Model
```json
{
  "specifications": "Hệ thống xét nghiệm tự động hoàn toàn, 800 test/giờ, hóa sinh và miễn dịch, kết nối LIS, backup power",
  "manufacturer": "Roche Diagnostics Vietnam"
}
```

### 2.3 GET Endpoints (No body, use query parameters)
- `GET /actlog/devices/device-models?category_id=uuid&manufacturer=Roche`
- `GET /actlog/devices/device-models/manufacturers`
- `GET /actlog/devices/device-models/{id}`
- `GET /actlog/devices/device-models/category/{categoryId}`

---

## 3. DEVICES ROUTES

### 3.1 POST /actlog/devices/devices - Create Devices

**Cobas 6000 Device**
```json
{
  "model_id": "COBAS_6000_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_XN_UUID",
  "serial_number": "RC6000-2024-001",
  "asset_tag": "XN-001",
  "status": "active",
  "purchase_date": "2024-01-15",
  "installation_date": "2024-02-01"
}
```

**XN-3000 Device**
```json
{
  "model_id": "XN3000_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581", 
  "department_id": "DEPT_XN_UUID",
  "serial_number": "SX3000-2024-002",
  "asset_tag": "XN-002",
  "status": "active",
  "purchase_date": "2024-03-10",
  "installation_date": "2024-03-20"
}
```

**X-Ray Machine**
```json
{
  "model_id": "MULTIX_SELECT_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_CDHA_UUID", 
  "serial_number": "SI-DR-2024-003",
  "asset_tag": "CDHA-001",
  "status": "active",
  "purchase_date": "2024-02-20",
  "installation_date": "2024-03-15"
}
```

**Ultrasound Device**
```json
{
  "model_id": "LOGIQ_P9_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_CDHA_UUID",
  "serial_number": "GE-P9-2024-004", 
  "asset_tag": "CDHA-002",
  "status": "active",
  "purchase_date": "2024-04-05",
  "installation_date": "2024-04-20"
}
```

**Ventilator Device**
```json
{
  "model_id": "SERVO_I_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_ICU_UUID",
  "serial_number": "MQ-SI-2024-005",
  "asset_tag": "ICU-001",
  "status": "active", 
  "purchase_date": "2024-01-25",
  "installation_date": "2024-02-10"
}
```

**Dell Workstation**
```json
{
  "model_id": "DELL_PRECISION_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_IT_UUID",
  "serial_number": "DL-P5570-2024-006",
  "asset_tag": "IT-WS-001",
  "status": "active",
  "purchase_date": "2024-05-10",
  "installation_date": "2024-05-15"
}
```

**Cisco Switch**
```json
{
  "model_id": "CISCO_2960X_MODEL_UUID",
  "organization_id": "7e983a73-c2b2-475d-a1dd-85b722ab4581",
  "department_id": "DEPT_IT_UUID", 
  "serial_number": "CS-2960X-2024-007",
  "asset_tag": "NET-SW-001",
  "status": "active",
  "purchase_date": "2024-06-01",
  "installation_date": "2024-06-05"
}
```

### 3.2 PUT /actlog/devices/devices/{id} - Update Device

**Change Status to Maintenance**
```json
{
  "status": "maintenance"
}
```

**Update Multiple Fields**
```json
{
  "asset_tag": "XN-001-UPDATED",
  "status": "active",
  "department_id": "NEW_DEPT_UUID"
}
```

**Mark as Decommissioned**
```json
{
  "status": "decommissioned"
}
```

### 3.3 GET Endpoints (No body, use query parameters)
- `GET /actlog/devices/devices?organization_id=uuid&status=active&page=1&limit=10`
- `GET /actlog/devices/devices/statistics?organization_id=uuid`
- `GET /actlog/devices/devices/{id}`

---

## 4. DEVICE CONNECTIVITY ROUTES

### 4.1 POST /actlog/devices/device-connectivity - Create Connectivity

**Cobas 6000 Connectivity**
```json
{
  "device_id": "COBAS_DEVICE_UUID",
  "mqtt_user": "cobas_6000_001",
  "mqtt_pass": "secure_password_123!",
  "mqtt_topic": "hospital/lab/cobas6000/001",
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 300,
  "is_active": true
}
```

**XN-3000 Connectivity**
```json
{
  "device_id": "XN3000_DEVICE_UUID",
  "mqtt_user": "sysmex_xn3000_002", 
  "mqtt_pass": "secure_password_456!",
  "mqtt_topic": "hospital/lab/sysmex_xn3000/002",
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 180,
  "is_active": true
}
```

**X-Ray Connectivity**
```json
{
  "device_id": "XRAY_DEVICE_UUID",
  "mqtt_user": "siemens_multix_003",
  "mqtt_pass": "secure_password_789!",
  "mqtt_topic": "hospital/imaging/xray/003", 
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 600,
  "is_active": true
}
```

**Ventilator Connectivity**
```json
{
  "device_id": "VENTILATOR_DEVICE_UUID",
  "mqtt_user": "maquet_servo_005",
  "mqtt_pass": "secure_password_abc!",
  "mqtt_topic": "hospital/icu/ventilator/005",
  "broker_host": "mqtt.bvdakhoatp.vn",
  "broker_port": 8883,
  "ssl_enabled": true,
  "heartbeat_interval": 60,
  "is_active": true
}
```

**Network Switch Connectivity**
```json
{
  "device_id": "SWITCH_DEVICE_UUID",
  "mqtt_user": "cisco_switch_007",
  "mqtt_pass": "secure_password_xyz!",
  "mqtt_topic": "hospital/network/switch/007",
  "broker_host": "mqtt.bvdakhoatp.vn", 
  "broker_port": 1883,
  "ssl_enabled": false,
  "heartbeat_interval": 120,
  "is_active": true
}
```

### 4.2 PUT /actlog/devices/device-connectivity/{id} - Update Connectivity

**Change Broker Settings**
```json
{
  "broker_host": "new-mqtt-broker.bvdakhoatp.vn",
  "broker_port": 8884,
  "ssl_enabled": true
}
```

**Update Password and Topic**
```json
{
  "mqtt_pass": "new_secure_password_123!",
  "mqtt_topic": "hospital/lab/cobas6000/001/v2"
}
```

**Disable Connectivity**
```json
{
  "is_active": false
}
```

### 4.3 PUT /actlog/devices/device-connectivity/device/{deviceId}/heartbeat
**No body required - automatically updates last_connected timestamp**

### 4.4 GET Endpoints (No body, use query parameters)
- `GET /actlog/devices/device-connectivity?organization_id=uuid&is_active=true`
- `GET /actlog/devices/device-connectivity/statistics?organization_id=uuid`
- `GET /actlog/devices/device-connectivity/device/{deviceId}`

---

## 5. WARRANTY ROUTES

### 5.1 POST /actlog/devices/warranties - Create Warranty Info

**Cobas 6000 Warranty**
```json
{
  "device_id": "COBAS_DEVICE_UUID",
  "warranty_start": "2024-02-01",
  "warranty_end": "2027-02-01",
  "provider": "Roche Diagnostics Vietnam"
}
```

**XN-3000 Warranty**
```json
{
  "device_id": "XN3000_DEVICE_UUID",
  "warranty_start": "2024-03-20", 
  "warranty_end": "2026-03-20",
  "provider": "Sysmex Vietnam Co., Ltd"
}
```

**X-Ray Warranty**
```json
{
  "device_id": "XRAY_DEVICE_UUID",
  "warranty_start": "2024-03-15",
  "warranty_end": "2029-03-15", 
  "provider": "Siemens Healthineers Vietnam"
}
```

**Ultrasound Warranty**
```json
{
  "device_id": "ULTRASOUND_DEVICE_UUID",
  "warranty_start": "2024-04-20",
  "warranty_end": "2027-04-20",
  "provider": "GE Healthcare Vietnam"
}
```

**Ventilator Warranty**
```json
{
  "device_id": "VENTILATOR_DEVICE_UUID", 
  "warranty_start": "2024-02-10",
  "warranty_end": "2026-02-10",
  "provider": "Maquet Critical Care Vietnam"
}
```

**Dell Workstation Warranty**
```json
{
  "device_id": "DELL_DEVICE_UUID",
  "warranty_start": "2024-05-15",
  "warranty_end": "2027-05-15",
  "provider": "Dell Technologies Vietnam"
}
```

**Cisco Switch Warranty**  
```json
{
  "device_id": "CISCO_DEVICE_UUID",
  "warranty_start": "2024-06-05",
  "warranty_end": "2029-06-05", 
  "provider": "Cisco Systems Vietnam"
}
```

### 5.2 PUT /actlog/devices/warranties/{id} - Update Warranty

**Extend Warranty Period**
```json
{
  "warranty_end": "2028-02-01",
  "provider": "Roche Diagnostics Vietnam - Extended Support"
}
```

**Change Provider**
```json
{
  "provider": "Local Authorized Service Partner"
}
```

### 5.3 GET Endpoints (No body, use query parameters)
- `GET /actlog/devices/warranties?organization_id=uuid&status=expiring_soon`
- `GET /actlog/devices/warranties/statistics?organization_id=uuid`
- `GET /actlog/devices/warranties/expiring?days=90&organization_id=uuid`
- `GET /actlog/devices/warranties/device/{deviceId}`

---

## 6. SAMPLE QUERY PARAMETERS

### Device Filtering Examples:
```
/actlog/devices/devices?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
/actlog/devices/devices?status=active&manufacturer=Roche
/actlog/devices/devices?category_id=LAB_CATEGORY_UUID&page=1&limit=20
/actlog/devices/devices?department_id=DEPT_XN_UUID
```

### Connectivity Filtering Examples:
```
/actlog/devices/device-connectivity?is_active=true&broker_host=mqtt.bvdakhoatp.vn
/actlog/devices/device-connectivity?organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

### Warranty Filtering Examples:
```
/actlog/devices/warranties?status=expired
/actlog/devices/warranties?status=expiring_soon&provider=Roche
/actlog/devices/warranties/expiring?days=30
/actlog/devices/warranties/expiring?days=90&organization_id=7e983a73-c2b2-475d-a1dd-85b722ab4581
```

---

## 7. SAMPLE RESPONSE FORMATS

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### List Response with Pagination:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "pages": 3
  },
  "message": "Data retrieved successfully"
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## 8. TESTING WORKFLOW

### Suggested Testing Order:
1. **Create Categories** (Root → Child)
2. **Create Models** (for each category)
3. **Create Devices** (with valid model + organization)
4. **Create Connectivity** (for IoT devices)
5. **Create Warranties** (for all devices)
6. **Test GET endpoints** with various filters
7. **Test UPDATE endpoints**
8. **Test Statistics endpoints**

### Required UUIDs:
- Replace all `*_UUID` placeholders with actual UUIDs from your database
- Use existing `organization_id` and `department_id` from your current data
- Generate new UUIDs for categories and models as you create them
