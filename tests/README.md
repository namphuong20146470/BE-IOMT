# 🧪 Testing Suite

## 📋 Tổng Quan

Thư mục testing với cấu trúc logic, bao gồm unit tests, integration tests và automation scripts.

## 📁 Cấu Trúc

```
tests/
├── unit/              # Unit tests cho individual functions/methods
│   ├── test-*.js     # Test files đã di chuyển từ root
│   └── README.md     # Unit testing guide
├── integration/      # Integration tests cho API endpoints
│   ├── api.test.js   # API integration tests
│   └── README.md     # Integration testing guide
└── fixtures/         # Test data và mock objects
    ├── users.json    # Mock user data
    ├── devices.json  # Mock device data
    └── responses.json # Mock API responses
```

## 🚀 Chạy Tests

### **All Tests**
```bash
npm test                    # Chạy tất cả tests
npm run test:watch          # Watch mode cho development
npm run test:coverage       # Generate coverage report
```

### **Specific Test Types**
```bash
npm run test:unit           # Chỉ unit tests
npm run test:integration    # Chỉ integration tests  
npm run test:e2e           # End-to-end tests
```

### **Individual Test Files**
```bash
# Unit tests
npm test tests/unit/test-device-model-creation.js
npm test tests/unit/test-patch-specification.js
npm test tests/unit/test-permission-system.js

# Integration tests
npm test tests/integration/api.test.js
```

## 🎯 Test Coverage Goals

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| **Authentication** | 85% | 95% | High |
| **Device Management** | 75% | 90% | High |
| **User Permissions** | 80% | 95% | High |
| **MQTT Integration** | 60% | 85% | Medium |
| **API Endpoints** | 70% | 90% | High |
| **Database Models** | 65% | 80% | Medium |

## 🛠️ Testing Tools & Frameworks

### **Backend Testing Stack**
- **Jest**: Test runner và assertion framework
- **Supertest**: HTTP testing cho Express apps
- **Prisma Mock**: Database mocking
- **Socket.IO Client**: WebSocket testing
- **Nock**: HTTP request mocking

### **Configuration Files**
- `jest.config.js`: Jest configuration
- `setupTests.js`: Global test setup
- `.env.test`: Test environment variables

## 📝 Writing Tests Guide

### **Unit Test Example**
```javascript
// tests/unit/device-service.test.js
import { DeviceService } from '../../services/DeviceService.js';
import { prismaMock } from '../mocks/prisma.js';

describe('DeviceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create device with valid data', async () => {
    // Arrange
    const deviceData = {
      name: 'Blood Pressure Monitor',
      model: 'BP-2024',
      location: 'Room 101'
    };
    
    prismaMock.devices.create.mockResolvedValue({
      id: 'device-123',
      ...deviceData
    });

    // Act
    const result = await DeviceService.create(deviceData);

    // Assert
    expect(result).toHaveProperty('id', 'device-123');
    expect(prismaMock.devices.create).toHaveBeenCalledWith({
      data: deviceData
    });
  });
});
```

### **Integration Test Example**
```javascript
// tests/integration/device-api.test.js
import request from 'supertest';
import app from '../../index.js';

describe('Device API', () => {
  let authToken;

  beforeAll(async () => {
    // Setup auth token
    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    authToken = response.body.access_token;
  });

  test('GET /devices should return device list', async () => {
    const response = await request(app)
      .get('/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toBeInstanceOf(Array);
  });

  test('POST /devices should create new device', async () => {
    const deviceData = {
      name: 'Test Device',
      model: 'TEST-001',
      category_id: 'cat-123'
    };

    const response = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${authToken}`)
      .send(deviceData)
      .expect(201);

    expect(response.body.data).toHaveProperty('name', 'Test Device');
  });
});
```

## 🔧 Mock Data & Fixtures

### **Creating Mock Data**
```javascript
// tests/fixtures/devices.js
export const mockDevices = [
  {
    id: 'device-1',
    name: 'Blood Pressure Monitor',
    model: 'BP-2024',
    status: 'active',
    location: 'Room 101'
  },
  {
    id: 'device-2', 
    name: 'Heart Rate Monitor',
    model: 'HR-2024',
    status: 'maintenance',
    location: 'Room 102'
  }
];

export const mockDeviceCategories = [
  {
    id: 'cat-1',
    name: 'Monitoring Devices',
    description: 'Patient monitoring equipment'
  }
];
```

### **Database Seeding for Tests**
```javascript
// tests/setup/seedTestData.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedTestData() {
  // Clean existing test data
  await prisma.devices.deleteMany({
    where: { name: { startsWith: 'TEST_' } }
  });

  // Create test devices
  await prisma.devices.createMany({
    data: [
      { name: 'TEST_Device_1', model: 'TEST-001' },
      { name: 'TEST_Device_2', model: 'TEST-002' }
    ]
  });
}
```

## 🚨 Continuous Integration

### **GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test -- --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### **Quality Gates**
```javascript
// jest.config.js coverage thresholds
module.exports = {
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js', 
    'middleware/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
```

## 🔍 Debugging Tests

### **Debug Commands**
```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest tests/unit/device-service.test.js

# Verbose output
npm test -- --verbose

# Run failed tests only
npm test -- --onlyFailures

# Watch mode với debugging
npm test -- --watch --verbose
```

### **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| **Timeout errors** | Increase Jest timeout: `jest.setTimeout(10000)` |
| **Database conflicts** | Use separate test database với different schema |
| **Async test failures** | Properly await promises, use `done()` callback |
| **Mock not working** | Clear mocks trong `beforeEach()` |
| **Port conflicts** | Use different ports cho test server |

## 📊 Test Reporting

### **Coverage Reports**
```bash
npm run test:coverage     # Generate HTML report
open coverage/lcov-report/index.html  # View in browser
```

### **Test Results Dashboard**
- **Local**: `coverage/lcov-report/index.html`
- **CI/CD**: Integrated với GitHub Actions
- **Monitoring**: Jest results trong team dashboard

## 🎯 Performance Testing

### **Load Testing với Artillery**
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3030'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Device API Load Test"
    flow:
      - post:
          url: "/auth/login"
          json:
            username: "admin"
            password: "admin123"
      - get:
          url: "/devices"
          headers:
            Authorization: "Bearer {{ access_token }}"
```

### **Memory Leak Testing**
```javascript
// tests/performance/memory-leak.test.js
describe('Memory Leak Tests', () => {
  test('should not leak memory on repeated API calls', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Make 1000 API calls
    for (let i = 0; i < 1000; i++) {
      await request(app)
        .get('/devices')
        .set('Authorization', `Bearer ${authToken}`);
    }
    
    // Force garbage collection
    global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be less than 50MB
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

---

## 📞 Testing Support

### **Team Resources**
- **QA Lead**: `qa-lead@iomt.com`
- **Test Documentation**: `/wiki/testing`
- **Bug Reports**: GitHub Issues với label `bug`
- **Test Strategy**: `/docs/testing-strategy.md`

---

*Last updated: November 2024*  
*Maintained by: QA Team*