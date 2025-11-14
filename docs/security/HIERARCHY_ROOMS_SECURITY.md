# Hierarchy Rooms - Security & Organization Structure

## 🏛️ **Organization Hierarchy Implementation**

### **Problem Solved:**
- ✅ **Authorization Security**: Who can access which device data
- ✅ **Organizational Boundaries**: Hospital A vs Hospital B isolation  
- ✅ **Department Oversight**: Department managers see all dept devices
- ✅ **Scalable Permissions**: Role-based access control

## 🏠 **Room Structure Hierarchy**

### **1. Organization Level** - `org:{orgId}`
**Purpose**: Org-wide notifications and admin oversight
**Who Joins**: 
- Organization administrators
- System administrators (cross-org)
- C-level executives

**Use Cases**:
- System-wide alerts (power outage, network issues)
- Organization performance dashboards  
- Compliance notifications

```javascript
// Example: Hospital A gets critical system alert
socket.emit('join_org_room', 'hospital-a');

// Listen to org notifications
socket.on('org_notification', (data) => {
    if (data.type === 'critical_alert') {
        showSystemAlert(data.message);
    }
});
```

### **2. Department Level** - `dept:{deptId}`
**Purpose**: Department oversight and management
**Who Joins**:
- Department managers (BME, Nursing supervisors)
- Department staff (doctors, technicians)
- Organization admins

**Use Cases**:
- Department performance dashboards
- All devices in Emergency Dept, ICU, etc.
- Department-specific alerts

```javascript
// Example: Emergency Department manager
socket.emit('join_dept_room', 'emergency-dept-1');

// Receive aggregated department data
socket.on('dept_data', (data) => {
    updateDepartmentDashboard(data);
});
```

### **3. Device Level** - `device:{deviceId}`
**Purpose**: Real-time device monitoring
**Who Joins**:
- Technicians working on specific device
- Widgets displaying device data
- Users with device access permissions

**Use Cases**:
- Real-time monitoring widgets
- Device troubleshooting
- Maintenance workflows

```javascript
// Example: Specific ventilator monitoring
socket.emit('join_device_room', 'f88c7482-5d60-4b00-b003-c6e307594002');

socket.on('mqtt_data', (data) => {
    if (data.room === 'device:f88c7482-5d60-4b00-b003-c6e307594002') {
        updateDeviceWidget(data);
    }
});
```

## 🔒 **Access Control Logic**

### **JWT Token Structure (Required)**
Your JWT tokens must include hierarchy information:

```javascript
{
    "userId": "user123",
    "username": "john.doe", 
    "orgId": "hospital-a",           // ✅ Required: User's organization
    "departmentIds": ["icu", "er"],  // ✅ Required: Accessible departments  
    "roles": ["doctor", "admin"],    // ✅ Required: User roles
    "iat": 1699123456,
    "exp": 1699209856
}
```

### **Permission Matrix**

| Room Type | Anonymous | Authenticated | Dept Member | Org Admin | Super Admin |
|-----------|-----------|---------------|-------------|-----------|-------------|
| `public:monitoring` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `authenticated` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `org:hospital-a` | ❌ | ❌ | ✅* | ✅ | ✅ |
| `dept:icu` | ❌ | ❌ | ✅** | ✅ | ✅ |
| `device:xyz` | ❌ | ❌ | ✅*** | ✅ | ✅ |
| `admin:system` | ❌ | ❌ | ❌ | ❌ | ✅ |

*Only if `socket.orgId === 'hospital-a'`
**Only if `socket.departmentIds.includes('icu')`  
***Only if device belongs to user's org/dept (DB check required)

## 📡 **Frontend Integration Examples**

### **React Hook for Hierarchy Rooms**

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const useHierarchyRooms = (userToken) => {
    const [socket, setSocket] = useState(null);
    const [roomData, setRoomData] = useState({
        org: {},
        departments: {},
        devices: {}
    });
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const newSocket = io('http://localhost:3000', {
            auth: { token: userToken }
        });

        // Connection with hierarchy info
        newSocket.on('connected', (data) => {
            console.log('Connected with hierarchy:', data.hierarchy);
            // data.hierarchy = { organization: 'hospital-a', departments: ['icu', 'er'], isAdmin: false }
        });

        // Organization-level notifications
        newSocket.on('org_notification', (data) => {
            setNotifications(prev => [...prev, { ...data, level: 'organization' }]);
        });

        // Department-level data
        newSocket.on('dept_data', (data) => {
            setRoomData(prev => ({
                ...prev,
                departments: {
                    ...prev.departments,
                    [data.deptId]: data
                }
            }));
        });

        // Device-level data  
        newSocket.on('mqtt_data', (data) => {
            setRoomData(prev => ({
                ...prev,
                devices: {
                    ...prev.devices,
                    [data.deviceId]: data
                }
            }));
        });

        setSocket(newSocket);

        return () => newSocket.close();
    }, [userToken]);

    const joinDepartment = (deptId) => {
        if (socket) {
            socket.emit('join_dept_room', deptId);
        }
    };

    const joinDevice = (deviceId) => {
        if (socket) {
            socket.emit('join_device_room', deviceId);
        }
    };

    return {
        socket,
        roomData,
        notifications,
        joinDepartment,
        joinDevice
    };
};

export default useHierarchyRooms;
```

### **Department Dashboard Component**

```javascript
import React, { useEffect } from 'react';
import useHierarchyRooms from './useHierarchyRooms';

const DepartmentDashboard = ({ departmentId, userToken }) => {
    const { socket, roomData, joinDepartment } = useHierarchyRooms(userToken);

    useEffect(() => {
        if (socket && departmentId) {
            joinDepartment(departmentId);
        }
    }, [socket, departmentId]);

    const deptData = roomData.departments[departmentId];

    return (
        <div className="dept-dashboard">
            <h2>Department: {departmentId}</h2>
            
            {/* Department Overview */}
            <div className="dept-overview">
                <div className="metric">
                    <h3>Active Devices</h3>
                    <span>{Object.keys(roomData.devices).length}</span>
                </div>
                <div className="metric">
                    <h3>Alerts</h3>
                    <span className="alert-count">
                        {deptData?.alerts?.length || 0}
                    </span>
                </div>
            </div>

            {/* Device Grid */}
            <div className="device-grid">
                {Object.entries(roomData.devices).map(([deviceId, device]) => (
                    <DeviceCard 
                        key={deviceId} 
                        device={device}
                        showDetails={() => joinDevice(deviceId)}
                    />
                ))}
            </div>
        </div>
    );
};
```

### **Organization Admin Panel**

```javascript
const OrgAdminPanel = ({ orgId, userToken }) => {
    const { socket, roomData, notifications } = useHierarchyRooms(userToken);

    useEffect(() => {
        if (socket && orgId) {
            socket.emit('join_org_room', orgId);
        }
    }, [socket, orgId]);

    return (
        <div className="org-admin-panel">
            <h1>Organization: {orgId}</h1>
            
            {/* System Notifications */}
            <div className="notifications">
                <h3>System Notifications</h3>
                {notifications
                    .filter(n => n.level === 'organization')
                    .map(notification => (
                        <NotificationItem 
                            key={notification.timestamp} 
                            notification={notification} 
                        />
                    ))
                }
            </div>

            {/* Department Summary */}
            <div className="dept-summary">
                <h3>Department Status</h3>
                {Object.entries(roomData.departments).map(([deptId, dept]) => (
                    <DepartmentSummaryCard 
                        key={deptId}
                        department={dept}
                        onClick={() => navigateToDepartment(deptId)}
                    />
                ))}
            </div>
        </div>
    );
};
```

## 🔧 **Implementation Checklist**

### **Backend (Socket.IO Service) ✅**
- [x] Hierarchy room structure (`org:`, `dept:`, `device:`)
- [x] JWT token parsing for org/dept info
- [x] Permission-based room access control
- [x] Auto-join hierarchy rooms on connection
- [x] Hierarchy-aware broadcasting methods

### **Backend (Database Integration) ⏳**
- [ ] Device ownership queries (org_id, department_id)
- [ ] User permission validation
- [ ] Room access logging
- [ ] Dynamic room discovery APIs

### **Frontend Integration ⏳**
- [ ] Update JWT tokens to include hierarchy info
- [ ] Implement hierarchy-aware React hooks
- [ ] Create department/organization dashboard components
- [ ] Add room-based notification handling

### **Security & Testing ⏳**
- [ ] Penetration testing for room access
- [ ] Performance testing with large hierarchies
- [ ] Cross-organization isolation testing
- [ ] Department permission boundary testing

## 🚀 **Migration Strategy**

1. **Phase 1**: Update JWT tokens with hierarchy info
2. **Phase 2**: Deploy new socket service with hierarchy rooms
3. **Phase 3**: Update frontend to use hierarchy rooms gradually
4. **Phase 4**: Remove legacy `device:all` global access
5. **Phase 5**: Add database permission checking

This hierarchy structure provides **proper security boundaries** while maintaining **performance and scalability** for large medical device deployments!