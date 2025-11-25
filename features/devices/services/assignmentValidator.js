// services/device-assignment/assignmentValidator.js
import prisma from '../../../config/db.js';

class AssignmentValidator {
    /**
     * Validate single device-outlet assignment
     */
    async validateSingleAssignment(outletId, deviceId, userId) {
        const validation = {
            valid: false,
            errors: [],
            warnings: [],
            outlet: null,
            device: null,
            user: null
        };

        try {
            // Parallel validation queries for efficiency
            const [outlet, device, user] = await Promise.all([
                this.validateOutlet(outletId),
                this.validateDevice(deviceId),
                this.validateUser(userId)
            ]);

            validation.outlet = outlet;
            validation.device = device;
            validation.user = user;

            // Check outlet validation
            if (!outlet.valid) {
                validation.errors.push(...outlet.errors);
            }

            // Check device validation
            if (!device.valid) {
                validation.errors.push(...device.errors);
            }

            // Check user validation
            if (!user.valid) {
                validation.errors.push(...user.errors);
            }

            // Cross-validation if individual validations pass
            if (outlet.valid && device.valid && user.valid) {
                const crossValidation = await this.validateCrossReferences(
                    outlet.data, device.data, user.data
                );
                
                if (!crossValidation.valid) {
                    validation.errors.push(...crossValidation.errors);
                }
                validation.warnings.push(...crossValidation.warnings);
            }

            validation.valid = validation.errors.length === 0;

            return validation;

        } catch (error) {
            validation.errors.push(`Validation error: ${error.message}`);
            return validation;
        }
    }

    /**
     * Validate outlet availability and status
     */
    async validateOutlet(outletId) {
        try {
            const outlet = await prisma.outlets.findUnique({
                where: { id: outletId },
                include: {
                    pdu: {
                        include: {
                            organization: { select: { name: true } },
                            department: { select: { name: true } }
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            serial_number: true,
                            status: true
                        }
                    }
                }
            });

            if (!outlet) {
                return {
                    valid: false,
                    errors: ['Outlet not found'],
                    data: null
                };
            }

            const errors = [];
            const warnings = [];

            // Check outlet status
            if (!outlet.is_enabled) {
                errors.push('Outlet is disabled');
            }

            if (outlet.device_id) {
                errors.push(`Outlet is already assigned to device ${outlet.device.serial_number}`);
            }

            // Check PDU status
            if (!outlet.pdu.is_active) {
                errors.push('PDU is inactive');
            }

            if (outlet.pdu.status === 'maintenance') {
                warnings.push('PDU is in maintenance mode');
            }

            // Check outlet power limits
            if (outlet.max_power_watts && outlet.max_power_watts < 10) {
                warnings.push('Outlet has very low power limit');
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                data: outlet
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Outlet validation error: ${error.message}`],
                data: null
            };
        }
    }

    /**
     * Validate device availability and compatibility
     */
    async validateDevice(deviceId) {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                include: {
                    model: {
                        include: {
                            manufacturer: { select: { name: true } }
                        }
                    },
                    organization: { select: { name: true } },
                    department: { select: { name: true } },
                    outlet_assignment: {
                        include: {
                            pdu: { select: { name: true, code: true } }
                        }
                    },
                    device_connectivity: true
                }
            });

            if (!device) {
                return {
                    valid: false,
                    errors: ['Device not found'],
                    data: null
                };
            }

            const errors = [];
            const warnings = [];

            // Check device status
            if (device.status === 'decommissioned') {
                errors.push('Device is decommissioned');
            }

            if (device.status === 'retired') {
                errors.push('Device is retired');
            }

            if (device.outlet_assignment) {
                errors.push(`Device is already assigned to outlet ${device.outlet_assignment.outlet_number} in PDU ${device.outlet_assignment.pdu.name}`);
            }

            // Check device maintenance
            if (device.status === 'maintenance') {
                warnings.push('Device is in maintenance mode');
            }

            if (device.status === 'inactive') {
                warnings.push('Device is currently inactive');
            }

            // Check connectivity requirements
            if (device.device_connectivity?.length === 0) {
                warnings.push('Device has no connectivity configuration');
            }

            // Check device age or warranty
            if (device.warranty_end && new Date(device.warranty_end) < new Date()) {
                warnings.push('Device warranty has expired');
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                data: device
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Device validation error: ${error.message}`],
                data: null
            };
        }
    }

    /**
     * Validate user permissions and access
     */
    async validateUser(userId) {
        try {
            const user = await prisma.users.findUnique({
                where: { id: userId },
                include: {
                    organization: { select: { name: true } },
                    department: { select: { name: true } },
                    user_roles: {
                        include: {
                            role: {
                                include: {
                                    role_permissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!user) {
                return {
                    valid: false,
                    errors: ['User not found'],
                    data: null
                };
            }

            const errors = [];
            const warnings = [];

            // Check user status
            if (!user.is_active) {
                errors.push('User account is inactive');
            }

            // Check required permissions
            const hasDeviceManagePermission = user.user_roles.some(ur => 
                ur.role.role_permissions.some(rp => 
                    rp.permission.name === 'device_manage' || 
                    rp.permission.name === 'outlet_manage' ||
                    rp.permission.name === 'admin'
                )
            );

            if (!hasDeviceManagePermission) {
                errors.push('User lacks required permissions for device assignment');
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                data: user
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`User validation error: ${error.message}`],
                data: null
            };
        }
    }

    /**
     * Validate cross-references between outlet, device, and user
     */
    async validateCrossReferences(outlet, device, user) {
        const errors = [];
        const warnings = [];

        // Check organization match
        if (device.organization_id !== outlet.pdu.organization_id) {
            errors.push('Device and outlet belong to different organizations');
        }

        if (user.organization_id !== outlet.pdu.organization_id) {
            errors.push('User cannot assign devices in different organization');
        }

        // Check department compatibility
        if (device.department_id && outlet.pdu.department_id && 
            device.department_id !== outlet.pdu.department_id) {
            warnings.push('Device and outlet belong to different departments');
        }

        // Check power compatibility
        if (device.model.power_consumption && outlet.max_power_watts) {
            if (device.model.power_consumption > outlet.max_power_watts) {
                errors.push(`Device power consumption (${device.model.power_consumption}W) exceeds outlet limit (${outlet.max_power_watts}W)`);
            }
        }

        // Check voltage compatibility
        if (device.model.voltage_rating && outlet.voltage_rating) {
            if (device.model.voltage_rating !== outlet.voltage_rating) {
                warnings.push(`Voltage mismatch: Device requires ${device.model.voltage_rating}V, outlet provides ${outlet.voltage_rating}V`);
            }
        }

        // Check connector compatibility
        if (device.model.connector_type && outlet.connector_type) {
            if (device.model.connector_type !== outlet.connector_type) {
                errors.push(`Connector mismatch: Device uses ${device.model.connector_type}, outlet has ${outlet.connector_type}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate bulk assignment
     */
    async validateBulkAssignment(assignments, userId) {
        const results = [];

        for (const assignment of assignments) {
            const validation = await this.validateSingleAssignment(
                assignment.outlet_id,
                assignment.device_id,
                userId
            );

            results.push({
                outlet_id: assignment.outlet_id,
                device_id: assignment.device_id,
                valid: validation.valid,
                errors: validation.errors,
                warnings: validation.warnings,
                outlet_name: validation.outlet?.data?.pdu?.name + ' - Outlet ' + validation.outlet?.data?.outlet_number,
                device_name: validation.device?.data?.serial_number
            });
        }

        const totalValid = results.filter(r => r.valid).length;
        const totalInvalid = results.filter(r => !r.valid).length;

        return {
            total_assignments: assignments.length,
            valid_assignments: totalValid,
            invalid_assignments: totalInvalid,
            can_proceed: totalValid > 0,
            results
        };
    }

    /**
     * Validate device transfer between outlets
     */
    async validateDeviceTransfer(fromOutletId, toOutletId, userId) {
        try {
            // Validate source outlet has device
            const fromOutlet = await prisma.outlets.findUnique({
                where: { id: fromOutletId },
                include: {
                    device: true,
                    pdu: { include: { organization: true } }
                }
            });

            if (!fromOutlet) {
                return {
                    valid: false,
                    errors: ['Source outlet not found']
                };
            }

            if (!fromOutlet.device_id) {
                return {
                    valid: false,
                    errors: ['Source outlet has no device to transfer']
                };
            }

            // Validate destination outlet
            const destinationValidation = await this.validateSingleAssignment(
                toOutletId,
                fromOutlet.device_id,
                userId
            );

            if (!destinationValidation.valid) {
                return {
                    valid: false,
                    errors: [
                        'Transfer validation failed for destination outlet:',
                        ...destinationValidation.errors
                    ],
                    warnings: destinationValidation.warnings
                };
            }

            // Additional transfer-specific checks
            const warnings = [...destinationValidation.warnings];

            // Check if PDUs are in same location
            if (fromOutlet.pdu.location !== destinationValidation.outlet.data.pdu.location) {
                warnings.push('Device will be moved to different physical location');
            }

            return {
                valid: true,
                errors: [],
                warnings,
                from_outlet: fromOutlet,
                to_outlet: destinationValidation.outlet.data,
                device: fromOutlet.device
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Transfer validation error: ${error.message}`]
            };
        }
    }

    /**
     * Check assignment conflicts in real-time
     */
    async checkAssignmentConflicts(outletId, deviceId) {
        try {
            // Check for concurrent assignment attempts
            const [outletCheck, deviceCheck] = await Promise.all([
                prisma.outlets.findUnique({
                    where: { id: outletId },
                    select: { device_id: true, updated_at: true }
                }),
                prisma.device.findUnique({
                    where: { id: deviceId },
                    include: {
                        outlet_assignment: {
                            select: { id: true, outlet_number: true, updated_at: true }
                        }
                    }
                })
            ]);

            const conflicts = [];

            if (outletCheck?.device_id) {
                conflicts.push({
                    type: 'outlet_occupied',
                    message: 'Outlet was assigned to another device',
                    timestamp: outletCheck.updated_at
                });
            }

            if (deviceCheck?.outlet_assignment) {
                conflicts.push({
                    type: 'device_assigned',
                    message: `Device was assigned to outlet ${deviceCheck.outlet_assignment.outlet_number}`,
                    timestamp: deviceCheck.outlet_assignment.updated_at
                });
            }

            return {
                has_conflicts: conflicts.length > 0,
                conflicts
            };

        } catch (error) {
            return {
                has_conflicts: true,
                conflicts: [{
                    type: 'validation_error',
                    message: error.message
                }]
            };
        }
    }
}

// Create singleton instance
const assignmentValidator = new AssignmentValidator();

export default assignmentValidator;