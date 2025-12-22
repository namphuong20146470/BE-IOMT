import express from 'express';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import iot from './routes/iotRoutes.js';

// Swagger UI imports
import swaggerUI from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';

// No longer need custom security - using Swagger built-in auth

// ==========================================
// 🏗️ FEATURE-BASED ARCHITECTURE ROUTES
// ==========================================
// Each feature is self-contained with its own:
// - Controllers (business logic)
// - Routes (API endpoints) 
// - Services (data layer)
// - Validation (input validation)
// - README (documentation)

// Keep only routes not yet migrated to features
import deviceDataRoutes from './features/devices/deviceData.routes.js';

// Legacy routes (to be migrated to features)
import mqttRoutes from './routes/mqttRoutes.js';

// Legacy MQTT system (keep existing)
import './Database/mqtt.database.js';
// Socket-based MQTT system (for PDU sockets)
import socketMQTTClient from './features/mqtt/socket-mqtt-client.js';
import { configureSSL } from './config/ssl.js';


dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ✅ Trust proxy for correct IP detection
app.set('trust proxy', true);

// Port configuration  
const port = process.env.PORT || 3030;
const httpPort = process.env.HTTP_PORT || 3031;

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
// 📚 SWAGGER UI DOCUMENTATION - SECURED
// ==========================================
const file = fs.readFileSync('./swagger.yaml', 'utf8');
const swaggerDocument = YAML.parse(file);

// 📚 Swagger UI - Simple Setup with Built-in Security
app.use('/api-docs', 
    swaggerUI.serve, 
    swaggerUI.setup(swaggerDocument, {
        customCss: `
            .swagger-ui .topbar { display: none !important; }
            .swagger-ui .info .title { color: #1976d2 !important; }
        `,
        customSiteTitle: '📚 IoMT API Documentation',
        swaggerOptions: {
            persistAuthorization: true, // Lưu token trong localStorage để tiện dùng
            displayRequestDuration: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            showCommonExtensions: true,
            showExtensions: true,
            tryItOutEnabled: true
        }
    })
);

// API docs now available at /api-docs with Swagger built-in auth
// ==========================================
// 🚀 FEATURE-BASED ROUTES
// ==========================================

// Individual routes are now handled by /api router

// Dashboard Management
import dashboardRoutes from './routes/dashboardRoutes.js';
app.use('/dashboards', dashboardRoutes);

// Main API Routes (from features) - Version 1  
import apiRoutes from './routes/index.js';
app.use('/api/v1', apiRoutes);

//Device Data API
app.use('/api/v1', deviceDataRoutes);

// ==========================================
// 🔄 LEGACY ROUTES (To be migrated)  
// ==========================================

// MQTT routes moved to /api/v1/mqtt

// SSL Configuration
const { options, useHttps } = configureSSL();

// ==================== START HTTP/HTTPS SERVER ====================

// Start server
if (process.env.NODE_ENV !== 'test') {
    if (useHttps) {
        const httpsServer = https.createServer(options, app);

        httpsServer.listen(port, "0.0.0.0", () => {
            console.log(`🔒 HTTPS Server running at: https://192.168.0.252:${port}`);
        });

        // HTTP redirect to HTTPS
        try {
            http.createServer((req, res) => {
                res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
                res.end();
            }).listen(httpPort, () => {
                console.log(`🌍 HTTP Server on port ${httpPort} redirects to HTTPS`);
            });
        } catch (error) {
            console.error("❌ Failed to start HTTP redirect server:", error.message);
        }
    } else {
        const httpServer = http.createServer(app);

        httpServer.listen(port, () => {
            console.log(`🌍 HTTP Server running at: http://localhost:${port}`);
        });
    }

    // ==================== INITIALIZE SOCKET-BASED MQTT CLIENT ====================
    setTimeout(async () => {
        try {
            console.log('🚀 Initializing Socket-based MQTT Client...');
            
            // Add error handler to prevent crashes
            socketMQTTClient.on('error', (errorData) => {
                console.error('🚨 Socket MQTT Error:', {
                    socketId: errorData.socketId,
                    socketNumber: errorData.socket?.socket_number,
                    error: errorData.error.message,
                    code: errorData.error.code
                });
            });
            
            await socketMQTTClient.initializeAll();
            console.log('✅ Socket MQTT Client initialized');
        } catch (error) {
            console.error('❌ Error initializing Socket MQTT Client:', error);
        }
    }, 3000); // Wait 3s for server to be fully ready
}

export default app;