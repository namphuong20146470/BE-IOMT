# 📡 IoMT Frontend Integration Guide - Real-time Data

## 🎯 Tổng Quan

Hệ thống IoMT Backend đã setup sẵn Socket.IO và REST APIs để cung cấp dữ liệu real-time từ các thiết bị IoT. Document này hướng dẫn Frontend tích hợp để nhận dữ liệu.

---

## 🔧 Backend Status

### ✅ **Đã Setup:**
- **Socket.IO Server**: Chạy cùng port với HTTP/HTTPS server
- **CORS Configuration**: Đã config cho các domain frontend
- **Real-time Events**: MQTT data được emit qua Socket.IO
- **REST APIs**: Đầy đủ endpoints cho historical data
- **Authentication**: JWT-based auth cho cả Socket.IO và REST

### 🌐 **Server Endpoints:**
- **Production**: `https://iomt.hoangphucthanh.vn:3030`
- **Development**: `http://localhost:3030` (hoặc port trong env)

---

## 🚀 Frontend Setup Requirements

### 1. **Install Dependencies**

```bash
# Socket.IO Client
npm install socket.io-client

# HTTP Client (choose one)
npm install axios
# OR
npm install fetch
```

### 2. **Environment Configuration**

```javascript
// .env hoặc config file
const config = {
  // Server URLs
  API_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://iomt.hoangphucthanh.vn:3030'
    : 'http://localhost:3030',
  
  SOCKET_URL: process.env.NODE_ENV === 'production'
    ? 'wss://iomt.hoangphucthanh.vn:3030'  // WebSocket Secure
    : 'ws://localhost:3030',               // WebSocket
  
  // Auth
  JWT_STORAGE_KEY: 'iomt_access_token',
  
  // Real-time settings
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  HEARTBEAT_INTERVAL: 30000
};
```

---

## 🔐 Authentication Setup

### **JWT Token Management**

```javascript
// auth.js
class AuthService {
  constructor() {
    this.token = localStorage.getItem(config.JWT_STORAGE_KEY);
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem(config.JWT_STORAGE_KEY, token);
  }

  getToken() {
    return this.token || localStorage.getItem(config.JWT_STORAGE_KEY);
  }

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {};
  }

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
```

---

## 🔥 Socket.IO Real-time Integration

### **Basic Socket Connection**

```javascript
// socketService.js
import { io } from 'socket.io-client';
import authService from './authService.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.RECONNECT_ATTEMPTS;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    console.log('🔌 Connecting to Socket.IO server...');
    
    this.socket = io(config.SOCKET_URL, {
      // Authentication
      auth: {
        token: authService.getToken()
      },
      
      // Connection options
      withCredentials: true,
      transports: ['websocket', 'polling'],
      
      // Reconnection
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: config.RECONNECT_DELAY,
      
      // Timeout
      timeout: 10000
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚫 Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    // Authentication error
    this.socket.on('unauthorized', (error) => {
      console.error('🔐 Socket authentication error:', error);
      // Redirect to login or refresh token
      authService.refreshToken().then(() => {
        this.reconnect();
      }).catch(() => {
        // Redirect to login page
        window.location.href = '/login';
      });
    });

    // Real-time data events
    this.socket.on('mqtt_data', (data) => {
      console.log('📨 Received MQTT data:', data);
      this.handleMqttData(data);
    });
  }

  // Handle incoming MQTT data
  handleMqttData(data) {
    const { deviceId, deviceName, data: sensorData, metadata } = data;
    
    // Emit to all listeners
    this.listeners.forEach((callback, listenerId) => {
      try {
        callback({
          deviceId,
          deviceName,
          data: sensorData,
          timestamp: metadata.lastUpdate,
          source: 'realtime'
        });
      } catch (error) {
        console.error(`Error in listener ${listenerId}:`, error);
      }
    });
  }

  // Subscribe to real-time data
  subscribe(listenerId, callback) {
    this.listeners.set(listenerId, callback);
    
    // Connect if not already connected
    if (!this.socket?.connected) {
      this.connect();
    }

    return () => this.unsubscribe(listenerId);
  }

  unsubscribe(listenerId) {
    this.listeners.delete(listenerId);
    
    // Disconnect if no more listeners
    if (this.listeners.size === 0) {
      this.disconnect();
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  reconnect() {
    this.disconnect();
    this.connect();
  }
}

const socketService = new SocketService();
export default socketService;
```

---

## 🌐 REST API Integration

### **API Service**

```javascript
// apiService.js
import authService from './authService.js';

class ApiService {
  constructor() {
    this.baseURL = config.API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        ...authService.getAuthHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await authService.refreshToken();
          // Retry with new token
          return this.request(endpoint, options);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Device Data APIs
  async getDeviceData(deviceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/device-data/${deviceId}?${query}`);
  }

  async getDeviceStream(deviceId, limit = 10) {
    return this.request(`/device-data/${deviceId}/stream?limit=${limit}`);
  }

  async getDeviceStats(deviceId, period = '24h') {
    return this.request(`/device-data/${deviceId}/stats?period=${period}`);
  }

  // Device Management
  async getAllDevices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/devices?${query}`);
  }

  async getDeviceById(deviceId) {
    return this.request(`/devices/${deviceId}`);
  }

  // MQTT Status
  async getMqttStatus() {
    return this.request('/mqtt/status');
  }

  // System Info
  async getSystemTables() {
    return this.request('/tables');
  }
}

const apiService = new ApiService();
export default apiService;
```

---

## ⚡ React Integration Examples

### **1. Real-time Dashboard Component**

```jsx
// components/DeviceDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService.js';
import apiService from '../services/apiService.js';

const DeviceDashboard = ({ deviceId }) => {
  const [realtimeData, setRealtimeData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Handle real-time data
  const handleRealtimeUpdate = useCallback((data) => {
    if (data.deviceId === deviceId) {
      setRealtimeData(data);
    }
  }, [deviceId]);

  // Setup real-time subscription
  useEffect(() => {
    const unsubscribe = socketService.subscribe('dashboard', handleRealtimeUpdate);
    
    // Connection status monitoring
    const socket = socketService.socket;
    if (socket) {
      socket.on('connect', () => setConnectionStatus('connected'));
      socket.on('disconnect', () => setConnectionStatus('disconnected'));
      socket.on('reconnecting', () => setConnectionStatus('reconnecting'));
    }

    return () => {
      unsubscribe();
    };
  }, [handleRealtimeUpdate]);

  // Load historical data
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const data = await apiService.getDeviceStream(deviceId, 20);
        setHistoricalData(data.data || []);
      } catch (error) {
        console.error('Failed to load historical data:', error);
      }
    };

    loadHistoricalData();
  }, [deviceId]);

  return (
    <div className="device-dashboard">
      <div className="connection-status">
        Status: <span className={`status-${connectionStatus}`}>
          {connectionStatus}
        </span>
      </div>

      {/* Real-time Data */}
      <div className="realtime-section">
        <h3>Real-time Data</h3>
        {realtimeData ? (
          <div className="data-grid">
            {Object.entries(realtimeData.data).map(([key, value]) => (
              <div key={key} className="data-item">
                <span className="label">{key}:</span>
                <span className="value">{value}</span>
              </div>
            ))}
            <div className="timestamp">
              Last update: {new Date(realtimeData.timestamp).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="no-data">Waiting for data...</div>
        )}
      </div>

      {/* Historical Data */}
      <div className="historical-section">
        <h3>Recent History</h3>
        <div className="data-history">
          {historicalData.map((record, index) => (
            <div key={record.id || index} className="history-item">
              <div className="timestamp">
                {new Date(record.timestamp).toLocaleString()}
              </div>
              <div className="data">
                {JSON.stringify(record.data_json || record)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeviceDashboard;
```

### **2. Custom Hook for Real-time Data**

```jsx
// hooks/useRealtimeData.js
import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService.js';

export const useRealtimeData = (deviceId = null) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const handleDataUpdate = useCallback((receivedData) => {
    // Filter by device if specified
    if (deviceId && receivedData.deviceId !== deviceId) {
      return;
    }
    
    setData(receivedData);
    setError(null);
  }, [deviceId]);

  useEffect(() => {
    const listenerId = `realtime-${deviceId || 'all'}`;
    
    try {
      const unsubscribe = socketService.subscribe(listenerId, handleDataUpdate);
      
      // Monitor connection status
      const socket = socketService.socket;
      if (socket) {
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        socket.on('connect_error', (err) => setError(err.message));
      }

      return () => {
        unsubscribe();
      };
    } catch (err) {
      setError(err.message);
    }
  }, [deviceId, handleDataUpdate]);

  return {
    data,
    isConnected,
    error,
    // Helper functions
    getLatestValue: (fieldName) => data?.data?.[fieldName],
    getTimestamp: () => data?.timestamp,
    getDeviceName: () => data?.deviceName
  };
};
```

### **3. Device List with Real-time Status**

```jsx
// components/DeviceList.jsx
import React, { useState, useEffect } from 'react';
import { useRealtimeData } from '../hooks/useRealtimeData.js';
import apiService from '../services/apiService.js';

const DeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const { data: realtimeData, isConnected } = useRealtimeData();

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const response = await apiService.getAllDevices();
        setDevices(response.data || []);
      } catch (error) {
        console.error('Failed to load devices:', error);
      }
    };

    loadDevices();
  }, []);

  // Update device status from real-time data
  useEffect(() => {
    if (realtimeData) {
      setDeviceStatuses(prev => ({
        ...prev,
        [realtimeData.deviceId]: {
          lastSeen: realtimeData.timestamp,
          status: 'online',
          latestData: realtimeData.data
        }
      }));
    }
  }, [realtimeData]);

  return (
    <div className="device-list">
      <div className="header">
        <h2>Devices</h2>
        <div className={`connection-indicator ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
      </div>

      <div className="devices">
        {devices.map(device => {
          const status = deviceStatuses[device.id];
          const isOnline = status && 
            (Date.now() - new Date(status.lastSeen).getTime()) < 60000; // 1 minute

          return (
            <div key={device.id} className={`device-card ${isOnline ? 'online' : 'offline'}`}>
              <div className="device-info">
                <h3>{device.serial_number}</h3>
                <p>{device.model?.name}</p>
              </div>
              
              <div className="device-status">
                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                {status ? (
                  <div className="last-data">
                    {Object.entries(status.latestData || {}).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="data-point">
                        {key}: {value}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>No data</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeviceList;
```

---

## 🎨 CSS Styling Examples

```css
/* styles/realtime.css */
.connection-status {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
}

.status-connected { 
  background: #d4edda; 
  color: #155724; 
}

.status-disconnected { 
  background: #f8d7da; 
  color: #721c24; 
}

.status-reconnecting { 
  background: #fff3cd; 
  color: #856404; 
}

.device-card {
  border: 1px solid #ddd;
  padding: 16px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.device-card.online {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.device-card.offline {
  border-left: 4px solid #dc3545;
  background: #fff8f8;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-dot.online { background: #28a745; }
.status-dot.offline { background: #dc3545; }

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.data-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
}

.data-item .label {
  font-weight: bold;
  color: #666;
}

.data-item .value {
  color: #333;
  font-family: 'Courier New', monospace;
}
```

---

## 🔄 Error Handling & Retry Logic

```javascript
// utils/errorHandler.js
export class RealtimeError extends Error {
  constructor(message, code, recoverable = true) {
    super(message);
    this.code = code;
    this.recoverable = recoverable;
  }
}

export const handleRealtimeError = (error, component = 'realtime') => {
  console.error(`[${component}] Error:`, error);
  
  // Log to monitoring service
  if (window.analytics) {
    window.analytics.track('realtime_error', {
      component,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
  
  // Show user-friendly error
  if (error.recoverable !== false) {
    showToast('Connection lost. Attempting to reconnect...', 'warning');
  } else {
    showToast('Unable to connect to real-time data. Please refresh the page.', 'error');
  }
};

const showToast = (message, type) => {
  // Implement your toast notification system
  console.log(`[${type.toUpperCase()}] ${message}`);
};
```

---

## 🧪 Testing Real-time Connection

```javascript
// utils/connectionTest.js
import socketService from '../services/socketService.js';
import apiService from '../services/apiService.js';

export const testConnection = async () => {
  console.log('🧪 Testing IoMT connection...');
  
  const results = {
    api: { status: 'pending', error: null },
    socket: { status: 'pending', error: null },
    auth: { status: 'pending', error: null }
  };

  // Test API connection
  try {
    await apiService.getMqttStatus();
    results.api.status = 'success';
    console.log('✅ API connection successful');
  } catch (error) {
    results.api.status = 'failed';
    results.api.error = error.message;
    console.error('❌ API connection failed:', error);
  }

  // Test Socket.IO connection
  try {
    const socket = socketService.connect();
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        results.socket.status = 'success';
        console.log('✅ Socket.IO connection successful');
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        results.socket.status = 'failed';
        results.socket.error = error.message;
        console.error('❌ Socket.IO connection failed:', error);
        reject(error);
      });
    });
  } catch (error) {
    results.socket.status = 'failed';
    results.socket.error = error.message;
  }

  // Test authentication
  try {
    const token = authService.getToken();
    if (token && authService.isAuthenticated()) {
      results.auth.status = 'success';
      console.log('✅ Authentication valid');
    } else {
      results.auth.status = 'failed';
      results.auth.error = 'Invalid or missing token';
      console.warn('⚠️ Authentication invalid');
    }
  } catch (error) {
    results.auth.status = 'failed';
    results.auth.error = error.message;
  }

  console.log('🧪 Connection test results:', results);
  return results;
};
```

---

## 🚀 Quick Start Checklist

### **Frontend Setup:**
- [ ] Install `socket.io-client`
- [ ] Setup environment configuration
- [ ] Implement authentication service
- [ ] Create Socket.IO service
- [ ] Create API service
- [ ] Add error handling
- [ ] Test connection

### **Development:**
- [ ] Connect to `ws://localhost:3030`
- [ ] Use JWT token for authentication
- [ ] Subscribe to `mqtt_data` event
- [ ] Handle connection/disconnection
- [ ] Test with device simulation API

### **Production:**
- [ ] Connect to `wss://iomt.hoangphucthanh.vn:3030`
- [ ] Implement proper error boundaries
- [ ] Add connection retry logic
- [ ] Monitor performance
- [ ] Setup logging/analytics

---

## 📞 Support & Debugging

### **Common Issues:**

1. **CORS Errors**: Check if frontend domain is in `allowedOrigins`
2. **Auth Failures**: Verify JWT token format and expiration
3. **Connection Drops**: Implement proper reconnection logic
4. **No Data Received**: Check device connectivity and MQTT status

### **Debug Commands:**

```javascript
// In browser console
window.iomt = {
  testConnection,
  socketService,
  apiService,
  authService
};

// Test connection
await window.iomt.testConnection();

// Check MQTT status  
await window.iomt.apiService.getMqttStatus();

// Manual socket reconnect
window.iomt.socketService.reconnect();
```

---

**🎯 Kết luận:** Backend đã sẵn sàng! Frontend chỉ cần implement các service trên để nhận dữ liệu real-time từ hệ thống IoMT.