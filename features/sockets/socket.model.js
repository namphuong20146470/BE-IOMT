// features/sockets/socket.model.js
import { z } from 'zod';

/**
 * Socket Model - Validation schemas and data models
 */

export const SocketUpdateSchema = z.object({
    name: z.string().max(100).optional(),
    is_enabled: z.boolean().optional(),
    max_power_watts: z.number().positive().optional(),
    voltage_rating: z.number().positive().optional(),
    connector_type: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    mqtt_topic_suffix: z.string().max(100).optional(),
    mqtt_broker_host: z.string().max(255).optional(),
    mqtt_broker_port: z.number().int().min(1).max(65535).optional(),
    mqtt_credentials: z.object({
        username: z.string().max(100).optional(),
        password: z.string().max(100).optional(),
        ssl_enabled: z.boolean().optional(),
        ca_cert: z.string().optional(),
        client_cert: z.string().optional(),
        client_key: z.string().optional()
    }).optional(),
    mqtt_config: z.object({
        qos: z.number().int().min(0).max(2).optional(),
        retain: z.boolean().optional(),
        keepalive: z.number().int().min(1).max(3600).optional(),
        clean_session: z.boolean().optional(),
        reconnect_period: z.number().int().min(1000).optional()
    }).optional()
});

export const SocketQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).default('20'),
    pdu_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    status: z.enum(['active', 'idle', 'error', 'inactive']).optional(),
    assigned: z.string().transform(val => val === 'true').optional(),
    search: z.string().min(1).optional(),
    include_device: z.string().transform(val => val === 'true').default('false'),
    include_data: z.string().transform(val => val === 'true').default('false'),
    sort_by: z.enum(['socket_number', 'name', 'status', 'assigned_at']).default('socket_number'),
    sort_order: z.enum(['asc', 'desc']).default('asc')
});

export const SocketDataQuerySchema = z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    interval: z.enum(['minute', 'hour', 'day']).default('hour'),
    metrics: z.string().optional(), // comma-separated
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 1000).default('100')
});

export const SocketAssignmentSchema = z.object({
    device_id: z.string().uuid('Invalid device ID'),
    notes: z.string().max(500).optional()
});

export const SocketUnassignmentSchema = z.object({
    notes: z.string().max(500).optional()
});

export const SocketControlSchema = z.object({
    action: z.enum(['turn_on', 'turn_off', 'reset', 'toggle']),
    force: z.boolean().default(false)
});

export const BulkAssignmentSchema = z.object({
    assignments: z.array(z.object({
        socket_id: z.string().uuid(),
        device_id: z.string().uuid(),
        notes: z.string().max(500).optional()
    })).min(1).max(50)
});

export const SocketTransferSchema = z.object({
    from_socket_id: z.string().uuid(),
    to_socket_id: z.string().uuid(),
    notes: z.string().max(500).optional()
});

export const SocketMqttConfigSchema = z.object({
    mqtt_broker_host: z.string().min(1).max(255),
    mqtt_broker_port: z.number().int().min(1).max(65535).default(1883),
    mqtt_credentials: z.object({
        username: z.string().max(100).default(''),
        password: z.string().max(100).default(''),
        ssl_enabled: z.boolean().default(false),
        ca_cert: z.string().optional(),
        client_cert: z.string().optional(),
        client_key: z.string().optional()
    }).default({}),
    mqtt_config: z.object({
        qos: z.number().int().min(0).max(2).default(1),
        retain: z.boolean().default(false),
        keepalive: z.number().int().min(1).max(3600).default(60),
        clean_session: z.boolean().default(true),
        reconnect_period: z.number().int().min(1000).default(5000)
    }).default({})
});

export const SocketModel = {
    update: SocketUpdateSchema,
    query: SocketQuerySchema,
    dataQuery: SocketDataQuerySchema,
    assignment: SocketAssignmentSchema,
    unassignment: SocketUnassignmentSchema,
    control: SocketControlSchema,
    bulkAssignment: BulkAssignmentSchema,
    transfer: SocketTransferSchema,
    mqttConfig: SocketMqttConfigSchema
};

export default SocketModel;