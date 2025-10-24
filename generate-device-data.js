/**
 * 📊 DEVICE DATA GENERATOR
 * Generates realistic sample data for IoMT devices
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Device data generators
class DeviceDataGenerator {
    constructor() {
        this.lastValues = new Map();
    }

    // Generate realistic vital signs
    generateVitalSigns(deviceId) {
        const lastValues = this.lastValues.get(deviceId) || {
            heart_rate: 75,
            systolic: 120,
            diastolic: 80,
            spo2: 98,
            temperature: 36.8,
            respiratory_rate: 16
        };

        // Generate slight variations from last reading
        const vitalSigns = {
            heart_rate: this.vary(lastValues.heart_rate, 60, 100, 3),
            blood_pressure: {
                systolic: this.vary(lastValues.systolic, 100, 140, 5),
                diastolic: this.vary(lastValues.diastolic, 60, 90, 3)
            },
            spo2: this.vary(lastValues.spo2, 95, 100, 1),
            temperature: this.vary(lastValues.temperature, 36.0, 37.5, 0.2),
            respiratory_rate: this.vary(lastValues.respiratory_rate, 12, 20, 2)
        };

        // Update last values
        this.lastValues.set(deviceId, {
            heart_rate: vitalSigns.heart_rate,
            systolic: vitalSigns.blood_pressure.systolic,
            diastolic: vitalSigns.blood_pressure.diastolic,
            spo2: vitalSigns.spo2,
            temperature: vitalSigns.temperature,
            respiratory_rate: vitalSigns.respiratory_rate
        });

        return vitalSigns;
    }

    // Generate ventilator data
    generateVentilatorData(deviceId) {
        const modes = ['Volume Control', 'Pressure Control', 'SIMV', 'BiLevel'];
        const currentMode = modes[Math.floor(Math.random() * modes.length)];

        return {
            mode: currentMode,
            tidal_volume: this.randomInRange(400, 500),
            respiratory_rate: this.randomInRange(10, 16),
            peep: this.randomInRange(4, 8),
            fio2: this.randomInRange(30, 50),
            plateau_pressure: this.randomInRange(20, 30),
            peak_pressure: this.randomInRange(25, 35),
            minute_volume: this.randomInRange(5, 8),
            compliance: this.randomInRange(40, 60)
        };
    }

    // Generate environment data
    generateEnvironmentData(deviceId) {
        return {
            temperature: this.randomInRange(20, 25, 1),
            humidity: this.randomInRange(40, 60),
            air_quality_index: this.randomInRange(10, 30),
            motion_detected: Math.random() < 0.1, // 10% chance
            light_level: this.randomInRange(200, 500),
            co2_level: this.randomInRange(400, 800),
            pressure: this.randomInRange(1010, 1030, 1)
        };
    }

    // Generate defibrillator data
    generateDefibrillatorData(deviceId) {
        return {
            battery_level: this.randomInRange(80, 100),
            self_test_status: 'PASS',
            last_shock_energy: null,
            pads_connected: Math.random() < 0.3, // 30% chance pads connected
            ecg_rhythm: this.getRandomRhythm(),
            device_ready: true,
            maintenance_due_days: this.randomInRange(10, 90)
        };
    }

    // Generate ultrasound data
    generateUltrasoundData(deviceId) {
        return {
            current_probe: this.getRandomProbe(),
            imaging_mode: this.getRandomImagingMode(),
            depth_setting: this.randomInRange(8, 20),
            gain_setting: this.randomInRange(40, 80),
            frequency_mhz: this.randomInRange(2, 15, 1),
            active_session: Math.random() < 0.4, // 40% chance active
            storage_used_gb: this.randomInRange(100, 400),
            last_image_count: this.randomInRange(5, 50)
        };
    }

    // Helper functions
    vary(currentValue, min, max, maxChange) {
        const change = (Math.random() - 0.5) * 2 * maxChange;
        const newValue = currentValue + change;
        return Math.max(min, Math.min(max, Math.round(newValue * 10) / 10));
    }

    randomInRange(min, max, decimals = 0) {
        const value = Math.random() * (max - min) + min;
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    getRandomRhythm() {
        const rhythms = ['Normal Sinus', 'Tachycardia', 'Bradycardia', 'Atrial Fib', 'VTach'];
        return rhythms[Math.floor(Math.random() * rhythms.length)];
    }

    getRandomProbe() {
        const probes = ['Linear', 'Curved', 'Phased Array', 'Endocavitary'];
        return probes[Math.floor(Math.random() * probes.length)];
    }

    getRandomImagingMode() {
        const modes = ['2D', '3D', 'Doppler', 'Color Doppler', 'Power Doppler'];
        return modes[Math.floor(Math.random() * modes.length)];
    }
}

async function generateDeviceData() {
    try {
        console.log('📊 Generating sample device data...');

        const generator = new DeviceDataGenerator();

        // Get active devices
        const devices = await prisma.device.findMany({
            where: { status: 'active' },
            include: {
                model: {
                    include: {
                        category: true
                    }
                }
            }
        });

        console.log(`Found ${devices.length} active devices`);

        const dataRecords = [];

        for (const device of devices) {
            let data, dataType;

            // Generate appropriate data based on device category/model
            if (device.model.name.includes('IntelliVue') || device.model.name.includes('Monitor')) {
                data = generator.generateVitalSigns(device.id);
                dataType = 'vital_signs';
            } else if (device.model.name.includes('Carescape') || device.model.name.includes('Ventilator')) {
                data = generator.generateVentilatorData(device.id);
                dataType = 'ventilation';
            } else if (device.model.name.includes('Environment')) {
                data = generator.generateEnvironmentData(device.id);
                dataType = 'environment';
            } else if (device.model.name.includes('LIFEPAK') || device.model.name.includes('Defibrillator')) {
                data = generator.generateDefibrillatorData(device.id);
                dataType = 'defibrillator';
            } else if (device.model.name.includes('ACUSON') || device.model.name.includes('Ultrasound')) {
                data = generator.generateUltrasoundData(device.id);
                dataType = 'ultrasound';
            } else {
                // Default generic device data
                data = { status: 'operational', timestamp: new Date() };
                dataType = 'status';
            }

            dataRecords.push({
                device_id: device.id,
                data_type: dataType,
                value: JSON.stringify(data),
                unit: dataType === 'vital_signs' ? 'composite' : dataType,
                timestamp: new Date(),
                created_at: new Date()
            });
        }

        // Insert all data records
        if (dataRecords.length > 0) {
            await prisma.device_data.createMany({
                data: dataRecords
            });

            // Update latest data table
            for (const record of dataRecords) {
                await prisma.device_latest_data.upsert({
                    where: {
                        device_id_data_type: {
                            device_id: record.device_id,
                            data_type: record.data_type
                        }
                    },
                    update: {
                        value: record.value,
                        unit: record.unit,
                        timestamp: record.timestamp,
                        updated_at: new Date()
                    },
                    create: {
                        device_id: record.device_id,
                        data_type: record.data_type,
                        value: record.value,
                        unit: record.unit,
                        timestamp: record.timestamp,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        console.log(`✅ Generated ${dataRecords.length} device data records`);

        return dataRecords.length;

    } catch (error) {
        console.error('❌ Error generating device data:', error);
        throw error;
    }
}

// Continuous data generation
async function startContinuousGeneration(intervalSeconds = 30) {
    console.log(`🔄 Starting continuous data generation every ${intervalSeconds} seconds...`);
    console.log('Press Ctrl+C to stop');

    const generateAndSchedule = async () => {
        try {
            const count = await generateDeviceData();
            console.log(`${new Date().toLocaleTimeString()} - Generated ${count} records`);
        } catch (error) {
            console.error(`${new Date().toLocaleTimeString()} - Error:`, error.message);
        }

        setTimeout(generateAndSchedule, intervalSeconds * 1000);
    };

    await generateAndSchedule();
}

// Command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.includes('--continuous')) {
        const intervalIndex = args.indexOf('--interval');
        const interval = intervalIndex !== -1 ? parseInt(args[intervalIndex + 1]) || 30 : 30;
        
        startContinuousGeneration(interval).catch(console.error);
    } else {
        generateDeviceData()
            .then((count) => {
                console.log(`🎉 Generated ${count} device data records`);
                process.exit(0);
            })
            .catch((error) => {
                console.error('💥 Failed to generate device data:', error);
                process.exit(1);
            })
            .finally(() => {
                prisma.$disconnect();
            });
    }
}

export { generateDeviceData, DeviceDataGenerator };