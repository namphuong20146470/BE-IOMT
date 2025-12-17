// Script để kiểm tra xem hệ thống mới có lưu dữ liệu được không
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDataStorage() {
    console.log('\n🔍 KIỂM TRA DỮ LIỆU TRONG DATABASE\n');
    console.log('='.repeat(60));

    try {
        // 1. Kiểm tra device_data (hệ thống mới)
        console.log('\n📊 1. DEVICE_DATA (Hệ thống mới):');
        const deviceDataCount = await prisma.device_data.count();
        console.log(`   ✓ Tổng số records: ${deviceDataCount}`);
        
        if (deviceDataCount > 0) {
            const latestDeviceData = await prisma.device_data.findFirst({
                orderBy: { timestamp: 'desc' },
                include: {
                    device: { select: { serial_number: true } },
                    socket: { select: { name: true, mqtt_topic_suffix: true } }
                }
            });
            console.log(`   ✓ Record mới nhất: ${latestDeviceData.timestamp}`);
            console.log(`   ✓ Device: ${latestDeviceData.device?.serial_number || 'N/A'}`);
            console.log(`   ✓ Socket: ${latestDeviceData.socket?.name || 'N/A'}`);
            console.log(`   ✓ Data: V=${latestDeviceData.voltage}V, I=${latestDeviceData.current}A, P=${latestDeviceData.power}W`);
        } else {
            console.log('   ⚠️  KHÔNG CÓ DỮ LIỆU!');
        }

        // 2. Kiểm tra device_data_logs (Raw JSON)
        console.log('\n📝 2. DEVICE_DATA_LOGS (Raw JSON):');
        const logsCount = await prisma.device_data_logs.count();
        console.log(`   ✓ Tổng số records: ${logsCount}`);
        
        if (logsCount > 0) {
            const latestLog = await prisma.device_data_logs.findFirst({
                orderBy: { timestamp: 'desc' },
                include: {
                    socket: { select: { name: true, mqtt_topic_suffix: true } }
                }
            });
            console.log(`   ✓ Log mới nhất: ${latestLog.timestamp}`);
            console.log(`   ✓ Socket: ${latestLog.socket?.name || 'N/A'}`);
            console.log(`   ✓ Raw data:`, JSON.stringify(latestLog.data_json).substring(0, 100) + '...');
        } else {
            console.log('   ⚠️  KHÔNG CÓ DỮ LIỆU!');
        }

        // 3. Kiểm tra device_data_latest (Current state)
        console.log('\n⚡ 3. DEVICE_DATA_LATEST (Current state):');
        const latestCount = await prisma.device_data_latest.count();
        console.log(`   ✓ Tổng số devices tracked: ${latestCount}`);
        
        if (latestCount > 0) {
            const currentStates = await prisma.device_data_latest.findMany({
                take: 5,
                orderBy: { updated_at: 'desc' },
                include: {
                    device: { select: { serial_number: true } },
                    socket: { select: { name: true } }
                }
            });
            
            currentStates.forEach((state, idx) => {
                console.log(`\n   Device ${idx + 1}:`);
                console.log(`     - Serial: ${state.device?.serial_number || 'N/A'}`);
                console.log(`     - Socket: ${state.socket?.name || 'N/A'}`);
                console.log(`     - Last update: ${state.updated_at}`);
                console.log(`     - Connected: ${state.is_connected ? '✓ YES' : '✗ NO'}`);
                console.log(`     - Data: V=${state.voltage}V, I=${state.current}A, P=${state.power}W`);
            });
        } else {
            console.log('   ⚠️  KHÔNG CÓ DỮ LIỆU!');
        }

        // 4. Kiểm tra socket1-4_data (hệ thống cũ)
        console.log('\n\n📡 4. SOCKET1-4_DATA (Hệ thống cũ):');
        const socket1Count = await prisma.socket1_data.count();
        const socket2Count = await prisma.socket2_data.count();
        const socket3Count = await prisma.socket3_data.count();
        const socket4Count = await prisma.socket4_data.count();
        
        console.log(`   ✓ Socket 1: ${socket1Count} records`);
        console.log(`   ✓ Socket 2: ${socket2Count} records`);
        console.log(`   ✓ Socket 3: ${socket3Count} records`);
        console.log(`   ✓ Socket 4: ${socket4Count} records`);
        
        if (socket1Count > 0) {
            const latest = await prisma.socket1_data.findFirst({
                orderBy: { timestamp: 'desc' }
            });
            console.log(`   ✓ Socket1 mới nhất: ${latest.timestamp}`);
            console.log(`   ✓ Data: V=${latest.voltage}V, I=${latest.current}A, P=${latest.power}W`);
        }

        // 5. Kiểm tra sockets configuration
        console.log('\n\n⚙️  5. SOCKETS CONFIGURATION:');
        const sockets = await prisma.sockets.findMany({
            include: {
                pdu: { select: { name: true } },
                device: { select: { serial_number: true } }
            }
        });
        
        console.log(`   ✓ Tổng số sockets: ${sockets.length}`);
        sockets.forEach(socket => {
            console.log(`\n   Socket: ${socket.name}`);
            console.log(`     - PDU: ${socket.pdu?.name || 'N/A'}`);
            console.log(`     - Device: ${socket.device?.serial_number || 'KHÔNG GÁN'}`);
            console.log(`     - MQTT Topic: ${socket.mqtt_topic_suffix}`);
            console.log(`     - MQTT Broker: ${socket.mqtt_broker_host || 'CHƯA CẤU HÌNH'}:${socket.mqtt_broker_port || 1883}`);
            console.log(`     - Status: ${socket.status}`);
            console.log(`     - Enabled: ${socket.is_enabled ? 'YES' : 'NO'}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('\n📋 TÓM TẮT:');
        
        const hasNewSystemData = deviceDataCount > 0 || logsCount > 0 || latestCount > 0;
        const hasOldSystemData = socket1Count > 0 || socket2Count > 0 || socket3Count > 0 || socket4Count > 0;
        
        if (hasNewSystemData) {
            console.log('✅ HỆ THỐNG MỚI: Đang lưu dữ liệu THÀNH CÔNG');
        } else {
            console.log('❌ HỆ THỐNG MỚI: KHÔNG lưu được dữ liệu!');
            console.log('\n🔧 NGUYÊN NHÂN CÓ THỂ:');
            console.log('   1. Socket chưa được gán device (device_id = null)');
            console.log('   2. MQTT broker chưa cấu hình (mqtt_broker_host = null)');
            console.log('   3. MQTT client chưa kết nối được');
            console.log('   4. Topic MQTT không khớp');
            console.log('   5. Lỗi khi insert vào database');
        }
        
        if (hasOldSystemData) {
            console.log('✅ HỆ THỐNG CŨ: Đang hoạt động bình thường');
        } else {
            console.log('⚠️  HỆ THỐNG CŨ: Cũng không có dữ liệu');
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ LỖI:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDataStorage();
