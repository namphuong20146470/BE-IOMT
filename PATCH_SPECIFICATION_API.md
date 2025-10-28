# PATCH Specification Update API - Complete Guide

## 🎯 Mục đích
Cập nhật giá trị cụ thể của một specification mà không ảnh hưởng đến các specifications khác trong cùng device model.

## 🚀 Endpoint

### **PATCH /actlog/specifications/models/{device_model_id}/specifications/{spec_id}**

Cập nhật các trường cụ thể của một specification duy nhất.

## 📝 API Details

### URL Parameters
- `device_model_id` (uuid): ID của device model chứa specification
- `spec_id` (integer): ID của specification cần cập nhật

### Request Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Request Body (optional fields)
Chỉ cần gửi các field muốn cập nhật:

```json
{
  "value": "string",           // Giá trị specification
  "numeric_value": 123.45,     // Giá trị số (cho tính toán)
  "unit": "string",            // Đơn vị đo
  "description": "string",     // Mô tả chi tiết  
  "field_name_vi": "string",   // Tên tiếng Việt
  "display_order": 1,          // Thứ tự hiển thị
  "is_visible": true           // Có hiển thị công khai không
}
```

## ✅ Success Response (200 OK)

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
    "description": "Màn hình cảm ứng IPS full HD",
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

## ❌ Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "message": "At least one field must be provided for update"
}
```

### 404 Not Found - Specification không tồn tại
```json
{
  "success": false,
  "message": "Specification not found"
}
```

### 403 Forbidden - Specification không thuộc device model
```json
{
  "success": false,
  "message": "Specification does not belong to the specified device model"
}
```

## 🎯 Use Cases

### 1. **Cập nhật giá trị đơn lẻ**
```javascript
// Chỉ thay đổi value
const response = await fetch('/actlog/specifications/models/model-uuid/specifications/123', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    value: "12.0"
  })
});
```

### 2. **Cập nhật nhiều trường cùng lúc**
```javascript
// Thay đổi value, unit và description
await fetch('/actlog/specifications/models/model-uuid/specifications/123', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    value: "12.5",
    unit: "cm",
    description: "Kích thước màn hình đo theo đường chéo"
  })
});
```

### 3. **Cập nhật thứ tự hiển thị**
```javascript
// Thay đổi display_order
await fetch('/actlog/specifications/models/model-uuid/specifications/123', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    display_order: 5
  })
});
```

### 4. **Ẩn/hiện specification**
```javascript
// Ẩn specification khỏi giao diện công khai
await fetch('/actlog/specifications/models/model-uuid/specifications/123', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    is_visible: false
  })
});
```

## 🔧 JavaScript Implementation

### Basic Function
```javascript
async function updateSpecification(deviceModelId, specId, updateData) {
  try {
    const response = await fetch(
      `/actlog/specifications/models/${deviceModelId}/specifications/${specId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Update failed');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error updating specification:', error);
    throw error;
  }
}
```

### React Hook
```javascript
import { useState } from 'react';

const useUpdateSpecification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateSpec = async (deviceModelId, specId, updateData) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedSpec = await updateSpecification(deviceModelId, specId, updateData);
      return updatedSpec;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateSpec, loading, error };
};

// Usage in component
const EditSpecificationForm = ({ deviceModelId, specification }) => {
  const { updateSpec, loading, error } = useUpdateSpecification();
  const [value, setValue] = useState(specification.value);
  const [unit, setUnit] = useState(specification.unit);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const updateData = {};
    if (value !== specification.value) updateData.value = value;
    if (unit !== specification.unit) updateData.unit = unit;
    
    if (Object.keys(updateData).length === 0) {
      alert('No changes to save');
      return;
    }

    try {
      const updated = await updateSpec(deviceModelId, specification.id, updateData);
      console.log('Updated:', updated);
      // Show success message or redirect
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Giá trị"
      />
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        placeholder="Đơn vị"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Đang cập nhật...' : 'Cập nhật'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
};
```

## 🎨 HTML Form Example

```html
<form class="edit-spec-form" data-model-id="model-uuid" data-spec-id="123">
  <div class="form-row">
    <div class="form-group">
      <label for="spec-value">Giá trị *</label>
      <input type="text" id="spec-value" name="value" required />
    </div>
    
    <div class="form-group">
      <label for="spec-unit">Đơn vị</label>
      <input type="text" id="spec-unit" name="unit" />
    </div>
  </div>

  <div class="form-group">
    <label for="spec-numeric">Giá trị số</label>
    <input type="number" id="spec-numeric" name="numeric_value" step="0.01" />
    <small>Dùng cho tính toán, sắp xếp</small>
  </div>

  <div class="form-group">
    <label for="spec-description">Mô tả</label>
    <textarea id="spec-description" name="description" rows="3"></textarea>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="spec-order">Thứ tự hiển thị</label>
      <input type="number" id="spec-order" name="display_order" min="0" />
    </div>
    
    <div class="form-group">
      <label>
        <input type="checkbox" name="is_visible" value="true" />
        Hiển thị công khai
      </label>
    </div>
  </div>

  <div class="form-actions">
    <button type="submit">Cập nhật</button>
    <button type="button" onclick="resetForm()">Hủy</button>
  </div>
</form>

<script>
document.querySelector('.edit-spec-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const modelId = form.dataset.modelId;
  const specId = form.dataset.specId;
  
  const formData = new FormData(form);
  const updateData = {};
  
  // Only include changed/non-empty values
  for (const [key, value] of formData.entries()) {
    if (key === 'is_visible') {
      updateData[key] = true;
    } else if (key === 'numeric_value' && value) {
      updateData[key] = parseFloat(value);
    } else if (key === 'display_order' && value) {
      updateData[key] = parseInt(value);
    } else if (value.trim()) {
      updateData[key] = value.trim();
    }
  }
  
  // Handle unchecked checkbox
  if (!formData.has('is_visible')) {
    updateData.is_visible = false;
  }
  
  if (Object.keys(updateData).length === 0) {
    alert('Không có thay đổi nào để lưu');
    return;
  }
  
  try {
    const updated = await updateSpecification(modelId, specId, updateData);
    alert('Cập nhật thành công!');
    
    // Update form with returned values
    if (updated.value) document.getElementById('spec-value').value = updated.value;
    if (updated.unit) document.getElementById('spec-unit').value = updated.unit;
    // ... update other fields
    
  } catch (error) {
    alert('Lỗi cập nhật: ' + error.message);
  }
});

function resetForm() {
  document.querySelector('.edit-spec-form').reset();
}
</script>
```

## 🔍 Validation Rules

| Field | Type | Max Length | Required | Notes |
|-------|------|------------|----------|-------|
| `value` | string | 255 chars | No | Giá trị chính của specification |
| `numeric_value` | number | - | No | Để tính toán, sắp xếp |
| `unit` | string | 50 chars | No | Đơn vị đo lường |
| `description` | string | 500 chars | No | Mô tả chi tiết |
| `field_name_vi` | string | 100 chars | No | Tên tiếng Việt |
| `display_order` | integer | ≥ 0 | No | Thứ tự hiển thị |
| `is_visible` | boolean | - | No | Hiển thị công khai |

## 🚨 Error Handling

```javascript
try {
  const updated = await updateSpecification(modelId, specId, updateData);
} catch (error) {
  switch (error.message) {
    case 'Specification not found':
      // Specification đã bị xóa hoặc không tồn tại
      showError('Thông số không tồn tại');
      break;
      
    case 'Specification does not belong to the specified device model':
      // Security error - spec không thuộc model này
      showError('Không có quyền cập nhật thông số này');
      break;
      
    case 'At least one field must be provided for update':
      // Không có dữ liệu để cập nhật
      showError('Vui lòng nhập ít nhất một trường để cập nhật');
      break;
      
    case 'Value must be a string with maximum 255 characters':
      // Validation error
      showError('Giá trị quá dài (tối đa 255 ký tự)');
      break;
      
    default:
      // Generic error
      showError('Có lỗi xảy ra: ' + error.message);
  }
}
```

## 🧪 Testing

Chạy test script:
```bash
node test-patch-specification.js
```

Test sẽ kiểm tra:
- ✅ Cập nhật từng field riêng lẻ
- ✅ Cập nhật nhiều fields cùng lúc  
- ✅ Validation errors
- ✅ Security (spec thuộc đúng model)
- ✅ Data types và length validation
- ✅ Response format consistency

## 📋 Workflow Integration

### 1. **Inline Editing**
```javascript
// Click vào specification để edit inline
document.querySelectorAll('.spec-value').forEach(element => {
  element.addEventListener('click', (e) => {
    const specId = e.target.dataset.specId;
    const modelId = e.target.dataset.modelId;
    const currentValue = e.target.textContent;
    
    // Tạo input field inline
    const input = document.createElement('input');
    input.value = currentValue;
    input.addEventListener('blur', async () => {
      if (input.value !== currentValue) {
        try {
          await updateSpecification(modelId, specId, { value: input.value });
          e.target.textContent = input.value;
        } catch (error) {
          alert('Lỗi cập nhật: ' + error.message);
          e.target.textContent = currentValue; // Revert
        }
      }
      e.target.style.display = 'inline';
      input.remove();
    });
    
    e.target.style.display = 'none';
    e.target.parentNode.insertBefore(input, e.target);
    input.focus();
  });
});
```

### 2. **Batch Updates**
```javascript
// Cập nhật nhiều specs cùng lúc
const batchUpdateSpecs = async (modelId, updates) => {
  const promises = updates.map(({ specId, data }) => 
    updateSpecification(modelId, specId, data)
  );
  
  try {
    const results = await Promise.all(promises);
    console.log(`Updated ${results.length} specifications`);
    return results;
  } catch (error) {
    console.error('Batch update failed:', error);
    throw error;
  }
};

// Usage
await batchUpdateSpecs('model-uuid', [
  { specId: 123, data: { value: "10.5" } },
  { specId: 124, data: { value: "3000", unit: "mAh" } },
  { specId: 125, data: { is_visible: false } }
]);
```

**API PATCH sẵn sàng sử dụng! 🚀**