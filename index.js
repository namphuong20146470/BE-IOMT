import express from 'express';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import iot from './routes/iotRoutes.js';

import actLog from './routes/actLog.js';
import masterDataRoutes from './routes/masterDataRoutes.js';
import deviceDataRoutes from './routes/deviceDataRoutes.js';
import authRoutes from './routes/auth.routes.js';
import socketService from './services/socketService.js';

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
const allowedOrigins = [
  'http://localhost:5173',
  'https://iomt.hoangphucthanh.vn',
];
// Middleware
app.use(express.json());
app.use(cookieParser()); // 🍪 Enable cookie parsing for HttpOnly cookies

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // 🔑 Important: Allow cookies in CORS
  methods: ['GET', 'POST','PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Replace the existing test route with this HTML version that includes auto-redirect

// Routes
app.use('/', deviceDataRoutes)
app.use('/auth', authRoutes); // 🔐 JWT Authentication routes
app.use('/iot', iot);
app.use('/actlog', actLog);
app.use('/actlog', masterDataRoutes); // Master data routes

// SSL Configuration
const { options, useHttps } = configureSSL();

// Start server
if (process.env.NODE_ENV !== 'test') {
    if (useHttps) {
        const httpsServer = https.createServer(options, app);
        
        // ✅ Khởi tạo Socket.IO với HTTPS server
        socketService.initialize(httpsServer);

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

        // ✅ Khởi tạo Socket.IO với HTTP server
        socketService.initialize(httpServer);

        httpServer.listen(port, () => {
            console.log(`🌍 HTTP Server + Socket.IO chạy tại: http://localhost:${port}`);
        });
    }
}


export default app;