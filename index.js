import express from 'express';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import iot from './routes/iotRoutes.js';

import actLog from './routes/actLog.js';
// import '../BE-DX/controllers/MQTT/mqtt-client.js'; // Add this line to import MQTT client
import './Database/mqtt.database.js'; // Ensure this is the correct path to your MQTT database file
import { configureSSL } from './config/ssl.js';


dotenv.config();

const app = express();
const prisma = new PrismaClient();
// Port configuration  
const port = process.env.PORT || 3005;
const httpPort = process.env.HTTP_PORT || 3006;

// Middleware
app.use(express.json());
app.use(cors());

// Replace the existing test route with this HTML version that includes auto-redirect

// Routes
app.use('/iot', iot);
app.use('/actlog', actLog);

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