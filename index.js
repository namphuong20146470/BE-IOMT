import express from 'express';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import iot from './routes/iotRoutes.js';

// Swagger UI imports
import swaggerUI from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';

// ==========================================
// 🏗️ FEATURE-BASED ARCHITECTURE ROUTES
// ==========================================
// Each feature is self-contained with its own:
// - Controllers (business logic)
// - Routes (API endpoints) 
// - Services (data layer)
// - Validation (input validation)
// - README (documentation)

// Feature imports
import authRoutes from './features/auth/auth.routes.js';
import usersRoutes from './features/users/users.routes.js';
import userPermissionsRoutes from './features/users/userPermissions.routes.js';
import deviceRoutes from './features/devices/device.routes.js';
import deviceDataRoutes from './features/devices/deviceData.routes.js';
import organizationsRoutes from './features/organizations/organizations.routes.js';
import departmentsRoutes from './features/departments/departments.routes.js';
import maintenanceRoutes from './features/maintenance/maintenance.routes.js';
import alertsRoutes from './features/alerts/alerts.routes.js';

// Legacy routes (to be migrated)
import actLog from './routes/actLog.js';
import masterDataRoutes from './routes/masterDataRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
// New user permissions routes
import userPermissionsIndividualRoutes from './routes/userPermissions.routes.js';

// Legacy MQTT system (keep existing)
import './Database/mqtt.database.js';
// New Dynamic MQTT system (parallel)
import './Database/mqtt.dynamic.js';
import { configureSSL } from './config/ssl.js';


dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Port configuration  
const port = process.env.PORT || 3005;
const httpPort = process.env.HTTP_PORT || 3006;

// ✅ Set NODE_ENV for development if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
    console.log('🔧 NODE_ENV set to development');
}
const allowedOrigins = [
  'http://localhost:5173',       // Vite dev server
  'http://127.0.0.1:5173',       // Alternative localhost
  'http://localhost:3000',       // React dev server (backup)
  'https://iomt.hoangphucthanh.vn',
  'https://iomt.hoangphucthanh.vn:3030'
];
// Middleware
app.use(express.json());
app.use(cookieParser()); // 🍪 Enable cookie parsing for HttpOnly cookies
// const io = new Server();
// io.on('connection', (socket) => {
//   console.log('New client connected:', socket.id);
// });
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Development: Allow all localhost/127.0.0.1 origins
    if (process.env.NODE_ENV === 'development' && 
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      console.log(`📋 Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // ✅ Essential for httpOnly cookies
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization', 
    'x-requested-with',
    'Cookie',
    'Set-Cookie',
    'Access-Control-Allow-Credentials',
    'Cache-Control'
  ],
  exposedHeaders: [
    'Set-Cookie',
    'Access-Control-Allow-Credentials'
  ],
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Explicit preflight handling
app.options('*', cors(corsOptions));

// ==========================================
// 📚 SWAGGER UI DOCUMENTATION
// ==========================================
const file  = fs.readFileSync('./swagger.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));
// ==========================================
// 🚀 FEATURE-BASED ROUTES
// ==========================================

// Authentication & Authorization
app.use('/auth', authRoutes);

// User Management  
app.use('/users', usersRoutes);
app.use('/users', userPermissionsRoutes); // User permissions sub-routes

// 🔑 Individual User Permissions Management (grant/revoke specific permissions)
app.use('/user-permissions', userPermissionsIndividualRoutes);

// Device Management
app.use('/devices', deviceRoutes);

// Organization Management
app.use('/', organizationsRoutes);

// Department Management  
app.use('/', departmentsRoutes);

// Maintenance Management
app.use('/', maintenanceRoutes);

// Alerts & Warnings (Formalized)
app.use('/', alertsRoutes);

// Master Data & Device Data (combined with legacy routes)
app.use('/', deviceDataRoutes, masterDataRoutes);

// ==========================================
// 🔄 LEGACY ROUTES (To be migrated)
// ==========================================

// IoT & MQTT
app.use('/iot', iot);

// Activity Logs
app.use('/actlog', actLog);

// Role Management (will move to /permissions)
app.use('/auth', roleRoutes);

// SSL Configuration
const { options, useHttps } = configureSSL();

// ==================== SIMPLE SOCKET.IO SETUP ====================
let io;

// Start server
if (process.env.NODE_ENV !== 'test') {
    if (useHttps) {
        const httpsServer = https.createServer(options, app);
        
        // ✅ Khởi tạo Socket.IO đơn giản
        io = new Server(httpsServer, {
            cors: {
                origin: allowedOrigins,
                credentials: true
            }
        });

        httpsServer.listen(port, "0.0.0.0", () => {
            console.log(`🔒 HTTPS Server + Socket.IO chạy tại: https://192.168.0.252:${port}`);
        });

        try {
            http.createServer((req, res) => {
                res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
                res.end();
            }).listen(httpPort, () => {
                console.log(`🌍 HTTP Server chạy trên cổng ${httpPort} và tự động chuyển sang HTTPS`);
            });
        } catch (error) {
            console.error("❌ Không thể khởi động HTTP server:", error.message);
        }
    } else {
        const httpServer = http.createServer(app);

        // ✅ Khởi tạo Socket.IO đơn giản
        io = new Server(httpServer, {
            cors: {
                origin: allowedOrigins,
                credentials: true
            }
        });

        httpServer.listen(port, () => {
            console.log(`🌍 HTTP Server + Socket.IO chạy tại: http://localhost:${port}`);
        });
    }

    // ==================== SOCKET.IO EVENT HANDLING ====================
    if (io) {
        // Lắng nghe sự kiện khi client kết nối
        io.on('connection', (socket) => {
            console.log('🔌 New client connected:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('❌ Client disconnected:', socket.id);
            });
        });

        // Tạo global reference cho MQTT dynamic manager
        global.io = io;
        
        console.log('✅ Socket.IO initialized successfully');
    }
}


export default app;