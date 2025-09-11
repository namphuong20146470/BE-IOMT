import { PrismaClient } from '@prisma/client';
import dynamicMqttManager from '../../Database/mqtt.dynamic.js';

const prisma = new PrismaClient();

// Get device data from generic logs
export const getDeviceData = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate,
      tableName = 'device_data_logs'
    } = req.query;

    // Validate UUID
    if (deviceId && !isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (deviceId) {
      whereClause = `WHERE device_id = $${paramIndex++}::uuid`;
      queryParams.push(deviceId);
    }

    if (startDate && endDate) {
      const connector = deviceId ? 'AND' : 'WHERE';
      whereClause += ` ${connector} timestamp BETWEEN $${paramIndex++}::timestamp AND $${paramIndex++}::timestamp`;
      queryParams.push(startDate, endDate);
    }

    // Check if using generic table or custom table
    let query;
    if (tableName === 'device_data_logs') {
      query = `
        SELECT 
          ddl.*,
          d.serial_number,
          dm.name as model_name,
          dm.manufacturer
        FROM device_data_logs ddl
        LEFT JOIN device d ON ddl.device_id = d.id
        LEFT JOIN device_models dm ON d.model_id = dm.id
        ${whereClause}
        ORDER BY ddl.timestamp DESC
        LIMIT $${paramIndex++}::integer
        OFFSET $${paramIndex++}::integer
      `;
      queryParams.push(parseInt(limit), parseInt(offset));
    } else {
      // For custom tables, construct query dynamically
      query = `
        SELECT 
          *,
          (SELECT serial_number FROM device WHERE id = device_id) as serial_number
        FROM ${tableName}
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++}::integer
        OFFSET $${paramIndex++}::integer
      `;
      queryParams.push(parseInt(limit), parseInt(offset));
    }

    const result = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Get total count
    let countQuery;
    if (tableName === 'device_data_logs') {
      countQuery = `
        SELECT COUNT(*) as total
        FROM device_data_logs
        ${whereClause}
      `;
    } else {
      countQuery = `
        SELECT COUNT(*) as total
        FROM ${tableName}
        ${whereClause}
      `;
    }

    const countResult = await prisma.$queryRawUnsafe(
      countQuery, 
      ...queryParams.slice(0, -2) // Remove limit and offset from count query
    );

    res.json({
      success: true,
      data: result,
      pagination: {
        total: parseInt(countResult[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.length < parseInt(countResult[0].total)
      }
    });

  } catch (error) {
    console.error('Error getting device data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device data',
      details: error.message
    });
  }
};

// Get device data statistics
export const getDeviceDataStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '24h', tableName = 'device_data_logs' } = req.query;

    // Validate UUID
    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    // Calculate time range based on period
    const timeRanges = {
      '1h': '1 hour',
      '24h': '24 hours', 
      '7d': '7 days',
      '30d': '30 days'
    };

    const timeRange = timeRanges[period] || '24 hours';

    let query;
    if (tableName === 'device_data_logs') {
      // Generic JSON data - extract common stats
      query = `
        SELECT 
          COUNT(*) as total_records,
          MIN(timestamp) as first_record,
          MAX(timestamp) as latest_record,
          COUNT(DISTINCT DATE_TRUNC('hour', timestamp)) as active_hours,
          jsonb_object_keys(data_json) as data_keys
        FROM device_data_logs
        WHERE device_id = $1::uuid
        AND timestamp >= NOW() - INTERVAL '${timeRange}'
        GROUP BY data_keys
      `;
    } else {
      // Custom table - get basic stats
      query = `
        SELECT 
          COUNT(*) as total_records,
          MIN(timestamp) as first_record,
          MAX(timestamp) as latest_record,
          COUNT(DISTINCT DATE_TRUNC('hour', timestamp)) as active_hours
        FROM ${tableName}
        WHERE device_id = $1::uuid
        AND timestamp >= NOW() - INTERVAL '${timeRange}'
      `;
    }

    const stats = await prisma.$queryRawUnsafe(query, deviceId);

    // Get device info
    const deviceInfo = await prisma.$queryRaw`
      SELECT 
        d.serial_number,
        d.name as device_name,
        d.status,
        dm.name as model_name,
        dm.manufacturer,
        dc.last_connected,
        dc.is_active as connectivity_active
      FROM device d
      LEFT JOIN device_models dm ON d.model_id = dm.id
      LEFT JOIN device_connectivity dc ON d.id = dc.device_id
      WHERE d.id = ${deviceId}::uuid
    `;

    res.json({
      success: true,
      device: deviceInfo[0],
      statistics: {
        period,
        timeRange,
        ...stats[0]
      }
    });

  } catch (error) {
    console.error('Error getting device data statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device statistics',
      details: error.message
    });
  }
};

// Get real-time device data stream (latest records)
export const getDeviceDataStream = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { tableName = 'device_data_logs', limit = 10 } = req.query;

    // Validate UUID
    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    let query;
    if (tableName === 'device_data_logs') {
      query = `
        SELECT 
          id,
          data_json,
          timestamp
        FROM device_data_logs
        WHERE device_id = $1::uuid
        ORDER BY timestamp DESC
        LIMIT $2::integer
      `;
    } else {
      query = `
        SELECT *
        FROM ${tableName}
        WHERE device_id = $1::uuid
        ORDER BY timestamp DESC
        LIMIT $2::integer
      `;
    }

    const result = await prisma.$queryRawUnsafe(query, deviceId, parseInt(limit));

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting device data stream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device stream',
      details: error.message
    });
  }
};

// Manually simulate device data (for testing)
export const simulateDeviceData = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { data } = req.body;

    // Validate UUID
    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Data payload is required and must be an object'
      });
    }

    // Get device info
    const device = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.serial_number,
        dc.data_mapping,
        dc.table_name,
        dc.warning_config,
        dm.name as model_name
      FROM device d
      LEFT JOIN device_connectivity dc ON d.id = dc.device_id
      LEFT JOIN device_models dm ON d.model_id = dm.id
      WHERE d.id = ${deviceId}::uuid
      AND d.status = 'active'::device_status
    `;

    if (device.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found or inactive'
      });
    }

    // Process data using dynamic MQTT manager logic
    await dynamicMqttManager.processDeviceData(device[0], data);

    res.json({
      success: true,
      message: 'Device data simulated successfully',
      device: {
        id: device[0].id,
        serial_number: device[0].serial_number,
        model_name: device[0].model_name
      },
      processedData: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error simulating device data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate device data',
      details: error.message
    });
  }
};

// Get MQTT connection status
export const getMqttConnectionStatus = async (req, res) => {
  try {
    const status = dynamicMqttManager.getConnectionStatus();
    const activeTopics = dynamicMqttManager.getActiveTopics();

    // Get device connectivity stats from database
    const deviceStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN dc.is_active = true THEN 1 END) as active_connections,
        COUNT(CASE WHEN dc.last_connected > NOW() - INTERVAL '1 hour' THEN 1 END) as recently_connected,
        COUNT(CASE WHEN d.status = 'active' THEN 1 END) as active_devices
      FROM device d
      LEFT JOIN device_connectivity dc ON d.id = dc.device_id
    `;

    res.json({
      success: true,
      mqttManager: status,
      activeTopics,
      deviceStatistics: deviceStats[0]
    });

  } catch (error) {
    console.error('Error getting MQTT status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve MQTT status',
      details: error.message
    });
  }
};

// Force refresh MQTT connections
export const refreshMqttConnections = async (req, res) => {
  try {
    await dynamicMqttManager.initialize();

    res.json({
      success: true,
      message: 'MQTT connections refreshed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error refreshing MQTT connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh MQTT connections',
      details: error.message
    });
  }
};

// Get available data tables for devices
export const getAvailableDataTables = async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name LIKE '%_data%'
      OR table_name = 'device_data_logs'
      ORDER BY table_name, ordinal_position
    `;

    // Group columns by table
    const tableStructure = {};
    tables.forEach(col => {
      if (!tableStructure[col.table_name]) {
        tableStructure[col.table_name] = [];
      }
      tableStructure[col.table_name].push({
        column: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES'
      });
    });

    res.json({
      success: true,
      tables: tableStructure
    });

  } catch (error) {
    console.error('Error getting available data tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data tables',
      details: error.message
    });
  }
};

// Helper function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
