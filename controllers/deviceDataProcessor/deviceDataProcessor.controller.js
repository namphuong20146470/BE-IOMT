import { PrismaClient } from '@prisma/client';
// import dynamicMqttManager from '../../Database/mqtt.dynamic.js'; // REMOVED - no longer used

const prisma = new PrismaClient();

/**
 * Get device data with advanced filtering and aggregation
 * Supports: time range, interval grouping, metric selection, pagination
 */
export const getDeviceData = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      limit = 50, 
      offset = 0,
      // ✅ New params for better chart support
      startTime,      // ISO timestamp (e.g., 2025-09-12T07:00:00Z)
      endTime,        // ISO timestamp
      interval,       // Time grouping: 1m, 5m, 15m, 1h, 1d
      metrics,        // Comma-separated fields: current,voltage,power
      // ✅ Backward compatibility
      startDate,      
      endDate,
      tableName = 'device_data'
    } = req.query;

    // Validate UUID
    if (deviceId && !isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    // Parse time range (support both old and new params)
    const timeStart = startTime || startDate;
    const timeEnd = endTime || endDate;

    // Parse metrics filter
    const selectedMetrics = metrics ? metrics.split(',').map(m => m.trim()) : null;

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (deviceId) {
      whereClause = `WHERE device_id = $${paramIndex++}::uuid`;
      queryParams.push(deviceId);
    }

    if (timeStart && timeEnd) {
      const connector = deviceId ? 'AND' : 'WHERE';
      whereClause += ` ${connector} timestamp BETWEEN $${paramIndex++}::timestamp AND $${paramIndex++}::timestamp`;
      queryParams.push(timeStart, timeEnd);
    }

    // Build SELECT clause based on metrics filter and interval
    let selectClause;
    let groupByClause = '';
    let orderByClause = 'ORDER BY timestamp DESC';

    if (interval) {
      // ✅ Aggregated query with time interval grouping
      const intervalMap = {
        '1m': '1 minute',
        '5m': '5 minutes',
        '15m': '15 minutes',
        '30m': '30 minutes',
        '1h': '1 hour',
        '2h': '2 hours',
        '6h': '6 hours',
        '12h': '12 hours',
        '1d': '1 day'
      };

      const postgresInterval = intervalMap[interval] || '1 hour';

      // Build aggregated SELECT with optional metric filtering
      const metricsToAggregate = selectedMetrics || ['voltage', 'current', 'power', 'frequency', 'power_factor'];
      
      const aggFields = metricsToAggregate.map(metric => `
        AVG(${metric}) as ${metric}_avg,
        MIN(${metric}) as ${metric}_min,
        MAX(${metric}) as ${metric}_max
      `).join(',');

      selectClause = `
        DATE_TRUNC('${postgresInterval.split(' ')[1]}', timestamp) + 
        INTERVAL '${postgresInterval}' * FLOOR(EXTRACT(EPOCH FROM timestamp - DATE_TRUNC('${postgresInterval.split(' ')[1]}', timestamp)) / EXTRACT(EPOCH FROM INTERVAL '${postgresInterval}')) as time_bucket,
        COUNT(*) as data_points,
        ${aggFields}
      `;
      
      groupByClause = 'GROUP BY time_bucket';
      orderByClause = 'ORDER BY time_bucket DESC';

    } else if (selectedMetrics) {
      // ✅ Raw query with metric filtering (no aggregation)
      const metricFields = selectedMetrics.join(', ');
      selectClause = `id, device_id, ${metricFields}, timestamp`;
      
    } else {
      // ✅ Full raw query (all fields)
      selectClause = '*';
    }

    // Build final query
    let query;
    if (tableName === 'device_data_logs') {
      query = `
        SELECT 
          ${selectClause}${!interval && !selectedMetrics ? `,
          d.serial_number,
          dm.name as model_name,
          dm.manufacturer_id` : ''}
        FROM device_data_logs ${interval || selectedMetrics ? '' : 'ddl'}
        ${!interval && !selectedMetrics ? `
        LEFT JOIN device d ON ddl.device_id = d.id
        LEFT JOIN device_models dm ON d.model_id = dm.id` : ''}
        ${whereClause}
        ${groupByClause}
        ${orderByClause}
        ${!interval ? `LIMIT $${paramIndex++}::integer OFFSET $${paramIndex++}::integer` : ''}
      `;
    } else {
      query = `
        SELECT 
          ${selectClause}${!interval && !selectedMetrics ? `,
          (SELECT serial_number FROM device WHERE id = device_id) as serial_number` : ''}
        FROM ${tableName}
        ${whereClause}
        ${groupByClause}
        ${orderByClause}
        ${!interval ? `LIMIT $${paramIndex++}::integer OFFSET $${paramIndex++}::integer` : ''}
      `;
    }

    // Add pagination params if not using interval
    if (!interval) {
      queryParams.push(parseInt(limit), parseInt(offset));
    }

    const result = await prisma.$queryRawUnsafe(query, ...queryParams);

    // Get total count (skip if using interval aggregation)
    let totalCount = result.length;
    if (!interval) {
      let countQuery = `
        SELECT COUNT(*) as total
        FROM ${tableName}
        ${whereClause}
      `;
      const countResult = await prisma.$queryRawUnsafe(
        countQuery, 
        ...queryParams.slice(0, deviceId ? (timeStart && timeEnd ? 3 : 1) : (timeStart && timeEnd ? 2 : 0))
      );
      totalCount = parseInt(countResult[0].total);
    }

    res.json({
      success: true,
      data: result,
      pagination: interval ? undefined : {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.length < totalCount
      },
      metadata: {
        interval: interval || 'raw',
        metrics: selectedMetrics || 'all',
        timeRange: timeStart && timeEnd ? {
          start: timeStart,
          end: timeEnd
        } : undefined,
        dataPoints: result.length
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
        dm.manufacturer_id,
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
    const { limit = 100 } = req.query;

    // Validate UUID
    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    // Query from device_data table with flat structure (optimized for charts)
    const query = `
      SELECT 
        id,
        timestamp,
        voltage,
        current,
        power,
        frequency,
        power_factor,
        sensor_state,
        socket_state,
        machine_state,
        over_voltage,
        under_voltage
      FROM device_data
      WHERE device_id = $1::uuid
      ORDER BY timestamp DESC
      LIMIT $2::integer
    `;

    const result = await prisma.$queryRawUnsafe(query, deviceId, parseInt(limit));

    res.json({
      success: true,
      data: result,
      meta: {
        device_id: deviceId,
        count: result.length,
        limit: parseInt(limit),
        timestamp: new Date().toISOString()
      }
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

// Get device current state (real-time status)
export const getDeviceCurrentState = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Validate UUID
    if (!isValidUUID(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID format'
      });
    }

    // Get current state - focus on real-time data, minimal metadata
    const currentState = await prisma.device_current_state.findUnique({
      where: { device_id: deviceId },
      include: {
        device: {
          select: {
            serial_number: true,
            status: true
          }
        },
        socket: {
          select: {
            socket_number: true,
            pdu: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      }
    });

    if (!currentState) {
      return res.status(404).json({
        success: false,
        message: 'Device current state not found'
      });
    }

    res.json({
      success: true,
      data: currentState,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting device current state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device current state',
      details: error.message
    });
  }
};

// Helper function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
