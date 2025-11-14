# 📊 Dashboard API Documentation

## Overview
Dashboard API provides complete CRUD operations for managing dashboards with drag-and-drop grid layout and widget configurations.

## 🎯 Features
- ✅ Grid-based drag & drop layout system
- ✅ Widget management with configurations  
- ✅ Organization-scoped security
- ✅ JSON-based flexible storage
- ✅ Real-time layout persistence

## 📋 API Endpoints

### Authentication
All endpoints require valid JWT token:
```bash
Authorization: Bearer <jwt_token>
```

---

## 📊 Dashboard Management

### 1. Get All Dashboards
```http
GET /dashboards
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Main Dashboard",
      "organization": {
        "name": "IoMT Hospital System",
        "code": "IOMT_HOSP"
      },
      "layout": [],
      "widgets": [],
      "hasLayout": true,
      "hasWidgets": true
    }
  ],
  "count": 3
}
```

### 2. Get Specific Dashboard
```http
GET /dashboards/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Main Dashboard",
    "organization": {
      "name": "IoMT Hospital System",
      "code": "IOMT_HOSP",
      "type": "hospital"
    },
    "layout": {
      "cols": 12,
      "rows": 20,
      "rowHeight": 60,
      "margin": [10, 10],
      "items": [
        {
          "i": "widget-1",
          "x": 0,
          "y": 0, 
          "w": 6,
          "h": 4,
          "minW": 3,
          "minH": 2
        }
      ]
    },
    "widgets": [
      {
        "id": "widget-1",
        "type": "device-status-card",
        "title": "Device Status",
        "config": {
          "refreshInterval": 30000,
          "showTotal": true
        }
      }
    ],
    "metadata": {
      "hasLayout": true,
      "hasWidgets": true,
      "widgetCount": 5,
      "layoutItems": 5
    }
  }
}
```

### 3. Create Dashboard
```http
POST /dashboards
```

**Request Body:**
```json
{
  "name": "New Dashboard",
  "layout": {
    "cols": 12,
    "rows": 20,
    "items": []
  },
  "widgets": []
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dashboard created successfully",
  "data": {
    "id": "new-uuid",
    "name": "New Dashboard",
    "organization": {...},
    "layout": {...},
    "widgets": []
  }
}
```

### 4. Update Dashboard Layout (Drag & Drop)
```http
PUT /dashboards/:id/layout
```

**Request Body:**
```json
{
  "layout": {
    "cols": 12,
    "rows": 20,
    "rowHeight": 60,
    "margin": [10, 10],
    "items": [
      {
        "i": "widget-1",
        "x": 2,
        "y": 1,
        "w": 6,
        "h": 4,
        "minW": 3,
        "minH": 2,
        "isDraggable": true,
        "isResizable": true
      }
    ]
  }
}
```

### 5. Update Dashboard Widgets
```http
PUT /dashboards/:id/widgets
```

**Request Body:**
```json
{
  "widgets": [
    {
      "id": "widget-1",
      "type": "device-chart",
      "title": "Device Metrics",
      "config": {
        "chartType": "line",
        "refreshInterval": 60000,
        "showLegend": true,
        "metrics": ["voltage", "current"]
      }
    }
  ]
}
```

### 6. Update Complete Dashboard
```http
PUT /dashboards/:id
```

**Request Body:**
```json
{
  "name": "Updated Dashboard Name",
  "layout": {...},
  "widgets": [...]
}
```

### 7. Delete Dashboard
```http
DELETE /dashboards/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Dashboard deleted successfully",
  "data": {
    "deletedId": "uuid",
    "deletedName": "Dashboard Name"
  }
}
```

---

## 🎛️ Widget Types

### Device Status Card
```json
{
  "type": "device-status-card",
  "config": {
    "showTotal": true,
    "showByStatus": true,
    "refreshInterval": 30000
  }
}
```

### Metrics Chart
```json
{
  "type": "metrics-chart",
  "config": {
    "chartType": "line|bar|area",
    "timeRange": "1h|24h|7d|30d",
    "metrics": ["voltage", "current", "power"],
    "showThreshold": true,
    "refreshInterval": 60000
  }
}
```

### Device Grid View
```json
{
  "type": "device-grid-view", 
  "config": {
    "columns": ["name", "status", "last_update"],
    "sortBy": "name",
    "pagination": true,
    "pageSize": 20
  }
}
```

### Alert Summary
```json
{
  "type": "alert-summary-card",
  "config": {
    "showBySeverity": true,
    "filterByStatus": ["active", "acknowledged"],
    "refreshInterval": 15000
  }
}
```

---

## 🏗️ Layout System

### Grid Configuration
```json
{
  "cols": 12,           // Number of columns
  "rows": 20,           // Number of rows (optional)
  "rowHeight": 60,      // Height of each row in pixels
  "margin": [10, 10],   // Margin [x, y]
  "containerPadding": [10, 10], // Padding [x, y]
  "compactType": "vertical"     // Compaction direction
}
```

### Layout Item Properties
```json
{
  "i": "unique-widget-id",    // Must match widget.id
  "x": 0,                     // X position in grid units
  "y": 0,                     // Y position in grid units  
  "w": 6,                     // Width in grid units
  "h": 4,                     // Height in grid units
  "minW": 2,                  // Minimum width
  "minH": 2,                  // Minimum height
  "maxW": 12,                 // Maximum width (optional)
  "maxH": 8,                  // Maximum height (optional)
  "isDraggable": true,        // Can be dragged
  "isResizable": true,        // Can be resized
  "static": false             // Fixed position
}
```

---

## 🔒 Security & Permissions

### Organization Scoping
- Users can only access dashboards within their organization
- All operations are automatically scoped by `user.organization_id`

### Required Permissions
- `dashboard.read` - View dashboards
- `dashboard.create` - Create new dashboards  
- `dashboard.update` - Modify existing dashboards
- `dashboard.delete` - Delete dashboards

---

## 🚀 Testing with Thunder Client/Postman

### 1. Setup Environment
```bash
# Base URL
{{baseUrl}} = http://localhost:3030

# Get JWT Token first
POST {{baseUrl}}/auth/login
{
  "username": "superadmin",
  "password": "SuperAdmin@2024!"
}
```

### 2. Test Dashboard Creation
```bash
POST {{baseUrl}}/dashboards
Authorization: Bearer {{token}}
{
  "name": "Test Dashboard",
  "layout": {
    "cols": 12,
    "rows": 16,
    "items": []
  },
  "widgets": []
}
```

### 3. Test Layout Update (Simulate Drag & Drop)
```bash
PUT {{baseUrl}}/dashboards/{{dashboardId}}/layout
Authorization: Bearer {{token}}
{
  "layout": {
    "cols": 12,
    "rows": 16,
    "items": [
      {
        "i": "widget-1",
        "x": 0, "y": 0, "w": 6, "h": 4,
        "minW": 3, "minH": 2
      },
      {
        "i": "widget-2", 
        "x": 6, "y": 0, "w": 6, "h": 4,
        "minW": 3, "minH": 2
      }
    ]
  }
}
```

### 4. Seed Sample Dashboards
```bash
node scripts/database/seed-dashboards.js
```

---

## 💡 Frontend Integration Tips

### React Grid Layout Integration
```javascript
import GridLayout from 'react-grid-layout';

const Dashboard = ({ dashboardId }) => {
  const [layout, setLayout] = useState([]);
  const [widgets, setWidgets] = useState([]);

  // Save layout on change
  const onLayoutChange = (newLayout) => {
    setLayout(newLayout);
    
    // Auto-save to backend
    fetch(`/dashboards/${dashboardId}/layout`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        layout: {
          cols: 12,
          rows: 20,
          items: newLayout
        }
      })
    });
  };

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={60}
      width={1200}
      onLayoutChange={onLayoutChange}
      isDraggable={true}
      isResizable={true}
    >
      {widgets.map(widget => (
        <div key={widget.id}>
          <WidgetComponent widget={widget} />
        </div>
      ))}
    </GridLayout>
  );
};
```

### Vue Grid Layout Integration
```javascript
<template>
  <grid-layout
    :layout="layout"
    :col-num="12"
    :row-height="60"
    :is-draggable="true"
    :is-resizable="true"
    @layout-updated="onLayoutChange"
  >
    <grid-item
      v-for="widget in widgets"
      :key="widget.id"
      :x="widget.x"
      :y="widget.y" 
      :w="widget.w"
      :h="widget.h"
      :i="widget.id"
    >
      <WidgetComponent :widget="widget" />
    </grid-item>
  </grid-layout>
</template>
```

---

## 📊 Database Schema

The dashboard data is stored in the existing `dashboards` table:

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  layout_config TEXT,    -- JSON string of grid layout
  widget_config TEXT     -- JSON string of widget configurations
);
```

**Ready to build drag & drop dashboard! 🎉**