# Complete Device Model Creation API

## Overview
This document provides complete API endpoints and examples for creating device models with **all required fields** including `manufacturer_id`, `supplier_id`, and `specifications`.

---

## 📋 Table of Contents
1. [Helper Endpoints](#helper-endpoints)
2. [Create Device Model](#create-device-model)
3. [Complete Examples](#complete-examples)
4. [Validation Rules](#validation-rules)
5. [Error Handling](#error-handling)

---

## 🔧 Helper Endpoints

Before creating a device model, you need to fetch valid IDs for categories, manufacturers, and suppliers.

### 1. Get Device Categories
```http
GET /api/devices/device-categories
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category_id": "550e8400-e29b-41d4-a716-446655440000",
      "category_name": "Medical Devices",
      "description": "Hospital medical equipment",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "category_id": "660e8400-e29b-41d4-a716-446655440001",
      "category_name": "Monitoring Equipment",
      "description": "Patient monitoring systems",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 2. Get Manufacturers
```http
GET /api/devices/device-models/manufacturers
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "manufacturer_id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Philips Healthcare",
      "country": "Netherlands",
      "website": "https://www.philips.com/healthcare",
      "_count": {
        "device_models": 15
      }
    },
    {
      "manufacturer_id": "880e8400-e29b-41d4-a716-446655440003",
      "name": "GE Healthcare",
      "country": "USA",
      "website": "https://www.gehealthcare.com",
      "_count": {
        "device_models": 23
      }
    }
  ],
  "total": 2
}
```

### 3. Get Suppliers (NEW)
```http
GET /api/devices/device-models/suppliers
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "supplier_id": "990e8400-e29b-41d4-a716-446655440004",
      "supplier_name": "MedSupply Vietnam",
      "contact_person": "Nguyen Van A",
      "email": "contact@medsupply.vn",
      "phone": "+84-123-456-789",
      "_count": {
        "device_models": 8
      }
    },
    {
      "supplier_id": "aa0e8400-e29b-41d4-a716-446655440005",
      "supplier_name": "HealthTech Distributors",
      "contact_person": "Tran Thi B",
      "email": "sales@healthtech.vn",
      "phone": "+84-987-654-321",
      "_count": {
        "device_models": 12
      }
    }
  ],
  "total": 2
}
```

---

## ✅ Create Device Model

### Endpoint
```http
POST /api/devices/device-models
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body Schema
```json
{
  "category_id": "UUID (required) - Must exist in device_categories table",
  "name": "String (required) - Device model name",
  "model_number": "String (optional) - Unique identifier",
  "manufacturer_id": "UUID (optional) - Foreign key to manufacturers table",
  "supplier_id": "UUID (optional) - Foreign key to suppliers table",
  "specifications": {
    "key": "value",
    "...": "JSON object with device specs"
  }
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `category_id` | UUID | ✅ Yes | Must exist in DB | Device category reference |
| `name` | String | ✅ Yes | Min 1 char | Model display name |
| `model_number` | String | ❌ No | Unique if provided | Manufacturer's model number |
| `manufacturer_id` | UUID | ❌ No | Must exist in manufacturers table | Manufacturer reference |
| `supplier_id` | UUID | ❌ No | Must exist in suppliers table | Supplier reference |
| `specifications` | JSON Object | ❌ No | Valid JSON | Technical specifications |

---

## 📝 Complete Examples

### Example 1: Minimal Device Model
```json
POST /api/devices/device-models
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Basic Patient Monitor"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device model created successfully",
  "data": {
    "model_id": "bb0e8400-e29b-41d4-a716-446655440006",
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Basic Patient Monitor",
    "model_number": null,
    "manufacturer_id": null,
    "supplier_id": null,
    "specifications": null,
    "created_at": "2024-01-20T08:30:00Z",
    "updated_at": "2024-01-20T08:30:00Z"
  }
}
```

---

### Example 2: Complete Device Model with All Fields
```json
POST /api/devices/device-models
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Philips IntelliVue MX450",
  "model_number": "MX450-V2.1",
  "manufacturer_id": "770e8400-e29b-41d4-a716-446655440002",
  "supplier_id": "990e8400-e29b-41d4-a716-446655440004",
  "specifications": {
    "display": {
      "size": "15 inch",
      "type": "Touchscreen LCD",
      "resolution": "1024x768"
    },
    "power": {
      "voltage": "220V AC / 50-60Hz",
      "battery": "3-hour Li-ion battery backup",
      "consumption": "45W typical"
    },
    "connectivity": {
      "ethernet": "10/100 Base-T",
      "wifi": "802.11 a/b/g/n",
      "bluetooth": "4.2",
      "usb_ports": 4
    },
    "measurements": {
      "ecg": "12-lead capability",
      "spo2": "Masimo SET technology",
      "nibp": "Automatic 5-180 min intervals",
      "temperature": "Dual channel",
      "respiration": "Impedance pneumography"
    },
    "physical": {
      "weight": "3.2 kg",
      "dimensions": "320 x 260 x 180 mm",
      "protection_rating": "IPX1"
    },
    "compliance": {
      "standards": ["IEC 60601-1", "IEC 60601-2-27", "IEC 60601-1-2"],
      "certifications": ["CE Mark", "FDA 510(k)", "Vietnam MOH"]
    },
    "warranty": {
      "period": "2 years",
      "extended_available": true
    },
    "accessories": [
      "ECG cable 5-lead",
      "SpO2 sensor adult",
      "NIBP cuff adult",
      "Temperature probe",
      "Mounting bracket"
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device model created successfully",
  "data": {
    "model_id": "cc0e8400-e29b-41d4-a716-446655440007",
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Philips IntelliVue MX450",
    "model_number": "MX450-V2.1",
    "manufacturer_id": "770e8400-e29b-41d4-a716-446655440002",
    "supplier_id": "990e8400-e29b-41d4-a716-446655440004",
    "specifications": {
      "display": { "size": "15 inch", "type": "Touchscreen LCD", "resolution": "1024x768" },
      "power": { "voltage": "220V AC / 50-60Hz", "battery": "3-hour Li-ion battery backup", "consumption": "45W typical" },
      "connectivity": { "ethernet": "10/100 Base-T", "wifi": "802.11 a/b/g/n", "bluetooth": "4.2", "usb_ports": 4 },
      "measurements": { "ecg": "12-lead capability", "spo2": "Masimo SET technology", "nibp": "Automatic 5-180 min intervals", "temperature": "Dual channel", "respiration": "Impedance pneumography" },
      "physical": { "weight": "3.2 kg", "dimensions": "320 x 260 x 180 mm", "protection_rating": "IPX1" },
      "compliance": { "standards": ["IEC 60601-1", "IEC 60601-2-27", "IEC 60601-1-2"], "certifications": ["CE Mark", "FDA 510(k)", "Vietnam MOH"] },
      "warranty": { "period": "2 years", "extended_available": true },
      "accessories": ["ECG cable 5-lead", "SpO2 sensor adult", "NIBP cuff adult", "Temperature probe", "Mounting bracket"]
    },
    "created_at": "2024-01-20T08:45:00Z",
    "updated_at": "2024-01-20T08:45:00Z",
    "category": {
      "category_id": "550e8400-e29b-41d4-a716-446655440000",
      "category_name": "Medical Devices"
    },
    "manufacturer": {
      "manufacturer_id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Philips Healthcare",
      "country": "Netherlands"
    },
    "supplier": {
      "supplier_id": "990e8400-e29b-41d4-a716-446655440004",
      "supplier_name": "MedSupply Vietnam"
    }
  }
}
```

---

### Example 3: Device Model with Basic Specifications
```json
POST /api/devices/device-models
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "category_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "GE CARESCAPE B450",
  "model_number": "B450-2024",
  "manufacturer_id": "880e8400-e29b-41d4-a716-446655440003",
  "supplier_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "specifications": {
    "type": "Bedside Patient Monitor",
    "screen_size": "12.1 inch",
    "parameters": ["ECG", "SpO2", "NIBP", "TEMP", "RESP"],
    "battery_life": "120 minutes",
    "weight": "2.8 kg",
    "warranty_years": 2
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Device model created successfully",
  "data": {
    "model_id": "dd0e8400-e29b-41d4-a716-446655440008",
    "category_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "GE CARESCAPE B450",
    "model_number": "B450-2024",
    "manufacturer_id": "880e8400-e29b-41d4-a716-446655440003",
    "supplier_id": "aa0e8400-e29b-41d4-a716-446655440005",
    "specifications": {
      "type": "Bedside Patient Monitor",
      "screen_size": "12.1 inch",
      "parameters": ["ECG", "SpO2", "NIBP", "TEMP", "RESP"],
      "battery_life": "120 minutes",
      "weight": "2.8 kg",
      "warranty_years": 2
    },
    "created_at": "2024-01-20T09:00:00Z",
    "updated_at": "2024-01-20T09:00:00Z"
  }
}
```

---

## 🔍 Validation Rules

### 1. Required Field Validation
```json
// Missing category_id
{
  "name": "Test Device"
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Category ID is required"
}
```

---

### 2. Category Existence Validation
```json
{
  "category_id": "00000000-0000-0000-0000-000000000000", // Non-existent category
  "name": "Test Device"
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Device category not found"
}
```

---

### 3. Manufacturer Validation
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Test Device",
  "manufacturer_id": "00000000-0000-0000-0000-000000000000" // Non-existent manufacturer
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Manufacturer not found"
}
```

---

### 4. Supplier Validation
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Test Device",
  "supplier_id": "00000000-0000-0000-0000-000000000000" // Non-existent supplier
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Supplier not found"
}
```

---

### 5. Model Number Uniqueness
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Test Device",
  "model_number": "MX450-V2.1" // Already exists
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Model number already exists"
}
```

---

### 6. Invalid JSON Specifications
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Test Device",
  "specifications": "This is not a JSON object" // Must be object
}
```
**Error Response:**
```json
{
  "success": false,
  "message": "Specifications must be a valid JSON object"
}
```

---

## 🚨 Error Handling

### Error Response Format
All errors follow this structure:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Optional technical error details"
}
```

### Common HTTP Status Codes

| Status Code | Meaning | Example |
|-------------|---------|---------|
| `200 OK` | Success | Device model created |
| `400 Bad Request` | Invalid input data | Missing required field |
| `401 Unauthorized` | Invalid or missing token | Token expired |
| `403 Forbidden` | Insufficient permissions | User lacks `device.manage` permission |
| `404 Not Found` | Referenced entity not found | Category doesn't exist |
| `409 Conflict` | Duplicate unique value | Model number already exists |
| `500 Internal Server Error` | Server-side error | Database connection failed |

---

## 🔐 Authentication & Permissions

### Required Headers
```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Required Permission
- **Permission:** `device.manage`
- **Roles with permission:** `super_admin`, `admin`, `device_manager`

### Getting Your Token
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@hospital.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "...",
    "email": "admin@hospital.com",
    "full_name": "Admin User"
  }
}
```

---

## 📦 Testing with Thunder Client / Postman

### Step-by-Step Test Flow

#### Step 1: Login
```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}
```
Copy the `token` from response.

---

#### Step 2: Get Device Categories
```http
GET {{baseUrl}}/api/devices/device-categories
Authorization: Bearer {{token}}
```
Copy a `category_id` from response.

---

#### Step 3: Get Manufacturers
```http
GET {{baseUrl}}/api/devices/device-models/manufacturers
Authorization: Bearer {{token}}
```
Copy a `manufacturer_id` from response (optional).

---

#### Step 4: Get Suppliers
```http
GET {{baseUrl}}/api/devices/device-models/suppliers
Authorization: Bearer {{token}}
```
Copy a `supplier_id` from response (optional).

---

#### Step 5: Create Device Model
```http
POST {{baseUrl}}/api/devices/device-models
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "category_id": "{{category_id_from_step_2}}",
  "name": "Philips IntelliVue MX450",
  "model_number": "MX450-2024",
  "manufacturer_id": "{{manufacturer_id_from_step_3}}",
  "supplier_id": "{{supplier_id_from_step_4}}",
  "specifications": {
    "display": "15 inch touchscreen",
    "parameters": ["ECG", "SpO2", "NIBP", "TEMP", "RESP"],
    "battery": "3 hours",
    "weight": "3.2 kg",
    "connectivity": ["Ethernet", "WiFi", "Bluetooth"],
    "certifications": ["CE", "FDA"]
  }
}
```

---

## 📊 Database Schema Reference

### device_models Table
```sql
CREATE TABLE device_models (
  model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES device_categories(category_id),
  name VARCHAR(255) NOT NULL,
  model_number VARCHAR(100) UNIQUE,
  manufacturer_id UUID REFERENCES manufacturers(manufacturer_id),
  supplier_id UUID REFERENCES suppliers(supplier_id),
  specifications JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Key Relationships
- `category_id` → `device_categories.category_id` (REQUIRED)
- `manufacturer_id` → `manufacturers.manufacturer_id` (OPTIONAL)
- `supplier_id` → `suppliers.supplier_id` (OPTIONAL)

---

## 🎯 Best Practices

### 1. Use Descriptive Names
```json
✅ Good: "Philips IntelliVue MX450 Patient Monitor"
❌ Bad: "Monitor1"
```

### 2. Consistent Model Numbers
```json
✅ Good: "MX450-V2.1", "GE-B450-2024"
❌ Bad: "model123", "device"
```

### 3. Structured Specifications
```json
✅ Good:
{
  "physical": { "weight": "3.2 kg", "dimensions": "320x260x180 mm" },
  "power": { "voltage": "220V", "battery": "3h" }
}

❌ Bad:
{
  "spec1": "some value",
  "random_field": "data"
}
```

### 4. Always Validate IDs First
Before creating device models, always fetch current categories, manufacturers, and suppliers to ensure valid UUIDs.

---

## 🔄 Related APIs

- [Device Categories API](DEVICE_CATEGORIES_API.md)
- [Manufacturers API](MANUFACTURERS_API.md)
- [Suppliers API](SUPPLIERS_API.md)
- [Devices API](DEVICE_API_DOCS.md)

---

## 📞 Support

For issues or questions:
- Check error messages carefully
- Verify all UUIDs exist in database
- Ensure valid JSON format for specifications
- Confirm authentication token is valid
- Verify user has `device.manage` permission

---

**Last Updated:** 2024-01-20
**API Version:** 1.0
**Status:** ✅ Production Ready
