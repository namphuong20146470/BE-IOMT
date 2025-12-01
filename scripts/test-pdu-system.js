import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPDUSystem() {
    try {
        console.log('🧪 Testing PDU System...');
        
        // Test 1: Create a sample PDU
        console.log('📝 Test 1: Creating sample PDU...');
        
        // First, get an organization to use
        const org = await prisma.organizations.findFirst();
        if (!org) {
            console.log('❌ No organization found. Please create one first.');
            return;
        }
        
        const testPDU = await prisma.power_distribution_units.create({
            data: {
                organization_id: org.id,
                name: 'Test Cart 001',
                code: 'CART-TEST-001',
                type: 'cart',
                location: 'Test Room A',
                total_outlets: 4,
                mqtt_base_topic: 'hospital1/cart_test_001',
                is_mobile: true,
                is_active: true
            }
        });
        
        console.log(`✅ Created PDU: ${testPDU.name} (${testPDU.id})`);
        
        // Test 2: Create outlets for the PDU
        console.log('📝 Test 2: Creating outlets...');
        
        const outlets = [];
        for (let i = 1; i <= 4; i++) {
            const outlet = await prisma.outlets.create({
                data: {
                    pdu_id: testPDU.id,
                    outlet_number: i,
                    name: `Socket ${i}`,
                    mqtt_topic_suffix: `socket${i}`,
                    status: 'inactive',
                    is_enabled: true
                }
            });
            outlets.push(outlet);
        }
        
        console.log(`✅ Created ${outlets.length} outlets`);
        
        // Test 3: Query PDU with outlets
        console.log('📝 Test 3: Querying PDU with outlets...');
        
        const pduWithOutlets = await prisma.power_distribution_units.findUnique({
            where: { id: testPDU.id },
            include: {
                outlets: {
                    orderBy: { outlet_number: 'asc' }
                },
                organization: {
                    select: { name: true }
                }
            }
        });
        
        console.log('🔍 PDU Details:');
        console.log(`   - Name: ${pduWithOutlets.name}`);
        console.log(`   - Code: ${pduWithOutlets.code}`);
        console.log(`   - Organization: ${pduWithOutlets.organization.name}`);
        console.log(`   - Total Outlets: ${pduWithOutlets.total_outlets}`);
        console.log(`   - Configured Outlets: ${pduWithOutlets.outlets.length}`);
        
        pduWithOutlets.outlets.forEach(outlet => {
            console.log(`     • Outlet ${outlet.outlet_number}: ${outlet.name} (${outlet.status})`);
        });
        
        // Test 4: Test device assignment (if devices exist)
        const devices = await prisma.device.findMany({ take: 1 });
        if (devices.length > 0) {
            console.log('📝 Test 4: Testing device assignment...');
            
            const device = devices[0];
            const firstOutlet = outlets[0];
            
            // Assign device to outlet
            const updatedOutlet = await prisma.outlets.update({
                where: { id: firstOutlet.id },
                data: {
                    device_id: device.id,
                    assigned_at: new Date(),
                    status: 'idle'
                }
            });
            
            console.log(`✅ Assigned device ${device.serial_number} to outlet ${updatedOutlet.outlet_number}`);
            
            // Test outlet with device info
            const outletWithDevice = await prisma.outlets.findUnique({
                where: { id: updatedOutlet.id },
                include: {
                    device: {
                        include: {
                            model: true
                        }
                    }
                }
            });
            
            console.log('🔍 Outlet with Device:');
            console.log(`   - Outlet: ${outletWithDevice.name}`);
            console.log(`   - Device: ${outletWithDevice.device.serial_number}`);
            console.log(`   - Model: ${outletWithDevice.device.model.name}`);
            console.log(`   - Status: ${outletWithDevice.status}`);
        }
        
        // Test 5: Cleanup
        console.log('🧹 Cleaning up test data...');
        await prisma.outlets.deleteMany({
            where: { pdu_id: testPDU.id }
        });
        await prisma.power_distribution_units.delete({
            where: { id: testPDU.id }
        });
        
        console.log('✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testPDUSystem();