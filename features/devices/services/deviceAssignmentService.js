// services/device-assignment/deviceAssignmentService.js
import prisma from '../../../config/db.js';
import mqttService from './mqttService.js';

class DeviceAssignmentService {
    /**
     * Assign device to outlet with full validation and MQTT setup
     */
    async assignDeviceToOutlet(outletId, deviceId, assignedBy, options = {}) {
        try {
            console.log(`🔧 Assigning device ${deviceId} to outlet ${outletId}`);

            // Validation phase
            const validationResult = await this.validateAssignment(outletId, deviceId, assignedBy);
            if (!validationResult.valid) {
                throw new Error(validationResult.error);
            }

            const { outlet, device } = validationResult;

            // Perform assignment in transaction
            const result = await prisma.$transaction(async (tx) => {
                // 1. Update outlet with device assignment
                const updatedOutlet = await tx.outlets.update({
                    where: { id: outletId },
                    data: {
                        device_id: deviceId,
                        assigned_at: new Date(),
                        assigned_by: assignedBy,
                        status: 'idle', // Start as idle until we receive data
                        notes: options.notes || null
                    }
                });

                // 2. Generate MQTT topic for device
                const mqttTopic = outlet.pdu.mqtt_base_topic ? 
                    `${outlet.pdu.mqtt_base_topic}/${outlet.mqtt_topic_suffix}` : null;

                // 3. Update device connectivity with new MQTT topic
                if (mqttTopic) {
                    await tx.device_connectivity.upsert({
                        where: { device_id: deviceId },
                        update: {
                            mqtt_topic: mqttTopic,
                            updated_at: new Date()
                        },
                        create: {
                            device_id: deviceId,
                            mqtt_topic: mqttTopic,
                            broker_host: process.env.MQTT_HOST || 'localhost',
                            broker_port: parseInt(process.env.MQTT_PORT) || 1883,
                            is_active: true
                        }
                    });
                }

                // 4. Create assignment log for audit trail
                await tx.audit_logs.create({
                    data: {
                        user_id: assignedBy,
                        organization_id: outlet.pdu.organization_id,
                        action: 'create',
                        resource_type: 'outlet_assignment',
                        resource_id: outletId,
                        new_values: {
                            outlet_id: outletId,
                            device_id: deviceId,
                            mqtt_topic: mqttTopic,
                            assigned_at: new Date()
                        },
                        success: true
                    }
                });

                return { updatedOutlet, mqttTopic };
            });

            // 5. Add outlet to MQTT monitoring
            if (result.mqttTopic) {
                await mqttService.addOutletMonitoring(outletId);
                console.log(`📡 Added MQTT monitoring for outlet ${outletId} on topic ${result.mqttTopic}`);
            }

            // 6. Trigger device connectivity check
            setTimeout(() => {
                this.checkDeviceConnectivity(deviceId);
            }, 5000); // Check connectivity after 5 seconds

            console.log(`✅ Successfully assigned device ${device.serial_number} to outlet ${outlet.outlet_number}`);

            return {
                success: true,
                outlet: result.updatedOutlet,
                mqtt_topic: result.mqttTopic,
                message: `Device ${device.serial_number} assigned to outlet ${outlet.outlet_number} successfully`
            };

        } catch (error) {
            console.error(`❌ Error assigning device to outlet:`, error);
            
            // Log failed assignment attempt
            try {
                await prisma.audit_logs.create({
                    data: {
                        user_id: assignedBy,
                        action: 'create',
                        resource_type: 'outlet_assignment',
                        resource_id: outletId,
                        success: false,
                        error_message: error.message
                    }
                });
            } catch (logError) {
                console.error('Failed to log assignment error:', logError);
            }

            throw error;
        }
    }

    /**
     * Unassign device from outlet
     */
    async unassignDeviceFromOutlet(outletId, unassignedBy, options = {}) {
        try {
            console.log(`🔧 Unassigning device from outlet ${outletId}`);

            // Get current assignment
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    device: { select: { id: true, serial_number: true } },
                    pdu: { select: { organization_id: true } }
                }
            });

            if (!outlet) {
                throw new Error('Outlet not found');
            }

            if (!outlet.device_id) {
                throw new Error('No device assigned to this outlet');
            }

            const deviceSerial = outlet.device.serial_number;

            // Perform unassignment in transaction
            await prisma.$transaction(async (tx) => {
                // 1. Clear outlet assignment
                await tx.outlets.update({
                    where: { id: outletId },
                    data: {
                        device_id: null,
                        assigned_at: null,
                        assigned_by: null,
                        status: 'inactive',
                        current_power: null,
                        current_voltage: null,
                        current_current: null,
                        last_data_at: null,
                        notes: options.notes || null
                    }
                });

                // 2. Clear device MQTT topic
                await tx.device_connectivity.updateMany({
                    where: { device_id: outlet.device_id },
                    data: {
                        mqtt_topic: null,
                        updated_at: new Date()
                    }
                });

                // 3. Create unassignment log
                await tx.audit_logs.create({
                    data: {
                        user_id: unassignedBy,
                        organization_id: outlet.pdu.organization_id,
                        action: 'delete',
                        resource_type: 'outlet_assignment',
                        resource_id: outletId,
                        old_values: {
                            device_id: outlet.device_id,
                            assigned_at: outlet.assigned_at
                        },
                        success: true
                    }
                });
            });

            // 4. Remove from MQTT monitoring
            await mqttService.removeOutletMonitoring(outletId);

            console.log(`✅ Successfully unassigned device ${deviceSerial} from outlet`);

            return {
                success: true,
                message: `Device ${deviceSerial} unassigned from outlet successfully`
            };

        } catch (error) {
            console.error(`❌ Error unassigning device from outlet:`, error);
            throw error;
        }
    }

    /**
     * Bulk assign multiple devices to outlets
     */
    async bulkAssignDevices(assignments, assignedBy) {
        const results = [];
        const errors = [];

        for (const assignment of assignments) {
            try {
                const result = await this.assignDeviceToOutlet(
                    assignment.outlet_id,
                    assignment.device_id,
                    assignedBy,
                    { notes: assignment.notes }
                );
                results.push(result);
            } catch (error) {
                errors.push({
                    outlet_id: assignment.outlet_id,
                    device_id: assignment.device_id,
                    error: error.message
                });
            }
        }

        return {
            successful_assignments: results.length,
            failed_assignments: errors.length,
            results,
            errors
        };
    }

    /**
     * Transfer device from one outlet to another
     */
    async transferDevice(fromOutletId, toOutletId, transferredBy, options = {}) {
        try {
            console.log(`🔄 Transferring device from outlet ${fromOutletId} to ${toOutletId}`);

            // Get source outlet with device
            const fromOutlet = await prisma.outlets.findUnique({
                where: { id: fromOutletId },
                include: {
                    device: true,
                    pdu: { select: { organization_id: true } }
                }
            });

            if (!fromOutlet || !fromOutlet.device_id) {
                throw new Error('Source outlet not found or has no device assigned');
            }

            // Validate destination outlet
            const toOutlet = await prisma.outlets.findUnique({
                where: { id: toOutletId },
                include: { pdu: true }
            });

            if (!toOutlet) {
                throw new Error('Destination outlet not found');
            }

            if (toOutlet.device_id) {
                throw new Error('Destination outlet already has a device assigned');
            }

            const deviceId = fromOutlet.device_id;

            // Perform transfer in transaction
            const result = await prisma.$transaction(async (tx) => {
                // 1. Unassign from source outlet
                await tx.outlets.update({
                    where: { id: fromOutletId },
                    data: {
                        device_id: null,
                        assigned_at: null,
                        assigned_by: null,
                        status: 'inactive',
                        current_power: null,
                        current_voltage: null,
                        current_current: null,
                        last_data_at: null
                    }
                });

                // 2. Assign to destination outlet
                await tx.outlets.update({
                    where: { id: toOutletId },
                    data: {
                        device_id: deviceId,
                        assigned_at: new Date(),
                        assigned_by: transferredBy,
                        status: 'idle',
                        notes: options.notes || null
                    }
                });

                // 3. Update MQTT topic
                const newMqttTopic = toOutlet.pdu.mqtt_base_topic ? 
                    `${toOutlet.pdu.mqtt_base_topic}/${toOutlet.mqtt_topic_suffix}` : null;

                await tx.device_connectivity.updateMany({
                    where: { device_id: deviceId },
                    data: {
                        mqtt_topic: newMqttTopic,
                        updated_at: new Date()
                    }
                });

                // 4. Log transfer
                await tx.audit_logs.create({
                    data: {
                        user_id: transferredBy,
                        organization_id: fromOutlet.pdu.organization_id,
                        action: 'update',
                        resource_type: 'device_transfer',
                        resource_id: deviceId,
                        old_values: { outlet_id: fromOutletId },
                        new_values: { outlet_id: toOutletId },
                        success: true
                    }
                });

                return { newMqttTopic };
            });

            // 5. Update MQTT monitoring
            await mqttService.removeOutletMonitoring(fromOutletId);
            if (result.newMqttTopic) {
                await mqttService.addOutletMonitoring(toOutletId);
            }

            console.log(`✅ Device ${fromOutlet.device.serial_number} transferred successfully`);

            return {
                success: true,
                from_outlet: fromOutletId,
                to_outlet: toOutletId,
                device_serial: fromOutlet.device.serial_number,
                new_mqtt_topic: result.newMqttTopic,
                message: 'Device transferred successfully'
            };

        } catch (error) {
            console.error(`❌ Error transferring device:`, error);
            throw error;
        }
    }

    /**
     * Validate assignment before performing it
     */
    async validateAssignment(outletId, deviceId, assignedBy) {
        try {
            // Check outlet
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    pdu: {
                        select: {
                            organization_id: true,
                            mqtt_base_topic: true,
                            is_active: true
                        }
                    }
                }
            });

            if (!outlet) {
                return { valid: false, error: 'Outlet not found' };
            }

            if (!outlet.is_enabled) {
                return { valid: false, error: 'Outlet is disabled' };
            }

            if (!outlet.pdu.is_active) {
                return { valid: false, error: 'PDU is inactive' };
            }

            if (outlet.device_id) {
                return { valid: false, error: 'Outlet already has a device assigned' };
            }

            // Check device
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                include: {
                    outlet_assignment: true
                }
            });

            if (!device) {
                return { valid: false, error: 'Device not found' };
            }

            if (device.status === 'decommissioned') {
                return { valid: false, error: 'Device is decommissioned' };
            }

            if (device.outlet_assignment) {
                return { valid: false, error: 'Device is already assigned to another outlet' };
            }

            // Check organization access
            if (device.organization_id !== outlet.pdu.organization_id) {
                return { valid: false, error: 'Device and outlet belong to different organizations' };
            }

            // Check user permissions
            const user = await prisma.users.findUnique({
                where: { id: assignedBy },
                select: { organization_id: true }
            });

            if (!user) {
                return { valid: false, error: 'Assigned by user not found' };
            }

            if (user.organization_id !== outlet.pdu.organization_id) {
                return { valid: false, error: 'User cannot assign devices in different organization' };
            }

            return { valid: true, outlet, device };

        } catch (error) {
            console.error('Error validating assignment:', error);
            return { valid: false, error: 'Validation failed: ' + error.message };
        }
    }

    /**
     * Check device connectivity status
     */
    async checkDeviceConnectivity(deviceId) {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                include: {
                    device_connectivity: true,
                    outlet_assignment: true
                }
            });

            if (!device || !device.outlet_assignment) {
                return false;
            }

            // Update connectivity check timestamp
            if (device.device_connectivity?.length > 0) {
                await prisma.device_connectivity.updateMany({
                    where: { device_id: deviceId },
                    data: { updated_at: new Date() }
                });
            }

            return true;

        } catch (error) {
            console.error('Error checking device connectivity:', error);
            return false;
        }
    }

    /**
     * Get assignment history for device or outlet
     */
    async getAssignmentHistory(resourceId, resourceType = 'device') {
        try {
            let whereClause = {};
            
            if (resourceType === 'device') {
                whereClause = {
                    resource_type: { in: ['outlet_assignment', 'device_transfer'] },
                    OR: [
                        { resource_id: resourceId },
                        { new_values: { path: ['device_id'], equals: resourceId } },
                        { old_values: { path: ['device_id'], equals: resourceId } }
                    ]
                };
            } else {
                whereClause = {
                    resource_type: 'outlet_assignment',
                    resource_id: resourceId
                };
            }

            const history = await prisma.audit_logs.findMany({
                where: whereClause,
                include: {
                    users: {
                        select: { username: true, full_name: true }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 50
            });

            return history;

        } catch (error) {
            console.error('Error getting assignment history:', error);
            return [];
        }
    }

    /**
     * Get available devices for assignment
     */
    async getAvailableDevices(organizationId, departmentId = null) {
        try {
            const whereClause = {
                organization_id: organizationId,
                status: { in: ['active', 'maintenance'] },
                outlet_assignment: null // Not assigned to any outlet
            };

            if (departmentId) {
                whereClause.department_id = departmentId;
            }

            const devices = await prisma.device.findMany({
                where: whereClause,
                include: {
                    model: {
                        select: { name: true, manufacturer_id: true }
                    },
                    device_connectivity: {
                        select: { is_active: true, last_connected: true }
                    }
                },
                orderBy: { serial_number: 'asc' }
            });

            return devices;

        } catch (error) {
            console.error('Error getting available devices:', error);
            return [];
        }
    }

    /**
     * Get available outlets for assignment
     */
    async getAvailableOutlets(organizationId, departmentId = null) {
        try {
            const whereClause = {
                device_id: null, // No device assigned
                is_enabled: true,
                pdu: {
                    organization_id: organizationId,
                    is_active: true
                }
            };

            if (departmentId) {
                whereClause.pdu.department_id = departmentId;
            }

            const outlets = await prisma.outlets.findMany({
                where: whereClause,
                include: {
                    pdu: {
                        select: {
                            name: true,
                            code: true,
                            type: true,
                            location: true,
                            mqtt_base_topic: true
                        }
                    }
                },
                orderBy: [
                    { pdu: { name: 'asc' } },
                    { outlet_number: 'asc' }
                ]
            });

            return outlets;

        } catch (error) {
            console.error('Error getting available outlets:', error);
            return [];
        }
    }
}

// Create singleton instance
const deviceAssignmentService = new DeviceAssignmentService();

export default deviceAssignmentService;