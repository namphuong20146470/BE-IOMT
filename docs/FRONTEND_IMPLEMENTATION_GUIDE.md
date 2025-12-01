# PDU Management System - Frontend Implementation Guide

## 🎯 Overview
Hướng dẫn này cung cấp thông tin chi tiết để Frontend team implement PDU Management System với React/Vue.js/Angular.

---

## 📡 API Base Configuration

### Base URL & Authentication
```javascript
const API_CONFIG = {
  baseURL: 'http://localhost:3030/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

// Authentication interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/auth/refresh', {
            refresh_token: refreshToken
          });
          localStorage.setItem('access_token', response.data.access_token);
          return axios.request(error.config);
        } catch (refreshError) {
          // Redirect to login
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🔐 Permission Management

### Required Permissions
```javascript
const PERMISSIONS = {
  PDU: {
    LIST: 'device.list',
    READ: 'device.read', 
    CREATE: 'device.create',
    UPDATE: 'device.update',
    DELETE: 'device.delete',
    MANAGE: 'device.manage'
  },
  OUTLET: {
    READ: 'device.read',
    UPDATE: 'device.update', 
    CONFIGURE: 'device.configure',
    MONITOR: 'device.monitor',
    MANAGE: 'device.manage'
  },
  SYSTEM: {
    ADMIN: 'system.admin'
  }
};

// Permission checker utility
const hasPermission = (userPermissions, requiredPermissions) => {
  return requiredPermissions.some(permission => 
    userPermissions.includes(permission) || 
    userPermissions.includes(PERMISSIONS.SYSTEM.ADMIN)
  );
};

// Component permission wrapper
const withPermission = (Component, requiredPermissions) => {
  return (props) => {
    const { userPermissions } = useAuth();
    
    if (!hasPermission(userPermissions, requiredPermissions)) {
      return <AccessDenied />;
    }
    
    return <Component {...props} />;
  };
};
```

---

## 📊 API Service Layer

### PDU Service
```javascript
class PDUService {
  // Get all PDUs with filtering
  static async getPDUs(params = {}) {
    const queryString = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 20,
      sort_by: params.sortBy || 'name',
      sort_order: params.sortOrder || 'asc',
      include_stats: params.includeStats || false,
      ...params.filters
    }).toString();
    
    const response = await axios.get(`/pdus?${queryString}`);
    return response.data;
  }

  // Get PDU by ID
  static async getPDU(id) {
    const response = await axios.get(`/pdus/${id}`);
    return response.data;
  }

  // Create new PDU
  static async createPDU(data) {
    const response = await axios.post('/pdus', data);
    return response.data;
  }

  // Update PDU
  static async updatePDU(id, data) {
    const response = await axios.put(`/pdus/${id}`, data);
    return response.data;
  }

  // Delete PDU
  static async deletePDU(id) {
    const response = await axios.delete(`/pdus/${id}`);
    return response.data;
  }

  // Get PDU outlets
  static async getPDUOutlets(id, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/pdus/${id}/outlets?${queryString}`);
    return response.data;
  }

  // Get PDU statistics
  static async getPDUStatistics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/pdus/statistics?${queryString}`);
    return response.data;
  }
}
```

### Outlet Service
```javascript
class OutletService {
  // Get all outlets
  static async getOutlets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/outlets?${queryString}`);
    return response.data;
  }

  // Get outlet by ID
  static async getOutlet(id, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/outlets/${id}?${queryString}`);
    return response.data;
  }

  // Update outlet configuration
  static async updateOutlet(id, data) {
    const response = await axios.put(`/outlets/${id}/configuration`, data);
    return response.data;
  }

  // Assign device to outlet
  static async assignDevice(outletId, deviceId, notes = '') {
    const response = await axios.post(`/outlets/${outletId}/assign-device`, {
      device_id: deviceId,
      notes
    });
    return response.data;
  }

  // Unassign device from outlet
  static async unassignDevice(outletId, notes = '') {
    const response = await axios.delete(`/outlets/${outletId}/unassign-device`, {
      data: { notes }
    });
    return response.data;
  }

  // Control outlet (on/off/reset)
  static async controlOutlet(outletId, action, force = false) {
    const response = await axios.post(`/outlets/${outletId}/control`, {
      action, // 'turn_on', 'turn_off', 'reset', 'toggle'
      force
    });
    return response.data;
  }

  // Get outlet real-time data
  static async getOutletData(outletId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/outlets/${outletId}/real-time-data?${queryString}`);
    return response.data;
  }

  // Bulk operations
  static async bulkAssignDevices(assignments) {
    const response = await axios.post('/outlets/bulk-assign', {
      assignments
    });
    return response.data;
  }

  // Transfer device between outlets
  static async transferDevice(fromOutletId, toOutletId, notes = '') {
    const response = await axios.post('/outlets/transfer', {
      from_outlet_id: fromOutletId,
      to_outlet_id: toOutletId,
      notes
    });
    return response.data;
  }
}
```

### Device Assignment Service
```javascript
class DeviceAssignmentService {
  // Validate assignment
  static async validateAssignment(outletId, deviceId) {
    const response = await axios.post('/device-assignment/validate', {
      outlet_id: outletId,
      device_id: deviceId
    });
    return response.data;
  }

  // Validate bulk assignments
  static async validateBulkAssignments(assignments) {
    const response = await axios.post('/device-assignment/validate-bulk', {
      assignments
    });
    return response.data;
  }

  // Get available devices/outlets
  static async getAvailable(resourceType = 'devices', params = {}) {
    const queryString = new URLSearchParams({
      resource_type: resourceType,
      ...params
    }).toString();
    const response = await axios.get(`/device-assignment/available?${queryString}`);
    return response.data;
  }

  // Get assignment history
  static async getAssignmentHistory(id, resourceType = 'device', limit = 50) {
    const queryString = new URLSearchParams({
      resource_type: resourceType,
      limit
    }).toString();
    const response = await axios.get(`/device-assignment/history/${id}?${queryString}`);
    return response.data;
  }

  // Get assignment summary
  static async getAssignmentSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`/device-assignment/summary?${queryString}`);
    return response.data;
  }
}
```

---

## 🎨 React Components Examples

### PDU List Component
```jsx
import React, { useState, useEffect } from 'react';
import { PDUService } from '../services/PDUService';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const PDUList = () => {
  const [pdus, setPDUs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    status: '',
    organization_id: ''
  });

  const { userPermissions } = useAuth();

  useEffect(() => {
    loadPDUs();
  }, [pagination.page, filters]);

  const loadPDUs = async () => {
    try {
      setLoading(true);
      const response = await PDUService.getPDUs({
        page: pagination.page,
        limit: pagination.limit,
        filters,
        includeStats: true
      });
      
      setPDUs(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination.total,
        total_pages: response.pagination.total_pages
      }));
    } catch (error) {
      console.error('Error loading PDUs:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pduId) => {
    if (!hasPermission(userPermissions, [PERMISSIONS.PDU.DELETE])) {
      alert('Bạn không có quyền xóa PDU');
      return;
    }

    if (confirm('Bạn có chắc chắn muốn xóa PDU này?')) {
      try {
        await PDUService.deletePDU(pduId);
        loadPDUs(); // Reload list
        // Show success notification
      } catch (error) {
        console.error('Error deleting PDU:', error);
        // Show error notification
      }
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="pdu-list">
      <div className="header">
        <h1>PDU Management</h1>
        {hasPermission(userPermissions, [PERMISSIONS.PDU.CREATE]) && (
          <button onClick={() => navigate('/pdus/create')}>
            Create New PDU
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search PDUs..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="standard">Standard</option>
          <option value="smart">Smart</option>
          <option value="switched">Switched</option>
          <option value="metered">Metered</option>
        </select>
        {/* Add more filters as needed */}
      </div>

      {/* PDU Grid */}
      <div className="pdu-grid">
        {pdus.map(pdu => (
          <div key={pdu.id} className="pdu-card">
            <div className="pdu-header">
              <h3>{pdu.name}</h3>
              <span className={`status ${pdu.status}`}>{pdu.status}</span>
            </div>
            <div className="pdu-details">
              <p><strong>Code:</strong> {pdu.code}</p>
              <p><strong>Type:</strong> {pdu.type}</p>
              <p><strong>Location:</strong> {pdu.location}</p>
              <p><strong>Outlets:</strong> {pdu.outlet_count}</p>
              <p><strong>Power:</strong> {pdu.max_power_watts}W</p>
            </div>
            <div className="pdu-actions">
              <button onClick={() => navigate(`/pdus/${pdu.id}`)}>
                View Details
              </button>
              {hasPermission(userPermissions, [PERMISSIONS.PDU.UPDATE]) && (
                <button onClick={() => navigate(`/pdus/${pdu.id}/edit`)}>
                  Edit
                </button>
              )}
              {hasPermission(userPermissions, [PERMISSIONS.PDU.DELETE]) && (
                <button 
                  onClick={() => handleDelete(pdu.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button 
          disabled={pagination.page === 1}
          onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.total_pages} 
          (Total: {pagination.total} items)
        </span>
        <button 
          disabled={pagination.page === pagination.total_pages}
          onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PDUList;
```

### PDU Form Component
```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PDUService } from '../services/PDUService';

const PDUForm = () => {
  const { id } = useParams(); // For edit mode
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'standard',
    organization_id: '',
    department_id: '',
    location: '',
    description: '',
    outlet_count: 8,
    voltage_rating: 220,
    max_current: 16,
    max_power_watts: 3520,
    manufacturer: '',
    model: '',
    serial_number: '',
    ip_address: '',
    installation_date: '',
    outlets_config: []
  });

  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    loadInitialData();
    if (isEdit) {
      loadPDU();
    }
  }, [id]);

  const loadInitialData = async () => {
    // Load organizations and departments for dropdowns
    // Implementation depends on your organization/department APIs
  };

  const loadPDU = async () => {
    try {
      const response = await PDUService.getPDU(id);
      setFormData(response.data);
    } catch (error) {
      console.error('Error loading PDU:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await PDUService.updatePDU(id, formData);
      } else {
        await PDUService.createPDU(formData);
      }
      navigate('/pdus');
      // Show success notification
    } catch (error) {
      console.error('Error saving PDU:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateOutletConfig = () => {
    const outlets = [];
    for (let i = 1; i <= formData.outlet_count; i++) {
      outlets.push({
        outlet_number: i,
        name: `Outlet ${i}`,
        is_enabled: true,
        max_power_watts: Math.floor(formData.max_power_watts / formData.outlet_count)
      });
    }
    setFormData(prev => ({ ...prev, outlets_config: outlets }));
  };

  return (
    <div className="pdu-form">
      <div className="header">
        <h1>{isEdit ? 'Edit PDU' : 'Create New PDU'}</h1>
        <button onClick={() => navigate('/pdus')}>Back to List</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <label>
                Name *
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </label>
              <label>
                Code *
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Type *
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  required
                >
                  <option value="standard">Standard</option>
                  <option value="smart">Smart</option>
                  <option value="switched">Switched</option>
                  <option value="metered">Metered</option>
                </select>
              </label>
              <label>
                Organization *
                <select
                  value={formData.organization_id}
                  onChange={(e) => handleInputChange('organization_id', e.target.value)}
                  required
                >
                  <option value="">Select Organization</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="form-section">
            <h3>Technical Specifications</h3>
            <div className="form-row">
              <label>
                Outlet Count *
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={formData.outlet_count}
                  onChange={(e) => handleInputChange('outlet_count', parseInt(e.target.value))}
                  required
                />
              </label>
              <label>
                Voltage Rating (V) *
                <input
                  type="number"
                  step="0.1"
                  value={formData.voltage_rating}
                  onChange={(e) => handleInputChange('voltage_rating', parseFloat(e.target.value))}
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Max Current (A) *
                <input
                  type="number"
                  step="0.1"
                  value={formData.max_current}
                  onChange={(e) => handleInputChange('max_current', parseFloat(e.target.value))}
                  required
                />
              </label>
              <label>
                Max Power (W)
                <input
                  type="number"
                  value={formData.max_power_watts}
                  onChange={(e) => handleInputChange('max_power_watts', parseInt(e.target.value))}
                />
              </label>
            </div>
          </div>

          {/* Additional Information */}
          <div className="form-section">
            <h3>Additional Information</h3>
            <div className="form-row">
              <label>
                Location
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
              </label>
              <label>
                IP Address
                <input
                  type="text"
                  pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                  value={formData.ip_address}
                  onChange={(e) => handleInputChange('ip_address', e.target.value)}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </label>
          </div>

          {/* Outlets Configuration */}
          <div className="form-section">
            <h3>Outlets Configuration</h3>
            <button 
              type="button" 
              onClick={generateOutletConfig}
              className="generate-outlets-btn"
            >
              Generate Outlet Configuration
            </button>
            {formData.outlets_config.length > 0 && (
              <div className="outlets-grid">
                {formData.outlets_config.map((outlet, index) => (
                  <div key={index} className="outlet-config">
                    <h4>Outlet {outlet.outlet_number}</h4>
                    <label>
                      Name
                      <input
                        type="text"
                        value={outlet.name}
                        onChange={(e) => {
                          const updated = [...formData.outlets_config];
                          updated[index].name = e.target.value;
                          handleInputChange('outlets_config', updated);
                        }}
                      />
                    </label>
                    <label>
                      Max Power (W)
                      <input
                        type="number"
                        value={outlet.max_power_watts}
                        onChange={(e) => {
                          const updated = [...formData.outlets_config];
                          updated[index].max_power_watts = parseInt(e.target.value);
                          handleInputChange('outlets_config', updated);
                        }}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={outlet.is_enabled}
                        onChange={(e) => {
                          const updated = [...formData.outlets_config];
                          updated[index].is_enabled = e.target.checked;
                          handleInputChange('outlets_config', updated);
                        }}
                      />
                      Enabled
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/pdus')}>
            Cancel
          </button>
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update PDU' : 'Create PDU')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PDUForm;
```

### Outlet Control Component
```jsx
import React, { useState, useEffect } from 'react';
import { OutletService } from '../services/OutletService';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const OutletControl = ({ outletId }) => {
  const [outlet, setOutlet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState(false);
  const [realTimeData, setRealTimeData] = useState(null);

  const { userPermissions } = useAuth();

  useEffect(() => {
    loadOutlet();
    loadRealTimeData();
    
    // Set up real-time data polling
    const interval = setInterval(loadRealTimeData, 5000);
    return () => clearInterval(interval);
  }, [outletId]);

  const loadOutlet = async () => {
    try {
      const response = await OutletService.getOutlet(outletId, {
        include_device: true,
        include_data: true
      });
      setOutlet(response.data);
    } catch (error) {
      console.error('Error loading outlet:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeData = async () => {
    try {
      const response = await OutletService.getOutletData(outletId, {
        last_minutes: 5
      });
      setRealTimeData(response.data);
    } catch (error) {
      console.error('Error loading real-time data:', error);
    }
  };

  const handleControl = async (action) => {
    if (!hasPermission(userPermissions, [PERMISSIONS.OUTLET.CONFIGURE])) {
      alert('Bạn không có quyền điều khiển outlet');
      return;
    }

    setControlling(true);
    try {
      await OutletService.controlOutlet(outletId, action);
      await loadOutlet(); // Refresh outlet status
      // Show success notification
    } catch (error) {
      console.error('Error controlling outlet:', error);
      // Show error notification
    } finally {
      setControlling(false);
    }
  };

  if (loading) return <div>Loading outlet...</div>;
  if (!outlet) return <div>Outlet not found</div>;

  return (
    <div className="outlet-control">
      <div className="outlet-header">
        <h3>Outlet {outlet.outlet_number}</h3>
        <span className={`status ${outlet.status}`}>
          {outlet.status}
        </span>
      </div>

      {/* Real-time Data */}
      {realTimeData && (
        <div className="real-time-data">
          <h4>Real-time Data</h4>
          <div className="data-grid">
            <div className="data-item">
              <span className="label">Power</span>
              <span className="value">{realTimeData.power}W</span>
            </div>
            <div className="data-item">
              <span className="label">Voltage</span>
              <span className="value">{realTimeData.voltage}V</span>
            </div>
            <div className="data-item">
              <span className="label">Current</span>
              <span className="value">{realTimeData.current}A</span>
            </div>
            <div className="data-item">
              <span className="label">Last Update</span>
              <span className="value">
                {new Date(realTimeData.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Assigned Device */}
      {outlet.assigned_device && (
        <div className="assigned-device">
          <h4>Assigned Device</h4>
          <div className="device-info">
            <p><strong>Serial:</strong> {outlet.assigned_device.serial_number}</p>
            <p><strong>Model:</strong> {outlet.assigned_device.model}</p>
            <p><strong>Status:</strong> {outlet.assigned_device.status}</p>
          </div>
        </div>
      )}

      {/* Control Actions */}
      {hasPermission(userPermissions, [PERMISSIONS.OUTLET.CONFIGURE]) && (
        <div className="control-actions">
          <h4>Control Actions</h4>
          <div className="action-buttons">
            <button
              onClick={() => handleControl('turn_on')}
              disabled={controlling || outlet.status === 'active'}
              className="btn-success"
            >
              Turn On
            </button>
            <button
              onClick={() => handleControl('turn_off')}
              disabled={controlling || outlet.status === 'inactive'}
              className="btn-danger"
            >
              Turn Off
            </button>
            <button
              onClick={() => handleControl('toggle')}
              disabled={controlling}
              className="btn-info"
            >
              Toggle
            </button>
            <button
              onClick={() => handleControl('reset')}
              disabled={controlling}
              className="btn-warning"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Outlet Configuration */}
      <div className="outlet-config">
        <h4>Configuration</h4>
        <div className="config-grid">
          <div className="config-item">
            <span className="label">Max Power</span>
            <span className="value">{outlet.max_power_watts}W</span>
          </div>
          <div className="config-item">
            <span className="label">Voltage Rating</span>
            <span className="value">{outlet.voltage_rating}V</span>
          </div>
          <div className="config-item">
            <span className="label">Connector Type</span>
            <span className="value">{outlet.connector_type || 'N/A'}</span>
          </div>
          <div className="config-item">
            <span className="label">Enabled</span>
            <span className="value">{outlet.is_enabled ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutletControl;
```

---

## 📡 WebSocket Integration

### Real-time Data Setup
```javascript
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    }
  }

  subscribeToOutlet(outletId, callback) {
    this.subscribers.set(`outlet_${outletId}`, callback);
    this.send({
      type: 'subscribe_outlet',
      outlet_id: outletId
    });
  }

  subscribeToPDU(pduId, callback) {
    this.subscribers.set(`pdu_${pduId}`, callback);
    this.send({
      type: 'subscribe_pdu',
      pdu_id: pduId
    });
  }

  unsubscribe(key) {
    this.subscribers.delete(key);
  }

  handleMessage(message) {
    switch (message.type) {
      case 'outlet_data':
        const outletCallback = this.subscribers.get(`outlet_${message.outlet_id}`);
        if (outletCallback) outletCallback(message);
        break;
      
      case 'device_assigned':
        // Handle device assignment updates
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

// Usage in React component
const useWebSocket = () => {
  const wsManager = useRef(new WebSocketManager());

  useEffect(() => {
    wsManager.current.connect();
    return () => wsManager.current.ws?.close();
  }, []);

  return wsManager.current;
};
```

---

## 🎨 CSS Styling Guidelines

### Component Styles
```css
/* PDU List Styles */
.pdu-list {
  padding: 20px;
}

.pdu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.pdu-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.3s ease;
}

.pdu-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.pdu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status.active { background: #d4edda; color: #155724; }
.status.inactive { background: #f8d7da; color: #721c24; }
.status.maintenance { background: #fff3cd; color: #856404; }

/* Form Styles */
.pdu-form {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.form-grid {
  display: grid;
  gap: 30px;
}

.form-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 15px;
}

.form-row label {
  display: flex;
  flex-direction: column;
  font-weight: bold;
  margin-bottom: 10px;
}

.form-row input,
.form-row select,
.form-row textarea {
  margin-top: 5px;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

/* Outlet Control Styles */
.outlet-control {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin: 10px;
  border: 1px solid #ddd;
}

.real-time-data {
  margin: 20px 0;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 10px;
}

.data-item {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.data-item .label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.data-item .value {
  display: block;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-success { background: #28a745; color: white; }
.btn-danger { background: #dc3545; color: white; }
.btn-info { background: #17a2b8; color: white; }
.btn-warning { background: #ffc107; color: #212529; }

.action-buttons button:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.action-buttons button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .pdu-grid {
    grid-template-columns: 1fr;
  }
  
  .data-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .action-buttons {
    justify-content: center;
  }
}
```

---

## 🔍 Error Handling

### Global Error Handler
```javascript
const errorHandler = {
  // Handle API errors
  handleAPIError: (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - redirect to login
          localStorage.removeItem('access_token');
          window.location.href = '/login';
          break;
          
        case 403:
          // Forbidden - show permission denied
          return {
            type: 'permission',
            message: 'Bạn không có quyền thực hiện hành động này'
          };
          
        case 404:
          return {
            type: 'not_found',
            message: 'Không tìm thấy tài nguyên yêu cầu'
          };
          
        case 422:
          // Validation errors
          return {
            type: 'validation',
            message: 'Dữ liệu không hợp lệ',
            errors: data.errors || []
          };
          
        case 500:
          return {
            type: 'server',
            message: 'Lỗi server. Vui lòng thử lại sau'
          };
          
        default:
          return {
            type: 'unknown',
            message: data.message || 'Có lỗi xảy ra. Vui lòng thử lại'
          };
      }
    } else if (error.request) {
      // Network error
      return {
        type: 'network',
        message: 'Không thể kết nối tới server. Kiểm tra kết nối mạng'
      };
    } else {
      return {
        type: 'unknown',
        message: 'Có lỗi xảy ra. Vui lòng thử lại'
      };
    }
  },

  // Show notification
  showError: (error) => {
    const errorInfo = this.handleAPIError(error);
    
    // Use your notification system (toast, modal, etc.)
    if (errorInfo.type === 'validation' && errorInfo.errors.length > 0) {
      // Show validation errors
      errorInfo.errors.forEach(err => {
        console.error(`${err.field}: ${err.message}`);
      });
    } else {
      console.error(errorInfo.message);
    }
    
    return errorInfo;
  }
};
```

---

## 📱 Mobile Responsiveness

### Mobile-First Approach
```css
/* Mobile-first responsive design */

/* Base styles (mobile) */
.pdu-list {
  padding: 10px;
}

.pdu-card {
  margin-bottom: 15px;
}

.pdu-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pdu-actions button {
  width: 100%;
  padding: 12px;
  font-size: 14px;
}

/* Tablet styles */
@media (min-width: 768px) {
  .pdu-list {
    padding: 20px;
  }
  
  .pdu-actions {
    flex-direction: row;
    justify-content: space-between;
  }
  
  .pdu-actions button {
    width: auto;
    min-width: 80px;
  }
  
  .form-row {
    grid-template-columns: 1fr 1fr;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .pdu-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
  
  .form-row {
    grid-template-columns: 1fr 1fr;
  }
  
  .data-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Large desktop styles */
@media (min-width: 1200px) {
  .pdu-form {
    max-width: 1200px;
  }
  
  .form-grid {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
}
```

---

## 🧪 Testing Guidelines

### Unit Testing with Jest & React Testing Library
```javascript
// PDUList.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PDUList from '../components/PDUList';
import * as PDUService from '../services/PDUService';

// Mock the PDU service
jest.mock('../services/PDUService');

const mockPDUs = [
  {
    id: '1',
    name: 'Test PDU 1',
    code: 'PDU001',
    type: 'smart',
    status: 'active',
    outlet_count: 8
  }
];

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('PDUList Component', () => {
  beforeEach(() => {
    PDUService.getPDUs.mockResolvedValue({
      data: mockPDUs,
      pagination: { total: 1, total_pages: 1 }
    });
  });

  test('renders PDU list correctly', async () => {
    renderWithRouter(<PDUList />);
    
    await waitFor(() => {
      expect(screen.getByText('Test PDU 1')).toBeInTheDocument();
      expect(screen.getByText('PDU001')).toBeInTheDocument();
    });
  });

  test('filters PDUs by search term', async () => {
    renderWithRouter(<PDUList />);
    
    const searchInput = screen.getByPlaceholderText('Search PDUs...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    
    await waitFor(() => {
      expect(PDUService.getPDUs).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ search: 'Test' })
        })
      );
    });
  });

  test('handles delete PDU action', async () => {
    PDUService.deletePDU.mockResolvedValue({ success: true });
    
    // Mock window.confirm
    window.confirm = jest.fn(() => true);
    
    renderWithRouter(<PDUList />);
    
    await waitFor(() => {
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);
    });
    
    expect(PDUService.deletePDU).toHaveBeenCalledWith('1');
  });
});
```

### Integration Testing
```javascript
// PDU.integration.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { usePDUManagement } from '../hooks/usePDUManagement';
import * as PDUService from '../services/PDUService';

jest.mock('../services/PDUService');

describe('PDU Management Integration', () => {
  test('complete PDU lifecycle', async () => {
    const { result } = renderHook(() => usePDUManagement());
    
    // Test create PDU
    const newPDU = {
      name: 'Integration Test PDU',
      code: 'INT001',
      type: 'smart',
      organization_id: 'org1',
      outlet_count: 8,
      voltage_rating: 220,
      max_current: 16
    };
    
    PDUService.createPDU.mockResolvedValue({ 
      data: { id: 'new-pdu-id', ...newPDU }
    });
    
    await act(async () => {
      await result.current.createPDU(newPDU);
    });
    
    expect(PDUService.createPDU).toHaveBeenCalledWith(newPDU);
    
    // Test update PDU
    const updateData = { name: 'Updated PDU Name' };
    PDUService.updatePDU.mockResolvedValue({
      data: { id: 'new-pdu-id', ...newPDU, ...updateData }
    });
    
    await act(async () => {
      await result.current.updatePDU('new-pdu-id', updateData);
    });
    
    expect(PDUService.updatePDU).toHaveBeenCalledWith('new-pdu-id', updateData);
    
    // Test delete PDU
    PDUService.deletePDU.mockResolvedValue({ success: true });
    
    await act(async () => {
      await result.current.deletePDU('new-pdu-id');
    });
    
    expect(PDUService.deletePDU).toHaveBeenCalledWith('new-pdu-id');
  });
});
```

---

## 📈 Performance Optimization

### Lazy Loading & Code Splitting
```javascript
// App.js
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Lazy load components
const PDUList = React.lazy(() => import('./components/PDUList'));
const PDUForm = React.lazy(() => import('./components/PDUForm'));
const PDUDetails = React.lazy(() => import('./components/PDUDetails'));
const OutletManagement = React.lazy(() => import('./components/OutletManagement'));

const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/pdus" element={<PDUList />} />
          <Route path="/pdus/create" element={<PDUForm />} />
          <Route path="/pdus/:id" element={<PDUDetails />} />
          <Route path="/pdus/:id/edit" element={<PDUForm />} />
          <Route path="/outlets" element={<OutletManagement />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

### Memoization & Caching
```javascript
// usePDUCache.js
import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { PDUService } from '../services/PDUService';

const usePDUCache = () => {
  const queryClient = useQueryClient();

  const getPDUs = useCallback((params) => {
    return useQuery(
      ['pdus', params], 
      () => PDUService.getPDUs(params),
      {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
      }
    );
  }, []);

  const getPDU = useCallback((id) => {
    return useQuery(
      ['pdu', id], 
      () => PDUService.getPDU(id),
      {
        staleTime: 2 * 60 * 1000, // 2 minutes
      }
    );
  }, []);

  const invalidatePDUs = useCallback(() => {
    queryClient.invalidateQueries(['pdus']);
  }, [queryClient]);

  return {
    getPDUs,
    getPDU,
    invalidatePDUs
  };
};
```

---

## 🚀 Deployment Checklist

### Environment Configuration
```javascript
// config/environment.js
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3030/api',
    WS_URL: 'ws://localhost:8080',
    DEBUG: true
  },
  staging: {
    API_BASE_URL: 'https://staging-api.yourdomain.com/api',
    WS_URL: 'wss://staging-ws.yourdomain.com',
    DEBUG: false
  },
  production: {
    API_BASE_URL: 'https://api.yourdomain.com/api',
    WS_URL: 'wss://ws.yourdomain.com',
    DEBUG: false
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

### Build Optimization
```javascript
// webpack.config.js additions for production
module.exports = {
  // ... other config
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        pdu: {
          name: 'pdu-management',
          test: /[\\/]src[\\/](components|services|hooks)[\\/].*pdu/i,
          chunks: 'all',
          enforce: true
        }
      }
    }
  }
};
```

### Security Headers
```javascript
// Security configuration for production
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https:"
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];
```

---

## 📋 Implementation Steps

### Phase 1: Setup & Basic Components (Week 1-2)
1. **Setup project structure**
2. **Configure API client & authentication**
3. **Implement permission management**
4. **Create basic PDU list component**
5. **Create PDU form component**

### Phase 2: Advanced Features (Week 3-4)
1. **Implement outlet management**
2. **Add device assignment functionality**
3. **Create real-time data components**
4. **Implement WebSocket integration**
5. **Add outlet control features**

### Phase 3: Polish & Optimization (Week 5-6)
1. **Add comprehensive error handling**
2. **Implement caching & performance optimization**
3. **Add mobile responsiveness**
4. **Write unit & integration tests**
5. **Setup production deployment**

---

## 🎯 Best Practices

1. **Always check permissions** before rendering action buttons
2. **Use proper error boundaries** to catch React errors
3. **Implement loading states** for all async operations
4. **Cache API responses** to improve performance
5. **Use TypeScript** for better type safety
6. **Follow accessibility guidelines** (ARIA labels, keyboard navigation)
7. **Implement proper SEO** for public pages
8. **Use semantic HTML** and proper CSS naming conventions
9. **Test on multiple devices** and browsers
10. **Monitor performance** with tools like Lighthouse

Với documentation này, Frontend team sẽ có đầy đủ thông tin để implement một PDU Management System hoàn chỉnh và professional!