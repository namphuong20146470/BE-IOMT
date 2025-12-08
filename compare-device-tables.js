import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function compareDeviceDataTables() {
    try {
        const deviceId = '9b2131c1-6c36-44ac-9b48-2e88f123d218';
        
        console.log('📊 Comparing device_data vs device_data_logs');
        console.log('=' .repeat(80));
        
        // 1. Count records in each table
        console.log('\n📈 RECORD COUNTS:');
        
        const dataLogsCount = await prisma.device_data_logs.count({
            where: { device_id: deviceId }
        });
        
        const deviceDataCount = await prisma.device_data.count({
            where: { device_id: deviceId }
        });
        
        console.log(`📝 device_data_logs: ${dataLogsCount} records`);
        console.log(`📊 device_data: ${deviceDataCount} records`);
        
        // 2. Latest records from device_data_logs
        console.log('\n📝 LATEST device_data_logs (Raw MQTT):');
        const latestLogs = await prisma.device_data_logs.findMany({
            where: { device_id: deviceId },
            orderBy: { timestamp: 'desc' },
            take: 5,
            select: {
                id: true,
                data_json: true,
                timestamp: true,
                socket_id: true
            }
        });
        
        latestLogs.forEach((log, index) => {
            console.log(`${index + 1}. [${log.timestamp.toISOString()}] Socket: ${log.socket_id?.substring(0,8)}...`);
            console.log(`   Data: ${JSON.stringify(log.data_json)}`);
        });
        
        // 3. Latest records from device_data  
        console.log('\n📊 LATEST device_data (Processed):');
        const latestData = await prisma.device_data.findMany({
            where: { device_id: deviceId },
            orderBy: { timestamp: 'desc' },
            take: 5,
            select: {
                id: true,
                voltage: true,
                current: true,
                power: true,
                power_factor: true,
                machine_state: true,
                socket_state: true,
                sensor_state: true,
                timestamp: true,
                socket_id: true
            }
        });
        
        if (latestData.length > 0) {
            latestData.forEach((data, index) => {
                console.log(`${index + 1}. [${data.timestamp.toISOString()}] Socket: ${data.socket_id?.substring(0,8)}...`);
                console.log(`   Voltage: ${data.voltage}V, Current: ${data.current}A, Power: ${data.power}W`);
                console.log(`   Power Factor: ${data.power_factor}, States: M:${data.machine_state} S:${data.socket_state} Sen:${data.sensor_state}`);
            });
        } else {
            console.log('❌ No records found in device_data table');
        }
        
        // 4. Time range comparison
        console.log('\n⏰ TIME RANGE COMPARISON:');
        
        const logsTimeRange = await prisma.device_data_logs.aggregate({
            where: { device_id: deviceId },
            _min: { timestamp: true },
            _max: { timestamp: true }
        });
        
        if (deviceDataCount > 0) {
            const dataTimeRange = await prisma.device_data.aggregate({
                where: { device_id: deviceId },
                _min: { timestamp: true },
                _max: { timestamp: true }
            });
            
            console.log(`📝 device_data_logs: ${logsTimeRange._min.timestamp?.toISOString()} → ${logsTimeRange._max.timestamp?.toISOString()}`);
            console.log(`📊 device_data: ${dataTimeRange._min.timestamp?.toISOString()} → ${dataTimeRange._max.timestamp?.toISOString()}`);
            
            // Check time gap
            const logLatest = logsTimeRange._max.timestamp;
            const dataLatest = dataTimeRange._max.timestamp;
            const timeDiff = logLatest - dataLatest;
            
            console.log(`⏱️ Time gap: ${Math.round(timeDiff / 1000 / 60)} minutes (device_data_logs is newer)`);
        } else {
            console.log(`📝 device_data_logs: ${logsTimeRange._min.timestamp?.toISOString()} → ${logsTimeRange._max.timestamp?.toISOString()}`);
            console.log(`📊 device_data: No records`);
        }
        
        // 5. Data structure analysis
        console.log('\n🔍 DATA STRUCTURE ANALYSIS:');
        
        if (latestLogs.length > 0) {
            console.log('\n📝 device_data_logs structure (JSON fields found):');
            const allFields = new Set();
            latestLogs.forEach(log => {
                Object.keys(log.data_json).forEach(key => allFields.add(key));
            });
            console.log(`   Fields: ${Array.from(allFields).join(', ')}`);
        }
        
        if (deviceDataCount > 0) {
            console.log('\n📊 device_data structure (dedicated columns):');
            console.log('   Fields: voltage, current, power, frequency, power_factor, machine_state, socket_state, sensor_state, over_voltage, under_voltage, timestamp');
        }
        
        // 6. Recommendation
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (deviceDataCount === 0) {
            console.log('❌ Issue: device_data table is empty - Socket MQTT Client may not be processing data correctly');
            console.log('🔧 Solution: Check Socket MQTT Client logs and ensure storeDeviceDataHistory() is working');
        } else if (dataLogsCount > deviceDataCount) {
            console.log('⚠️ Gap: More raw logs than processed data - some MQTT messages may not be processed');
            console.log('🔧 Solution: Check for processing errors in Socket MQTT Client');
        } else {
            console.log('✅ Both tables have data - system is working correctly');
        }
        
        console.log('\n🎯 USAGE RECOMMENDATIONS:');
        console.log('📝 Use device_data_logs for: Debugging MQTT, raw message analysis, audit trail');
        console.log('📊 Use device_data for: Analytics, reporting, time-series analysis, APIs');
        console.log('🔄 Use device_data_latest for: Real-time monitoring, dashboards, alerts');
        
    } catch (error) {
        console.error('❌ Error comparing tables:', error);
    } finally {
        await prisma.$disconnect();
    }
}

compareDeviceDataTables();