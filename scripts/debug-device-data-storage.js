/**
 * Debug Device Data Storage Issues
 * Chạy script này để kiểm tra tại sao device_data không lưu được
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugDeviceDataStorage() {
    console.log('🔍 DEBUG: Device Data Storage\n');
    
    try {
        // 1. Kiểm tra có socket nào đang active không
        console.log('1️⃣ Checking active sockets with MQTT config...');
        const activeSockets = await prisma.sockets.findMany({
            where: {
                AND: [
                    { mqtt_broker_host: { not: null } },
                    { is_enabled: true }
                ]
            },
            include: {
                device: {
                    select: {
                        id: true,
                        serial_number: true,
                        status: true
                    }
                },
                pdu: {
                    select: {
                        code: true,
                        location: true
                    }
                }
            }
        });
        
        console.log(`   ✅ Found ${activeSockets.length} active sockets with MQTT config`);
        activeSockets.forEach(socket => {
            console.log(`   📌 Socket #${socket.socket_number} (PDU: ${socket.pdu?.code})`);
            console.log(`      - Device: ${socket.device?.serial_number || 'NOT ASSIGNED'}`);
            console.log(`      - Broker: ${socket.mqtt_broker_host}:${socket.mqtt_broker_port}`);
            console.log(`      - Topic: ${socket.mqtt_topic}`);
            console.log(`      - Enabled: ${socket.is_enabled}`);
        });

        // 2. Kiểm tra device_data trong 1 giờ qua
        console.log('\n2️⃣ Checking device_data records in last 1 hour...');
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentData = await prisma.device_data.findMany({
            where: {
                created_at: {
                    gte: oneHourAgo
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: 10,
            include: {
                device: {
                    select: {
                        serial_number: true
                    }
                },
                socket: {
                    select: {
                        socket_number: true
                    }
                }
            }
        });
        
        console.log(`   ✅ Found ${recentData.length} records in last hour`);
        if (recentData.length > 0) {
            console.log(`   Latest record:`);
            const latest = recentData[0];
            console.log(`      - ID: ${latest.id}`);
            console.log(`      - Device: ${latest.device?.serial_number}`);
            console.log(`      - Socket: #${latest.socket?.socket_number}`);
            console.log(`      - Voltage: ${latest.voltage}V`);
            console.log(`      - Current: ${latest.current}A`);
            console.log(`      - Power: ${latest.power}W`);
            console.log(`      - Timestamp: ${latest.timestamp}`);
            console.log(`      - Created: ${latest.created_at}`);
        }

        // 3. Kiểm tra device_data_latest
        console.log('\n3️⃣ Checking device_data_latest records...');
        const latestData = await prisma.device_data_latest.findMany({
            include: {
                device: {
                    select: {
                        serial_number: true
                    }
                },
                socket: {
                    select: {
                        socket_number: true
                    }
                }
            }
        });
        
        console.log(`   ✅ Found ${latestData.length} device_data_latest records`);
        latestData.forEach(record => {
            console.log(`   📊 Device: ${record.device?.serial_number}`);
            console.log(`      - Socket: #${record.socket?.socket_number}`);
            console.log(`      - Last update: ${record.last_seen_at}`);
            console.log(`      - Voltage: ${record.voltage}V, Power: ${record.power}W`);
        });

        // 4. Kiểm tra device_data_logs (raw MQTT data)
        console.log('\n4️⃣ Checking device_data_logs (raw MQTT) in last 1 hour...');
        const rawLogs = await prisma.device_data_logs.findMany({
            where: {
                timestamp: {
                    gte: oneHourAgo
                }
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 5,
            select: {
                id: true,
                device_id: true,
                socket_id: true,
                data_json: true,
                timestamp: true
            }
        });
        
        console.log(`   ✅ Found ${rawLogs.length} raw MQTT logs in last hour`);
        if (rawLogs.length > 0) {
            console.log(`   Latest raw log:`, JSON.stringify(rawLogs[0], null, 2));
        }

        // 5. Kiểm tra schema constraints
        console.log('\n5️⃣ Checking database schema for device_data...');
        const schemaInfo = await prisma.$queryRaw`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'device_data'
            ORDER BY ordinal_position
        `;
        
        console.log('   Schema structure:');
        schemaInfo.forEach(col => {
            console.log(`      - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
        });

        // 6. Test insert
        console.log('\n6️⃣ Testing manual insert...');
        if (activeSockets.length > 0 && activeSockets[0].device_id) {
            try {
                const testData = await prisma.device_data.create({
                    data: {
                        device_id: activeSockets[0].device_id,
                        socket_id: activeSockets[0].id,
                        voltage: 220.5,
                        current: 1.5,
                        power: 330.75,
                        frequency: 50.0,
                        power_factor: 0.99,
                        machine_state: true,
                        socket_state: true,
                        sensor_state: true,
                        timestamp: new Date()
                    }
                });
                console.log(`   ✅ Test insert SUCCESS - ID: ${testData.id}`);
                
                // Clean up test data
                await prisma.device_data.delete({
                    where: { id: testData.id }
                });
                console.log(`   🧹 Test data cleaned up`);
            } catch (insertError) {
                console.error(`   ❌ Test insert FAILED:`, insertError.message);
                console.error(`   Error code:`, insertError.code);
            }
        } else {
            console.log(`   ⚠️  No active socket with device assigned - skipping test insert`);
        }

        // 7. Kiểm tra MQTT client status (nếu đang chạy)
        console.log('\n7️⃣ Recommendations:');
        console.log('   📋 Checklist for production:');
        console.log('   ✓ Database có quyền INSERT vào device_data?');
        console.log('   ✓ MQTT client đang connect và subscribe topics?');
        console.log('   ✓ Socket có MQTT config đúng (host, port, topic)?');
        console.log('   ✓ Device được assign vào socket?');
        console.log('   ✓ Socket is_enabled = true?');
        console.log('   ✓ Firewall không block MQTT port?');
        console.log('   ✓ Check logs: npm run dev để xem MQTT messages');
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run debug
debugDeviceDataStorage().catch(console.error);
