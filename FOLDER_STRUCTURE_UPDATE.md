# File và Folder Structure Update - Socket Based

## 📂 Folder Structure Changes

### Before:
```
controllers/
├── auoDisplay/
│   └── auoDisplay.controller.js
├── cameraControl/
│   └── cameraControl.controller.js
├── ledNova/
│   └── ledNova.controller.js
├── electronic/
│   └── electronic.controller.js
└── ... (other controllers)
```

### After:
```
controllers/
├── socket1/
│   └── socket1.controller.js
├── socket2/
│   └── socket2.controller.js
├── socket3/
│   └── socket3.controller.js
├── socket4/
│   └── socket4.controller.js
└── ... (other controllers)
```

## 🔄 File Rename Mapping

| Old Path | New Path | Description |
|----------|----------|-------------|
| `controllers/auoDisplay/auoDisplay.controller.js` | `controllers/socket1/socket1.controller.js` | Socket 1 - Tang 3 PKT |
| `controllers/cameraControl/cameraControl.controller.js` | `controllers/socket2/socket2.controller.js` | Socket 2 - Tang 3 PKT |
| `controllers/ledNova/ledNova.controller.js` | `controllers/socket3/socket3.controller.js` | Socket 3 - Tang 3 PKT |
| `controllers/electronic/electronic.controller.js` | `controllers/socket4/socket4.controller.js` | Socket 4 - Tang 3 PKT |

## 📡 MQTT Topic to Controller Mapping

| MQTT Topic | Controller | Database Table | Description |
|------------|------------|----------------|-------------|
| `hopt/tang3/pkt/socket1` | `socket1.controller.js` | `socket1_data` | Ổ điện Socket 1 |
| `hopt/tang3/pkt/socket2` | `socket2.controller.js` | `socket2_data` | Ổ điện Socket 2 |
| `hopt/tang3/pkt/socket3` | `socket3.controller.js` | `socket3_data` | Ổ điện Socket 3 |
| `hopt/tang3/pkt/socket4` | `socket4.controller.js` | `socket4_data` | Ổ điện Socket 4 |

## 🔧 Updated Import Statements

### Routes (iotRoutes.js):
```javascript
// Before:
import { ... } from '../controllers/auoDisplay/auoDisplay.controller.js';
import { ... } from '../controllers/cameraControl/cameraControl.controller.js';
import { ... } from '../controllers/ledNova/ledNova.controller.js';
import { ... } from '../controllers/electronic/electronic.controller.js';

// After:
import { ... } from '../controllers/socket1/socket1.controller.js';
import { ... } from '../controllers/socket2/socket2.controller.js';
import { ... } from '../controllers/socket3/socket3.controller.js';
import { ... } from '../controllers/socket4/socket4.controller.js';
```

## 📋 Controller Function Aliases

Each controller maintains backward compatibility through aliases:

### Socket 1 (socket1.controller.js):
```javascript
// Main functions (unchanged)
export const getAllAuoDisplay = ...
export const getLatestAuoDisplay = ...

// New socket aliases
export const getAllSocket1 = getAllAuoDisplay;
export const getLatestSocket1 = getLatestAuoDisplay;
export const addSocket1 = addAuoDisplay;
// ... more aliases
```

### Socket 2 (socket2.controller.js):
```javascript
// Main functions (unchanged) 
export const getAllCameraControl = ...
export const getLatestCameraControl = ...

// New socket aliases
export const getAllSocket2 = getAllCameraControl;
export const getLatestSocket2 = getLatestCameraControl;
// ... more aliases
```

### Socket 3 (socket3.controller.js):
```javascript
// Main functions (unchanged)
export const getAllLedNova = ...
export const getLatestLedNova = ...

// New socket aliases
export const getAllSocket3 = getAllLedNova;
export const getLatestSocket3 = getLatestLedNova;
// ... more aliases
```

### Socket 4 (socket4.controller.js):
```javascript
// Main functions (unchanged)
export const getAllElectronic = ...
export const getLatestElectronic = ...

// New socket aliases
export const getAllSocket4 = getAllElectronic;
export const getLatestSocket4 = getLatestElectronic;
// ... more aliases
```

## 🚀 API Endpoints

### New Socket Endpoints:
```
GET    /api/iot/socket1/*     - Socket 1 operations
GET    /api/iot/socket2/*     - Socket 2 operations  
GET    /api/iot/socket3/*     - Socket 3 operations
GET    /api/iot/socket4/*     - Socket 4 operations
```

### Legacy Endpoints (still working):
```
GET    /api/iot/auo-display/*     - Legacy AUO Display
GET    /api/iot/camera-control/*  - Legacy Camera Control
GET    /api/iot/led-nova/*        - Legacy LED Nova
GET    /api/iot/electronic/*      - Legacy Electronic
```

## ✅ Completed Changes

- [x] Renamed all controller folders (auoDisplay → socket1, etc.)
- [x] Renamed all controller files (.controller.js)
- [x] Updated import statements in routes
- [x] Added socket function aliases in controllers
- [x] Updated file headers and comments
- [x] Maintained backward compatibility
- [x] Created new socket-based API endpoints

## 📝 Benefits

1. **Clear Naming**: Socket-based names reflect actual hardware
2. **Organized Structure**: Logical grouping by socket numbers
3. **Backward Compatibility**: Old endpoints still work
4. **MQTT Alignment**: Controller names match MQTT topics
5. **Scalable**: Easy to add more sockets in future

## 🔄 Migration Status

- **Frontend**: Needs to update API calls to use `/socket1-4` endpoints
- **Database**: Schema updated to new field structure
- **MQTT**: Topics updated to `hopt/tang3/pkt/socket1-4`
- **Backend**: ✅ Fully updated and compatible

## 📚 Related Files

- `SOCKET_ENDPOINTS_API.md` - Complete API documentation
- `run_schema_update.sql` - Database migration script  
- `socket_controller_template.js` - Template for new controllers
- `update_socket_schema.sql` - Database schema changes