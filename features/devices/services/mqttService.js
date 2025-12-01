// services/mqtt/mqttService.js - Main MQTT service coordinator
import mqttTopicManager from './mqttTopicManager.js';
import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';

const prisma = new PrismaClient();

class MQTTService {
    constructor() {
        this.isInitialized = false;
        this.webSocketServer = null;
        this.connectedClients = new Set();
    }

    /**
     * Initialize MQTT service
     */
    async initialize() {
        try {
            console.log('🚀 Initializing MQTT Service...');

            // Initialize MQTT topic manager
            await mqttTopicManager.initialize();

            // Setup event listeners
            this.setupEventListeners();

            // Initialize WebSocket server for real-time dashboard
            this.initializeWebSocketServer();

            this.isInitialized = true;
            console.log('✅ MQTT Service initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize MQTT Service:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for MQTT events
     */
    setupEventListeners() {
        // Listen for outlet data updates
        mqttTopicManager.on('outletDataReceived', (data) => {
            this.broadcastOutletUpdate(data);
        });

        // Listen for connection events
        mqttTopicManager.on('connected', () => {
            console.log('📡 MQTT connected - service ready');
            this.broadcastConnectionStatus(true);
        });

        mqttTopicManager.on('disconnected', () => {
            console.log('📡 MQTT disconnected');
            this.broadcastConnectionStatus(false);
        });

        mqttTopicManager.on('error', (error) => {
            console.error('📡 MQTT error:', error);
            this.broadcastError(error.message);
        });
    }

    /**
     * Initialize WebSocket server for real-time dashboard
     */
    initializeWebSocketServer() {
        const port = process.env.WEBSOCKET_PORT || 8080;
        
        this.webSocketServer = new WebSocket.Server({ 
            port,
            path: '/mqtt-realtime'
        });

        this.webSocketServer.on('connection', (ws, request) => {
            console.log('🔌 New WebSocket client connected');
            this.connectedClients.add(ws);

            // Send current status on connection
            ws.send(JSON.stringify({
                type: 'connection_status',
                data: mqttTopicManager.getConnectionStatus()
            }));

            // Handle client disconnect
            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.connectedClients.delete(ws);
            });

            // Handle client messages (for subscriptions, etc.)
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('❌ Invalid WebSocket message:', error);
                }
            });
        });

        console.log(`🌐 WebSocket server listening on port ${port}`);
    }

    /**
     * Handle WebSocket messages from clients
     */
    async handleWebSocketMessage(ws, message) {
        try {
            switch (message.type) {
                case 'subscribe_outlet':
                    await this.handleOutletSubscription(ws, message.outlet_id);
                    break;
                
                case 'unsubscribe_outlet':
                    await this.handleOutletUnsubscription(ws, message.outlet_id);
                    break;
                
                case 'get_outlet_status':
                    await this.sendOutletStatus(ws, message.outlet_id);
                    break;
                
                case 'get_all_outlets':
                    await this.sendAllOutletsStatus(ws, message.organization_id);
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error('❌ Error handling WebSocket message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    }

    /**
     * Handle outlet subscription for real-time updates
     */
    async handleOutletSubscription(ws, outletId) {
        // Add outlet to user's subscription list (could store in ws object)
        if (!ws.subscribedOutlets) {
            ws.subscribedOutlets = new Set();
        }
        ws.subscribedOutlets.add(outletId);

        // Send current outlet status
        await this.sendOutletStatus(ws, outletId);
    }

    /**
     * Send current outlet status
     */
    async sendOutletStatus(ws, outletId) {
        try {
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    pdu: {
                        select: { name: true, mqtt_base_topic: true }
                    },
                    device: {
                        select: { serial_number: true, model: { select: { name: true } } }
                    },
                    device_data: {
                        take: 1,
                        orderBy: { timestamp: 'desc' },
                        include: {
                            measurements: { select: { name: true, unit: true } }
                        }
                    }
                }
            });

            if (outlet) {
                ws.send(JSON.stringify({
                    type: 'outlet_status',
                    data: {
                        outlet_id: outlet.id,
                        outlet_number: outlet.outlet_number,
                        status: outlet.status,
                        current_power: outlet.current_power,
                        current_voltage: outlet.current_voltage,
                        current_current: outlet.current_current,
                        last_data_at: outlet.last_data_at,
                        pdu_name: outlet.pdu.name,
                        device_serial: outlet.device?.serial_number,
                        latest_data: outlet.device_data[0] || null,
                        mqtt_topic: mqttTopicManager.getOutletTopic(outletId)
                    }
                }));
            }
        } catch (error) {
            console.error('❌ Error sending outlet status:', error);
        }
    }

    /**
     * Send all outlets status for organization
     */
    async sendAllOutletsStatus(ws, organizationId) {
        try {
            const outlets = await prisma.outlets.findMany({
                where: {
                    pdu: {
                        organization_id: organizationId
                    }
                },
                include: {
                    pdu: {
                        select: { name: true, type: true, location: true }
                    },
                    device: {
                        select: { serial_number: true }
                    }
                },
                orderBy: [
                    { pdu: { name: 'asc' } },
                    { outlet_number: 'asc' }
                ]
            });

            ws.send(JSON.stringify({
                type: 'all_outlets_status',
                data: outlets.map(outlet => ({
                    outlet_id: outlet.id,
                    outlet_number: outlet.outlet_number,
                    status: outlet.status,
                    current_power: outlet.current_power,
                    pdu_name: outlet.pdu.name,
                    pdu_location: outlet.pdu.location,
                    device_serial: outlet.device?.serial_number,
                    mqtt_topic: mqttTopicManager.getOutletTopic(outlet.id)
                }))
            }));
        } catch (error) {
            console.error('❌ Error sending all outlets status:', error);
        }
    }

    /**
     * Broadcast outlet update to subscribed clients
     */
    broadcastOutletUpdate(data) {
        const message = JSON.stringify({
            type: 'outlet_update',
            data
        });

        this.connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                // Check if client is subscribed to this outlet
                if (!ws.subscribedOutlets || ws.subscribedOutlets.has(data.outlet_id)) {
                    ws.send(message);
                }
            }
        });
    }

    /**
     * Broadcast connection status to all clients
     */
    broadcastConnectionStatus(connected) {
        const message = JSON.stringify({
            type: 'mqtt_connection',
            data: { connected, timestamp: new Date().toISOString() }
        });

        this.connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * Broadcast error to all clients
     */
    broadcastError(errorMessage) {
        const message = JSON.stringify({
            type: 'mqtt_error',
            data: { error: errorMessage, timestamp: new Date().toISOString() }
        });

        this.connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * Add new outlet to MQTT monitoring
     */
    async addOutletMonitoring(outletId) {
        const success = await mqttTopicManager.addOutletTopic(outletId);
        
        if (success) {
            // Notify all clients about new outlet
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    pdu: { select: { name: true } }
                }
            });

            this.broadcastToAllClients({
                type: 'outlet_added',
                data: {
                    outlet_id: outletId,
                    outlet_number: outlet.outlet_number,
                    pdu_name: outlet.pdu.name,
                    mqtt_topic: mqttTopicManager.getOutletTopic(outletId)
                }
            });
        }

        return success;
    }

    /**
     * Remove outlet from MQTT monitoring
     */
    async removeOutletMonitoring(outletId) {
        const success = await mqttTopicManager.removeOutletTopic(outletId);
        
        if (success) {
            this.broadcastToAllClients({
                type: 'outlet_removed',
                data: { outlet_id: outletId }
            });
        }

        return success;
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcastToAllClients(message) {
        const messageStr = JSON.stringify(message);
        
        this.connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            mqtt_status: mqttTopicManager.getConnectionStatus(),
            websocket_clients: this.connectedClients.size,
            monitored_outlets: mqttTopicManager.getAllTopics().length
        };
    }

    /**
     * Gracefully shutdown service
     */
    async shutdown() {
        console.log('🛑 Shutting down MQTT Service...');
        
        // Close WebSocket server
        if (this.webSocketServer) {
            this.webSocketServer.close();
        }

        // Disconnect MQTT
        await mqttTopicManager.disconnect();
        
        console.log('✅ MQTT Service shutdown complete');
    }
}

// Create singleton instance
const mqttService = new MQTTService();

export default mqttService;