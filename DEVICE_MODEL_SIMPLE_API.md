# Device Model Creation API - Simple Guide

## 🎯 Endpoint Tạo Device Model Đơn Giản

### **POST /actlog/device-models**

## 📋 Request

### Headers:
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

### Body (Minimal):
```json
{
  "name": "Máy đo huyết áp Omron HEM-7156",
  "category_id": "uuid-của-category"
}
```

### Body (Complete):
```json
{
  "name": "Máy đo huyết áp Omron HEM-7156",
  "category_id": "uuid-của-category", 
  "manufacturer": "Omron Healthcare",
  "model_number": "HEM-7156",
  "description": "Máy đo huyết áp tự động với công nghệ IntelliSense"
}
```

## ✅ Response Success (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Máy đo huyết áp Omron HEM-7156",
    "manufacturer_id": null,
    "model_number": "HEM-7156", 
    "category_id": "category-uuid",
    "category": {
      "id": "category-uuid",
      "name": "Thiết bị đo lường y tế",
      "description": "Các thiết bị đo lường các chỉ số y tế"
    },
    "created_at": "2025-10-27T14:30:00.000Z",
    "updated_at": "2025-10-27T14:30:00.000Z"
  },
  "message": "Device model created successfully"
}
```

## ❌ Response Error (400 Bad Request)

```json
{
  "success": false,
  "message": "Category ID and name are required"
}
```

```json
{
  "success": false,
  "message": "Device model with this name and manufacturer already exists"
}
```

## 🚀 Cách Sử Dụng

### 1. **JavaScript/Fetch**
```javascript
async function createDeviceModel(modelData) {
  try {
    const response = await fetch('/actlog/device-models', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modelData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Model created:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating model:', error);
    throw error;
  }
}

// Usage
const newModel = await createDeviceModel({
  name: "Máy đo huyết áp Omron HEM-7156",
  category_id: "your-category-uuid",
  manufacturer: "Omron Healthcare",
  model_number: "HEM-7156"
});
```

### 2. **jQuery**
```javascript
function createDeviceModel(modelData) {
  return $.ajax({
    url: '/actlog/device-models',
    type: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    contentType: 'application/json',
    data: JSON.stringify(modelData),
    success: function(response) {
      if (response.success) {
        console.log('Model created:', response.data);
        // Redirect to specifications page
        window.location.href = `/models/${response.data.id}/specifications`;
      }
    },
    error: function(xhr) {
      const error = JSON.parse(xhr.responseText);
      alert('Error: ' + error.message);
    }
  });
}

// Usage
createDeviceModel({
  name: $("#model-name").val(),
  category_id: $("#category").val(),
  manufacturer: $("#manufacturer").val(),
  model_number: $("#model-number").val(),
  description: $("#description").val()
});
```

### 3. **Axios**
```javascript
import axios from 'axios';

const createDeviceModel = async (modelData) => {
  try {
    const response = await axios.post('/actlog/device-models', modelData, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    return response.data.data;
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};

// Usage with async/await
try {
  const newModel = await createDeviceModel({
    name: "Máy siêu âm tim 4D",
    category_id: "imaging-category-uuid",
    manufacturer: "GE Healthcare"
  });
  
  console.log('Created model:', newModel);
  // Redirect to add specifications
  window.location.href = `/models/${newModel.id}/specifications/add`;
} catch (error) {
  alert('Lỗi tạo model: ' + error.message);
}
```

## 📊 Get Categories for Dropdown

### **GET /actlog/master-data/device-categories**

```javascript
async function loadCategories() {
  const response = await fetch('/actlog/master-data/device-categories', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const result = await response.json();
  
  if (result.success) {
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">Chọn loại thiết bị...</option>';
    
    result.data.forEach(category => {
      categorySelect.innerHTML += `
        <option value="${category.id}">${category.name}</option>
      `;
    });
  }
}

// Load categories on page load
loadCategories();
```

## 🎨 HTML Form Example

```html
<form id="create-model-form">
  <div class="form-group">
    <label for="name">Tên model thiết bị *</label>
    <input 
      type="text" 
      id="name" 
      name="name" 
      required 
      placeholder="VD: Máy đo huyết áp Omron HEM-7156"
    />
  </div>

  <div class="form-group">
    <label for="category">Loại thiết bị *</label>
    <select id="category" name="category_id" required>
      <option value="">Chọn loại thiết bị...</option>
      <!-- Options loaded by JavaScript -->
    </select>
  </div>

  <div class="form-group">
    <label for="manufacturer">Nhà sản xuất</label>
    <input 
      type="text" 
      id="manufacturer" 
      name="manufacturer" 
      placeholder="VD: Omron Healthcare"
    />
  </div>

  <div class="form-group">
    <label for="model-number">Số model</label>
    <input 
      type="text" 
      id="model-number" 
      name="model_number" 
      placeholder="VD: HEM-7156"
    />
  </div>

  <div class="form-group">
    <label for="description">Mô tả</label>
    <textarea 
      id="description" 
      name="description" 
      rows="3"
      placeholder="Mô tả ngắn gọn về thiết bị..."
    ></textarea>
  </div>

  <button type="submit" class="btn btn-primary">
    Tạo Device Model
  </button>
</form>

<script>
document.getElementById('create-model-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const modelData = Object.fromEntries(formData);
  
  try {
    const newModel = await createDeviceModel(modelData);
    
    // Success - redirect to add specifications
    alert('Tạo model thành công!');
    window.location.href = `/models/${newModel.id}/specifications/add`;
    
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
});
</script>
```

## 🔄 Next Steps - Add & Update Specifications

Sau khi tạo model thành công, bạn có thể:

### 1. **Redirect đến trang thêm specifications:**
```javascript
// After model creation
window.location.href = `/models/${newModel.id}/specifications/add`;
```

### 2. **Hoặc gọi API thêm specifications:**
```javascript
// Add specifications to the created model
const specs = [
  {
    field_name: "screen_size",
    field_name_vi: "Kích thước màn hình", 
    value: "10.1",
    unit: "inch"
  },
  {
    field_name: "battery_capacity",
    field_name_vi: "Dung lượng pin",
    value: "3000", 
    unit: "mAh"
  }
];

await fetch(`/actlog/specifications/models/${newModel.id}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ specifications: specs })
});
```

### 3. **Cập nhật specification cụ thể:**
```javascript
// Update a specific specification
const specId = 123;
const updateData = {
  value: "10.5",
  unit: "inch", 
  description: "Màn hình cảm ứng full HD"
};

const response = await fetch(`/actlog/specifications/models/${newModel.id}/specifications/${specId}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updateData)
});

if (response.ok) {
  const result = await response.json();
  console.log('Updated spec:', result.data);
}
```

## 🛡️ Validation Rules

- ✅ **name**: Required, max 255 characters
- ✅ **category_id**: Required, must exist in database
- ✅ **manufacturer**: Optional, max 255 characters  
- ✅ **model_number**: Optional, max 100 characters
- ✅ **description**: Optional, max 1000 characters
- ✅ **Duplicate check**: name + manufacturer combination must be unique

## 🔧 Update Specific Specification API

### **PATCH /actlog/specifications/models/{device_model_id}/specifications/{spec_id}**

Cập nhật giá trị của một specification cụ thể mà không ảnh hưởng đến các spec khác.

#### Request:
```
PATCH /actlog/specifications/models/550e8400-e29b-41d4-a716-446655440000/specifications/123
Authorization: Bearer <your-token>
Content-Type: application/json
```

#### Body (chỉ cần field muốn update):
```json
{
  "value": "10.5",
  "numeric_value": 10.5,
  "unit": "inch",
  "description": "Màn hình cảm ứng full HD IPS",
  "field_name_vi": "Kích thước màn hình",
  "display_order": 1,
  "is_visible": true
}
```

#### Successful Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 123,
    "device_model_id": "550e8400-e29b-41d4-a716-446655440000",
    "field_name": "screen_size",
    "field_name_vi": "Kích thước màn hình",
    "value": "10.5",
    "numeric_value": 10.5,
    "unit": "inch",
    "description": "Màn hình cảm ứng full HD IPS",
    "display_order": 1,
    "is_visible": true,
    "created_at": "2025-10-27T10:00:00.000Z",
    "updated_at": "2025-10-27T14:30:00.000Z",
    "device_model": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Máy đo huyết áp Omron HEM-7156",
      "category": {
        "id": "category-uuid",
        "name": "Thiết bị đo lường y tế"
      }
    }
  },
  "message": "Specification updated successfully"
}
```

#### Error Response (400/404):
```json
{
  "success": false,
  "message": "Specification not found"
}
```

### JavaScript Example:
```javascript
async function updateSpecification(deviceModelId, specId, updateData) {
  try {
    const response = await fetch(`/actlog/specifications/models/${deviceModelId}/specifications/${specId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Specification updated:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error updating specification:', error);
    throw error;
  }
}

// Usage - chỉ update value và unit
const updatedSpec = await updateSpecification(
  "550e8400-e29b-41d4-a716-446655440000", 
  123, 
  {
    value: "12.0",
    unit: "inch"
  }
);

// Usage - update description
await updateSpecification(
  "550e8400-e29b-41d4-a716-446655440000",
  124,
  {
    description: "Mô tả chi tiết hơn về thông số này"
  }
);
```

#### Form Implementation:
```html
<form id="edit-spec-form" data-spec-id="123" data-model-id="550e8400-e29b-41d4-a716-446655440000">
  <div class="form-group">
    <label for="spec-value">Giá trị *</label>
    <input type="text" id="spec-value" name="value" required />
  </div>

  <div class="form-group">
    <label for="spec-numeric">Giá trị số</label>
    <input type="number" id="spec-numeric" name="numeric_value" step="0.01" />
  </div>

  <div class="form-group">
    <label for="spec-unit">Đơn vị</label>
    <input type="text" id="spec-unit" name="unit" />
  </div>

  <div class="form-group">
    <label for="spec-description">Mô tả</label>
    <textarea id="spec-description" name="description" rows="3"></textarea>
  </div>

  <button type="submit">Cập nhật Specification</button>
</form>

<script>
document.getElementById('edit-spec-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const specId = form.dataset.specId;
  const modelId = form.dataset.modelId;
  
  const formData = new FormData(form);
  const updateData = {};
  
  // Only include non-empty values
  for (const [key, value] of formData.entries()) {
    if (value.trim()) {
      updateData[key] = key === 'numeric_value' ? parseFloat(value) : value;
    }
  }
  
  try {
    const updated = await updateSpecification(modelId, specId, updateData);
    alert('Cập nhật thành công!');
    // Update UI or refresh page
    location.reload();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
});
</script>
```

## 🔧 Error Handling

```javascript
try {
  const model = await createDeviceModel(data);
} catch (error) {
  switch (error.message) {
    case 'Category ID and name are required':
      // Show validation errors
      break;
    case 'Device model with this name and manufacturer already exists':
      // Show duplicate error
      break;
    case 'Device category not found':
      // Invalid category ID
      break;
    default:
      // Generic error
      console.error('Unexpected error:', error);
  }
}