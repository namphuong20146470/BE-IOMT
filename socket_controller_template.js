// Example controller queries for new socket schema
// Use this as template to update all socket controllers

// ==================== GET ALL RECORDS ====================
export const getAllSocketData = async (req, res) => {
    try {
        const socketData = await prisma.$queryRaw`
            SELECT 
                id,
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket1_data
            ORDER BY id DESC
        `;

        return res.status(200).json({
            success: true,
            data: socketData,
            message: 'Successfully retrieved socket data'
        });
    } catch (error) {
        console.error('Error fetching socket data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve socket data',
            error: error.message
        });
    }
};

// ==================== GET LATEST RECORD ====================
export const getLatestSocketData = async (req, res) => {
    try {
        const latestSocket = await prisma.$queryRaw`
            SELECT 
                id,
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage,
                timestamp,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM socket1_data
            ORDER BY timestamp DESC
            LIMIT 1
        `;

        return res.status(200).json({
            success: true,
            data: latestSocket[0] || null,
            message: 'Successfully retrieved latest socket data'
        });
    } catch (error) {
        console.error('Error fetching latest socket data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve latest socket data',
            error: error.message
        });
    }
};

// ==================== ADD NEW RECORD ====================
export const addSocketData = async (req, res) => {
    try {
        const {
            voltage,
            current,
            power,
            frequency,
            power_factor,
            machine_state,
            socket_state,
            sensor_state,
            over_voltage,
            under_voltage
        } = req.body;

        const result = await prisma.$queryRaw`
            INSERT INTO socket1_data (
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage,
                timestamp
            ) VALUES (
                ${voltage}::real,
                ${current}::real,
                ${power}::real,
                ${frequency}::real,
                ${power_factor}::real,
                ${machine_state}::boolean,
                ${socket_state}::boolean,
                ${sensor_state}::boolean,
                ${over_voltage}::boolean,
                ${under_voltage}::boolean,
                CURRENT_TIMESTAMP
            )
            RETURNING id, timestamp
        `;

        // Check for warnings based on new fields
        await checkDeviceWarnings('socket1_data', {
            voltage,
            current,
            power,
            frequency,
            power_factor,
            over_voltage,
            under_voltage
        }, result[0].id);

        return res.status(201).json({
            success: true,
            data: {
                id: result[0].id,
                timestamp: result[0].timestamp,
                voltage,
                current,
                power,
                frequency,
                power_factor,
                machine_state,
                socket_state,
                sensor_state,
                over_voltage,
                under_voltage
            },
            message: 'Socket data added successfully'
        });
    } catch (error) {
        console.error('Error adding socket data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add socket data',
            error: error.message
        });
    }
};

// ==================== GET DATA BY TIME RANGE ====================
export const getSocketDataByTimeRange = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'hour' } = req.query;
        
        const timeInterval = getTimeGroupInterval(groupBy);
        if (!timeInterval) {
            return res.status(400).json({
                success: false,
                message: 'Invalid groupBy parameter'
            });
        }

        const socketData = await prisma.$queryRaw`
            SELECT 
                date_trunc(${timeInterval}, timestamp) as time_group,
                AVG(voltage) as avg_voltage,
                AVG(current) as avg_current,
                AVG(power) as avg_power,
                AVG(frequency) as avg_frequency,
                AVG(power_factor) as avg_power_factor,
                COUNT(*) as record_count,
                BOOL_OR(machine_state) as any_machine_active,
                BOOL_OR(socket_state) as any_socket_active,
                BOOL_OR(sensor_state) as any_sensor_active,
                BOOL_OR(over_voltage) as any_over_voltage,
                BOOL_OR(under_voltage) as any_under_voltage
            FROM socket1_data
            WHERE timestamp >= ${startDate}::timestamp 
                AND timestamp <= ${endDate}::timestamp
            GROUP BY date_trunc(${timeInterval}, timestamp)
            ORDER BY time_group DESC
        `;

        return res.status(200).json({
            success: true,
            data: socketData,
            message: 'Successfully retrieved socket data by time range'
        });
    } catch (error) {
        console.error('Error fetching socket data by time range:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve socket data by time range',
            error: error.message
        });
    }
};

// Helper function for time intervals
function getTimeGroupInterval(groupBy) {
    const intervalMap = {
        'minute': 'minute',
        'hour': 'hour',
        'day': 'day',
        'week': 'week',
        'month': 'month'
    };
    
    return intervalMap[groupBy] || null;
}