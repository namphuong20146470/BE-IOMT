import express from 'express';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import iot from './routes/iotRoutes.js';

import actLog from './routes/actLog.js';
import masterDataRoutes from './routes/masterDataRoutes.js';
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


app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Replace the existing test route with this HTML version that includes auto-redirect

// Routes
app.use('/iot', iot);
app.use('/actlog', actLog);
app.use('/actlog', masterDataRoutes); // Master data routes

// SSL Configuration
const { options, useHttps } = configureSSL();

// Start server
if (process.env.NODE_ENV !== 'test') {
    if (useHttps) {
        https.createServer(options, app).listen(port, "0.0.0.0", () => {
            console.log(`🔒 Server HTTPS chạy tại: https://192.168.0.252:${port}`);
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
        app.listen(port, () => {
            console.log(`Server đang chạy tại http://localhost:${port}`);
        });
    }
}

export default app;