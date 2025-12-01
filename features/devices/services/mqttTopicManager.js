// services/mqtt/mqttTopicManager.js
import { PrismaClient } from '@prisma/client';
import mqtt from 'mqtt';
import EventEmitter from 'events';

const prisma = new PrismaClient();

class MQTTTopicManager extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.subscribedTopics = new Map(); // topic -> outlet info
        this.outletTopics = new Map(); // outlet_id -> topic
        this.connectionConfig = {
            host: process.env.MQTT_HOST || 'localhost',
            port: parseInt(process.env.MQTT_PORT) || 1883,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 30000
        };
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
    }

    /**
     * Initialize MQTT connection and load outlet subscriptions
     */
    async initialize() {
        try {
            console.log('🚀 Initializing MQTT Topic Manager...');
            
            // Connect to MQTT broker
            await this.connect();
            
            // Load existing outlet topics from database
            await this.loadOutletTopics();
            
            // Subscribe to all active outlet topics
            await this.subscribeToActiveOutlets();
            
            console.log('✅ MQTT Topic Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize MQTT Topic Manager:', error);
            throw error;
        }
    }

    /**
     * Connect to MQTT broker
     */
    async connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to MQTT broker at ${this.connectionConfig.host}:${this.connectionConfig.port}`);
            
            this.client = mqtt.connect(this.connectionConfig);

            this.client.on('connect', () => {
                console.log('✅ Connected to MQTT broker');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
                resolve();
            });

            this.client.on('error', (error) => {
                console.error('❌ MQTT connection error:', error);
                this.isConnected = false;
                this.emit('error', error);
                reject(error);
            });

            this.client.on('message', (topic, message) => {
                this.handleIncomingMessage(topic, message);
            });

            this.client.on('close', () => {
                console.log('🔌 MQTT connection closed');
                this.isConnected = false;
                this.emit('disconnected');
            });

            this.client.on('reconnect', () => {
                this.reconnectAttempts++;
                console.log(`🔄 Reconnecting to MQTT broker (attempt ${this.reconnectAttempts})`);
                
                if (this.reconnectAttempts > this.maxReconnectAttempts) {
                    console.error('❌ Max reconnection attempts reached');
                    this.client.end();
                }
            });
        });
    }

    /**
     * Load all outlet topics from database
     */
    async loadOutletTopics() {
        try {
            console.log('📚 Loading outlet topics from database...');
            
            const outlets = await prisma.outlets.findMany({
                where: {
                    is_enabled: true,
                    pdu: {
                        is_active: true,
                        mqtt_base_topic: { not: null }
                    }
                },
                include: {
                    pdu: {
                        select: {
                            mqtt_base_topic: true,
                            organization_id: true,
                            department_id: true
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            serial_number: true
                        }
                    }
                }
            });

            // Clear existing mappings
            this.outletTopics.clear();
            this.subscribedTopics.clear();

            // Build topic mappings
            outlets.forEach(outlet => {
                if (outlet.pdu.mqtt_base_topic && outlet.mqtt_topic_suffix) {
                    const topic = `${outlet.pdu.mqtt_base_topic}/${outlet.mqtt_topic_suffix}`;
                    
                    this.outletTopics.set(outlet.id, topic);
                    this.subscribedTopics.set(topic, {
                        outlet_id: outlet.id,
                        outlet_number: outlet.outlet_number,
                        device_id: outlet.device_id,
                        pdu_id: outlet.pdu_id,
                        organization_id: outlet.pdu.organization_id,
                        department_id: outlet.pdu.department_id
                    });
                }
            });

            console.log(`📊 Loaded ${this.outletTopics.size} outlet topics`);
            
        } catch (error) {
            console.error('❌ Error loading outlet topics:', error);
            throw error;
        }
    }

    /**
     * Subscribe to all active outlet topics
     */
    async subscribeToActiveOutlets() {
        if (!this.isConnected) {
            throw new Error('MQTT client not connected');
        }

        console.log('📡 Subscribing to outlet topics...');
        
        const topics = Array.from(this.subscribedTopics.keys());
        
        if (topics.length === 0) {
            console.log('ℹ️ No topics to subscribe to');
            return;
        }

        return new Promise((resolve, reject) => {
            this.client.subscribe(topics, { qos: 1 }, (error) => {
                if (error) {
                    console.error('❌ Error subscribing to topics:', error);
                    reject(error);
                } else {
                    console.log(`✅ Subscribed to ${topics.length} topics:`);
                    topics.forEach(topic => console.log(`   - ${topic}`));
                    resolve();
                }
            });
        });
    }

    /**
     * Handle incoming MQTT message
     */
    async handleIncomingMessage(topic, message) {
        try {
            const outletInfo = this.subscribedTopics.get(topic);
            
            if (!outletInfo) {
                console.log(`⚠️ Received message for unknown topic: ${topic}`);
                return;
            }

            // Parse message payload
            let data;
            try {
                data = JSON.parse(message.toString());
            } catch (parseError) {
                console.error(`❌ Invalid JSON in message from ${topic}:`, parseError);
                return;
            }

            console.log(`📨 Received data from ${topic}:`, data);

            // Process the data
            await this.processOutletData(outletInfo, data, topic);

        } catch (error) {
            console.error(`❌ Error handling message from ${topic}:`, error);
        }
    }

    /**
     * Process outlet data and save to database
     */
    async processOutletData(outletInfo, data, topic) {
        try {
            const timestamp = new Date(data.timestamp || Date.now());
            
            // Validate required data fields
            if (!this.validateDataPayload(data)) {
                console.log(`⚠️ Invalid data payload from ${topic}`);
                return;
            }

            // Start transaction for data processing
            await prisma.$transaction(async (tx) => {
                // Update outlet real-time status
                await tx.outlets.update({
                    where: { id: outletInfo.outlet_id },
                    data: {
                        status: this.determineOutletStatus(data),
                        current_power: data.power || null,
                        current_voltage: data.voltage || null,
                        current_current: data.current || null,
                        last_data_at: timestamp
                    }
                });

                // Save device data for different measurements
                const measurements = await tx.measurements.findMany({
                    where: {
                        name: { in: Object.keys(data).filter(k => k !== 'timestamp') }
                    }
                });

                for (const measurement of measurements) {
                    if (data[measurement.name] !== undefined) {
                        // Save to device_data
                        await tx.device_data.create({
                            data: {
                                device_id: outletInfo.device_id,
                                measurement_id: measurement.id,
                                outlet_id: outletInfo.outlet_id,
                                data_payload: data,
                                timestamp
                            }
                        });

                        // Update latest data
                        await tx.device_latest_data.upsert({
                            where: {
                                device_id_measurement_id: {
                                    device_id: outletInfo.device_id,
                                    measurement_id: measurement.id
                                }
                            },
                            update: {
                                latest_value: parseFloat(data[measurement.name]),
                                updated_at: timestamp
                            },
                            create: {
                                device_id: outletInfo.device_id,
                                measurement_id: measurement.id,
                                latest_value: parseFloat(data[measurement.name]),
                                updated_at: timestamp
                            }
                        });
                    }
                }

                // Log raw data for backup
                await tx.device_data_logs.create({
                    data: {
                        device_id: outletInfo.device_id,
                        outlet_id: outletInfo.outlet_id,
                        data_json: data,
                        timestamp
                    }
                });
            });

            // Emit real-time event for dashboard
            this.emit('outletDataReceived', {
                outlet_id: outletInfo.outlet_id,
                outlet_number: outletInfo.outlet_number,
                topic,
                data,
                timestamp
            });

            console.log(`✅ Processed data for outlet ${outletInfo.outlet_number}`);

        } catch (error) {
            console.error('❌ Error processing outlet data:', error);
        }
    }

    /**
     * Validate MQTT data payload
     */
    validateDataPayload(data) {
        // Check if we have at least one measurement
        const validFields = ['power', 'voltage', 'current', 'temperature'];
        return validFields.some(field => data[field] !== undefined && !isNaN(data[field]));
    }

    /**
     * Determine outlet status based on data
     */
    determineOutletStatus(data) {
        // Check for error conditions
        if (data.error || data.fault) {
            return 'error';
        }

        // Check if outlet is actively consuming power
        if (data.power > 5) { // More than 5W indicates active usage
            return 'active';
        }

        // If we have voltage but minimal power, device is connected but idle
        if (data.voltage > 100) {
            return 'idle';
        }

        // No significant readings
        return 'inactive';
    }

    /**
     * Add new outlet topic subscription
     */
    async addOutletTopic(outletId) {
        try {
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    pdu: {
                        select: {
                            mqtt_base_topic: true,
                            organization_id: true,
                            department_id: true
                        }
                    }
                }
            });

            if (!outlet || !outlet.pdu.mqtt_base_topic || !outlet.mqtt_topic_suffix) {
                console.log(`⚠️ Cannot create topic for outlet ${outletId} - missing topic configuration`);
                return false;
            }

            const topic = `${outlet.pdu.mqtt_base_topic}/${outlet.mqtt_topic_suffix}`;
            
            // Add to mappings
            this.outletTopics.set(outletId, topic);
            this.subscribedTopics.set(topic, {
                outlet_id: outletId,
                outlet_number: outlet.outlet_number,
                device_id: outlet.device_id,
                pdu_id: outlet.pdu_id,
                organization_id: outlet.pdu.organization_id,
                department_id: outlet.pdu.department_id
            });

            // Subscribe if connected
            if (this.isConnected) {
                await new Promise((resolve, reject) => {
                    this.client.subscribe(topic, { qos: 1 }, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            console.log(`✅ Subscribed to new topic: ${topic}`);
                            resolve();
                        }
                    });
                });
            }

            return true;

        } catch (error) {
            console.error(`❌ Error adding outlet topic for ${outletId}:`, error);
            return false;
        }
    }

    /**
     * Remove outlet topic subscription
     */
    async removeOutletTopic(outletId) {
        try {
            const topic = this.outletTopics.get(outletId);
            
            if (!topic) {
                return false;
            }

            // Remove from mappings
            this.outletTopics.delete(outletId);
            this.subscribedTopics.delete(topic);

            // Unsubscribe if connected
            if (this.isConnected) {
                await new Promise((resolve, reject) => {
                    this.client.unsubscribe(topic, (error) => {
                        if (error) {
                            reject(error);
                        } else {
                            console.log(`✅ Unsubscribed from topic: ${topic}`);
                            resolve();
                        }
                    });
                });
            }

            return true;

        } catch (error) {
            console.error(`❌ Error removing outlet topic for ${outletId}:`, error);
            return false;
        }
    }

    /**
     * Get topic for specific outlet
     */
    getOutletTopic(outletId) {
        return this.outletTopics.get(outletId);
    }

    /**
     * Get all subscribed topics
     */
    getAllTopics() {
        return Array.from(this.subscribedTopics.keys());
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            subscribed_topics: this.subscribedTopics.size,
            reconnect_attempts: this.reconnectAttempts
        };
    }

    /**
     * Gracefully disconnect
     */
    async disconnect() {
        if (this.client) {
            console.log('🔌 Disconnecting from MQTT broker...');
            this.client.end();
            this.isConnected = false;
        }
    }
}

// Create singleton instance
const mqttTopicManager = new MQTTTopicManager();

export default mqttTopicManager;