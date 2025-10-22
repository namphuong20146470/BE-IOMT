/**
 * 🏥 DEVICE MODULE SAMPLE DATA SCRIPT
 * Comprehensive seed data for IoMT Device Management System
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDeviceData() {
    try {
        console.log('🚀 Starting Device Module Data Seeding...');

        // ===========================================
        // 1. DEVICE CATEGORIES
        // ===========================================
        console.log('📂 Creating device categories...');
        
        // Main categories
        const medicalEquipmentCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-medical-equipment',
                name: 'Medical Equipment',
                description: 'All types of medical equipment and devices',
                parent_id: null,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        const monitoringCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-monitoring',
                name: 'Monitoring Devices',
                description: 'Patient monitoring and vital signs devices',
                parent_id: medicalEquipmentCategory.id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        const diagnosticCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-diagnostic',
                name: 'Diagnostic Equipment',
                description: 'Medical diagnostic and imaging equipment',
                parent_id: medicalEquipmentCategory.id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        const therapeuticCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-therapeutic',
                name: 'Therapeutic Equipment',
                description: 'Treatment and therapeutic medical devices',
                parent_id: medicalEquipmentCategory.id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        const infraCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-infrastructure',
                name: 'Infrastructure Systems',
                description: 'Hospital infrastructure and support systems',
                parent_id: null,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        // Sub-categories
        const ventilatorCategory = await prisma.device_categories.create({
            data: {
                id: 'cat-ventilators',
                name: 'Ventilators',
                description: 'Mechanical ventilation devices',
                parent_id: therapeuticCategory.id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        console.log('✅ Created 6 device categories');

        // ===========================================
        // 2. DEVICE MODELS
        // ===========================================
        console.log('🔧 Creating device models...');

        const models = [
            {
                id: 'model-philips-intellivue-mx800',
                category_id: monitoringCategory.id,
                name: 'IntelliVue MX800',
                manufacturer: 'Philips Healthcare',
                model_number: 'MX800-2024',
                description: 'Advanced patient monitoring system with multi-parameter capabilities',
                specifications: JSON.stringify({
                    display: '19-inch color touchscreen',
                    parameters: ['ECG', 'SpO2', 'NIBP', 'Temperature', 'Respiration'],
                    connectivity: ['WiFi', 'Ethernet', 'Bluetooth'],
                    power: '100-240V AC, 50/60Hz',
                    dimensions: '38 x 28 x 15 cm',
                    weight: '4.2 kg'
                })
            },
            {
                id: 'model-ge-carescape-r860',
                category_id: ventilatorCategory.id,
                name: 'Carescape R860',
                manufacturer: 'GE Healthcare',
                model_number: 'R860-ICU',
                description: 'Advanced ICU ventilator with intelligent ventilation modes',
                specifications: JSON.stringify({
                    modes: ['Volume Control', 'Pressure Control', 'SIMV', 'BiLevel', 'APRV'],
                    tidal_volume: '2-2000 mL',
                    respiratory_rate: '1-150 bpm',
                    display: '15-inch touchscreen',
                    connectivity: ['Ethernet', 'WiFi', 'USB'],
                    power: '100-240V AC, 400VA'
                })
            },
            {
                id: 'model-siemens-acuson-x300',
                category_id: diagnosticCategory.id,
                name: 'ACUSON X300',
                manufacturer: 'Siemens Healthineers',
                model_number: 'X300-PE',
                description: 'Premium edition ultrasound system with advanced imaging',
                specifications: JSON.stringify({
                    probes: ['Linear', 'Curved', 'Phased Array', 'Endocavitary'],
                    frequencies: '2-15 MHz',
                    display: '21.5-inch LED monitor',
                    storage: '500GB SSD',
                    connectivity: ['DICOM', 'Ethernet', 'USB 3.0'],
                    imaging_modes: ['2D', '3D', 'Doppler', 'Elastography']
                })
            },
            {
                id: 'model-medtronic-lifepak15',
                category_id: therapeuticCategory.id,
                name: 'LIFEPAK 15',
                manufacturer: 'Medtronic',
                model_number: 'LP15-AED',
                description: 'Monitor/Defibrillator with advanced life support capabilities',
                specifications: JSON.stringify({
                    energy: '1-360 Joules',
                    waveform: 'Biphasic truncated exponential',
                    monitoring: ['12-lead ECG', 'SpO2', 'NIBP', 'CO2'],
                    display: '8.4-inch color LCD',
                    battery: 'Lithium-ion, 4+ hours',
                    weight: '7.8 kg'
                })
            },
            {
                id: 'model-iot-environment-sensor',
                category_id: infraCategory.id,
                name: 'Smart Environment Monitor',
                manufacturer: 'IoMT Solutions',
                model_number: 'IES-2024-PRO',
                description: 'IoT-enabled environmental monitoring system',
                specifications: JSON.stringify({
                    sensors: ['Temperature', 'Humidity', 'Air Quality', 'Motion', 'Light'],
                    range_temp: '-40°C to +85°C',
                    range_humidity: '0-100% RH',
                    connectivity: ['WiFi', 'LoRaWAN', 'Bluetooth 5.0'],
                    power: '3.7V Li-ion battery + Solar panel',
                    transmission: 'Real-time MQTT protocol'
                })
            }
        ];

        for (const modelData of models) {
            await prisma.device_models.create({
                data: {
                    ...modelData,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
        }

        console.log('✅ Created 5 device models');

        // ===========================================
        // 3. GET ORGANIZATION AND DEPARTMENTS
        // ===========================================
        console.log('🏢 Fetching organizations and departments...');

        const organization = await prisma.organizations.findFirst({
            where: { name: 'Bệnh viện Đa khoa IoMT' }
        });

        if (!organization) {
            throw new Error('Organization not found. Run seed-iomt.js first!');
        }

        const departments = await prisma.departments.findMany({
            where: { organization_id: organization.id }
        });

        console.log(`✅ Found organization: ${organization.name} with ${departments.length} departments`);

        // ===========================================
        // 4. DEVICES
        // ===========================================
        console.log('🔌 Creating devices...');

        const devices = [
            // ICU Department devices
            {
                model_id: 'model-philips-intellivue-mx800',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Hồi sức cấp cứu')?.id,
                serial_number: 'PH-MX800-ICU-001',
                asset_tag: 'ICU-MON-001',
                status: 'active',
                location: 'ICU Room 101, Bed A',
                notes: 'Primary patient monitor for ICU bed A, configured for cardiac monitoring',
                purchase_date: new Date('2024-01-15'),
                installation_date: new Date('2024-01-20')
            },
            {
                model_id: 'model-philips-intellivue-mx800',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Hồi sức cấp cứu')?.id,
                serial_number: 'PH-MX800-ICU-002',
                asset_tag: 'ICU-MON-002',
                status: 'active',
                location: 'ICU Room 102, Bed B',
                notes: 'Secondary monitor with advanced hemodynamic monitoring',
                purchase_date: new Date('2024-01-15'),
                installation_date: new Date('2024-01-22')
            },
            {
                model_id: 'model-ge-carescape-r860',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Hồi sức cấp cứu')?.id,
                serial_number: 'GE-R860-ICU-001',
                asset_tag: 'ICU-VENT-001',
                status: 'active',
                location: 'ICU Room 101',
                notes: 'Main ventilator for critical care patients',
                purchase_date: new Date('2024-02-01'),
                installation_date: new Date('2024-02-05')
            },
            // Cardiology Department
            {
                model_id: 'model-philips-intellivue-mx800',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Tim mạch')?.id,
                serial_number: 'PH-MX800-CAR-001',
                asset_tag: 'CAR-MON-001',
                status: 'active',
                location: 'Cardiology Ward, Room 201',
                notes: 'Specialized for cardiac arrhythmia monitoring',
                purchase_date: new Date('2024-03-01'),
                installation_date: new Date('2024-03-05')
            },
            {
                model_id: 'model-siemens-acuson-x300',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Tim mạch')?.id,
                serial_number: 'SI-X300-CAR-001',
                asset_tag: 'CAR-ECHO-001',
                status: 'active',
                location: 'Cardiology Ultrasound Room',
                notes: 'Primary echocardiography system with 3D/4D capabilities',
                purchase_date: new Date('2024-02-15'),
                installation_date: new Date('2024-02-20')
            },
            // Emergency Department
            {
                model_id: 'model-medtronic-lifepak15',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Cấp cứu')?.id,
                serial_number: 'MT-LP15-ER-001',
                asset_tag: 'ER-DEFIB-001',
                status: 'active',
                location: 'Emergency Room 1',
                notes: 'Mobile defibrillator for emergency resuscitation',
                purchase_date: new Date('2024-01-10'),
                installation_date: new Date('2024-01-12')
            },
            {
                model_id: 'model-medtronic-lifepak15',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Cấp cứu')?.id,
                serial_number: 'MT-LP15-ER-002',
                asset_tag: 'ER-DEFIB-002',
                status: 'maintenance',
                location: 'Equipment Storage - Maintenance',
                notes: 'Under preventive maintenance, battery replacement scheduled',
                purchase_date: new Date('2024-01-10'),
                installation_date: new Date('2024-01-12')
            },
            // Surgery Department
            {
                model_id: 'model-ge-carescape-r860',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Phẫu thuật')?.id,
                serial_number: 'GE-R860-OR-001',
                asset_tag: 'OR-VENT-001',
                status: 'active',
                location: 'Operating Room 1',
                notes: 'Anesthesia ventilator for surgical procedures',
                purchase_date: new Date('2024-03-10'),
                installation_date: new Date('2024-03-15')
            },
            // Infrastructure devices
            {
                model_id: 'model-iot-environment-sensor',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Hồi sức cấp cứu')?.id,
                serial_number: 'IOT-ENV-ICU-001',
                asset_tag: 'ENV-ICU-001',
                status: 'active',
                location: 'ICU Environmental Control',
                notes: 'Environmental monitoring for ICU ward',
                purchase_date: new Date('2024-04-01'),
                installation_date: new Date('2024-04-05')
            },
            {
                model_id: 'model-iot-environment-sensor',
                organization_id: organization.id,
                department_id: departments.find(d => d.name === 'Khoa Phẫu thuật')?.id,
                serial_number: 'IOT-ENV-OR-001',
                asset_tag: 'ENV-OR-001',
                status: 'active',
                location: 'Operating Room Environment',
                notes: 'Real-time air quality and sterility monitoring',
                purchase_date: new Date('2024-04-01'),
                installation_date: new Date('2024-04-05')
            }
        ];

        const createdDevices = [];
        for (const deviceData of devices) {
            const device = await prisma.device.create({
                data: {
                    ...deviceData,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
            createdDevices.push(device);
        }

        console.log('✅ Created 10 devices across departments');

        // ===========================================
        // 5. DEVICE CONNECTIVITY
        // ===========================================
        console.log('📡 Creating device connectivity configurations...');

        const connectivityConfigs = [
            // ICU Monitors
            {
                device_id: createdDevices.find(d => d.serial_number === 'PH-MX800-ICU-001')?.id,
                mqtt_user: 'icu_monitor_001',
                mqtt_pass: 'SecureMqtt2024!',
                mqtt_topic: 'iomt/icu/monitor/001',
                broker_host: 'mqtt.iomt-hospital.local',
                broker_port: 8883,
                use_ssl: true,
                connection_status: 'connected',
                last_seen: new Date(),
                data_format: 'json'
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'PH-MX800-ICU-002')?.id,
                mqtt_user: 'icu_monitor_002',
                mqtt_pass: 'SecureMqtt2024!',
                mqtt_topic: 'iomt/icu/monitor/002',
                broker_host: 'mqtt.iomt-hospital.local',
                broker_port: 8883,
                use_ssl: true,
                connection_status: 'connected',
                last_seen: new Date(),
                data_format: 'json'
            },
            // Ventilators
            {
                device_id: createdDevices.find(d => d.serial_number === 'GE-R860-ICU-001')?.id,
                mqtt_user: 'icu_ventilator_001',
                mqtt_pass: 'VentSecure2024!',
                mqtt_topic: 'iomt/icu/ventilator/001',
                broker_host: 'mqtt.iomt-hospital.local',
                broker_port: 8883,
                use_ssl: true,
                connection_status: 'connected',
                last_seen: new Date(),
                data_format: 'json'
            },
            // Environment Sensors
            {
                device_id: createdDevices.find(d => d.serial_number === 'IOT-ENV-ICU-001')?.id,
                mqtt_user: 'env_sensor_icu',
                mqtt_pass: 'EnvSensor2024!',
                mqtt_topic: 'iomt/environment/icu/001',
                broker_host: 'mqtt.iomt-hospital.local',
                broker_port: 8883,
                use_ssl: true,
                connection_status: 'connected',
                last_seen: new Date(),
                data_format: 'json'
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'IOT-ENV-OR-001')?.id,
                mqtt_user: 'env_sensor_or',
                mqtt_pass: 'EnvSensor2024!',
                mqtt_topic: 'iomt/environment/or/001',
                broker_host: 'mqtt.iomt-hospital.local',
                broker_port: 8883,
                use_ssl: true,
                connection_status: 'connected',
                last_seen: new Date(),
                data_format: 'json'
            }
        ];

        for (const config of connectivityConfigs) {
            if (config.device_id) {
                await prisma.device_connectivity.create({
                    data: {
                        ...config,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        console.log('✅ Created 5 device connectivity configurations');

        // ===========================================
        // 6. WARRANTY INFORMATION
        // ===========================================
        console.log('📋 Creating warranty information...');

        const warranties = [
            {
                device_id: createdDevices.find(d => d.serial_number === 'PH-MX800-ICU-001')?.id,
                warranty_start: new Date('2024-01-20'),
                warranty_end: new Date('2027-01-20'),
                provider: 'Philips Healthcare Vietnam'
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'GE-R860-ICU-001')?.id,
                warranty_start: new Date('2024-02-05'),
                warranty_end: new Date('2029-02-05'),
                provider: 'GE Healthcare Service Vietnam'
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'SI-X300-CAR-001')?.id,
                warranty_start: new Date('2024-02-20'),
                warranty_end: new Date('2026-02-20'),
                provider: 'Siemens Healthineers Vietnam'
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'MT-LP15-ER-001')?.id,
                warranty_start: new Date('2024-01-12'),
                warranty_end: new Date('2026-01-12'),
                provider: 'Medtronic Vietnam Service'
            }
        ];

        for (const warranty of warranties) {
            if (warranty.device_id) {
                await prisma.warranty_info.create({
                    data: warranty
                });
            }
        }

        console.log('✅ Created 4 warranty records');

        // ===========================================
        // 7. SAMPLE DEVICE DATA (Recent)
        // ===========================================
        console.log('📊 Creating sample device data...');

        const deviceDataSamples = [
            // ICU Monitor 001 - Last 24 hours
            {
                device_id: createdDevices.find(d => d.serial_number === 'PH-MX800-ICU-001')?.id,
                data_type: 'vital_signs',
                value: JSON.stringify({
                    heart_rate: 78,
                    blood_pressure: { systolic: 120, diastolic: 80 },
                    spo2: 98,
                    temperature: 36.8,
                    respiratory_rate: 16
                }),
                unit: 'composite',
                timestamp: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
            },
            {
                device_id: createdDevices.find(d => d.serial_number === 'PH-MX800-ICU-001')?.id,
                data_type: 'vital_signs',
                value: JSON.stringify({
                    heart_rate: 82,
                    blood_pressure: { systolic: 125, diastolic: 82 },
                    spo2: 97,
                    temperature: 37.1,
                    respiratory_rate: 18
                }),
                unit: 'composite',
                timestamp: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
            },
            // Ventilator Data
            {
                device_id: createdDevices.find(d => d.serial_number === 'GE-R860-ICU-001')?.id,
                data_type: 'ventilation',
                value: JSON.stringify({
                    mode: 'Volume Control',
                    tidal_volume: 450,
                    respiratory_rate: 12,
                    peep: 5,
                    fio2: 40,
                    plateau_pressure: 25,
                    peak_pressure: 30
                }),
                unit: 'ventilator_params',
                timestamp: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
            },
            // Environment Sensor Data
            {
                device_id: createdDevices.find(d => d.serial_number === 'IOT-ENV-ICU-001')?.id,
                data_type: 'environment',
                value: JSON.stringify({
                    temperature: 22.5,
                    humidity: 45,
                    air_quality_index: 15,
                    motion_detected: false,
                    light_level: 300
                }),
                unit: 'environmental_params',
                timestamp: new Date(Date.now() - 1000 * 60 * 5) // 5 minutes ago
            }
        ];

        for (const data of deviceDataSamples) {
            if (data.device_id) {
                await prisma.device_data.create({
                    data: {
                        ...data,
                        created_at: new Date()
                    }
                });
            }
        }

        console.log('✅ Created 4 sample device data records');

        // ===========================================
        // SUMMARY
        // ===========================================
        console.log('\n🎉 DEVICE MODULE SEEDING COMPLETED!');
        console.log('=====================================');
        console.log('📂 Device Categories: 6');
        console.log('🔧 Device Models: 5');
        console.log('🔌 Devices: 10');
        console.log('📡 Connectivity Configs: 5');
        console.log('📋 Warranty Records: 4');
        console.log('📊 Device Data Samples: 4');
        console.log('=====================================');
        
        console.log('\n📋 CREATED DEVICES:');
        createdDevices.forEach((device, index) => {
            console.log(`${index + 1}. ${device.serial_number} - ${device.asset_tag} (${device.status})`);
        });

        console.log('\n✅ All device data has been successfully seeded!');
        
        return {
            categories: 6,
            models: 5,
            devices: createdDevices.length,
            connectivity: 5,
            warranties: 4,
            data_samples: 4
        };

    } catch (error) {
        console.error('❌ Error seeding device data:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seeding function
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDeviceData()
        .then((result) => {
            console.log('🚀 Device seeding completed:', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Device seeding failed:', error);
            process.exit(1);
        });
}

export default seedDeviceData;