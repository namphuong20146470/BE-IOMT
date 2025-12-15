// features/maintenance/maintenance.service.js
import maintenanceRepository from './maintenance.repository.js';
import maintenanceModel from './maintenance.model.js';
import prisma from '../../config/db.js';
import { AppError } from '../../shared/utils/errorHandler.js';

/**
 * Maintenance History Service - Business logic
 */

class MaintenanceService {
    /**
     * Create new maintenance log
     */
    async createMaintenanceLog(data, user) {
        try {
            // Validate input
            const validatedData = maintenanceModel.validateCreateMaintenance(data);

            // Check device exists
            const device = await prisma.device.findUnique({
                where: { id: validatedData.device_id },
                include: {
                    socket: true,
                    device_data_latest: true
                }
            });

            if (!device) {
                throw new AppError('Device not found', 404);
            }

            // Auto-fill socket if device is assigned
            if (!validatedData.socket_id && device.socket) {
                validatedData.socket_id = device.socket.id;
            }

            // Auto-fill organization from device
            if (!validatedData.organization_id) {
                validatedData.organization_id = device.organization_id;
            }

            // Auto-fill initial metrics from device_data_latest (JSONB format)
            if (device.device_data_latest && !validatedData.initial_metrics) {
                validatedData.initial_metrics = {
                    voltage: device.device_data_latest.voltage,
                    current: device.device_data_latest.current,
                    power: device.device_data_latest.power,
                    frequency: device.device_data_latest.frequency,
                    power_factor: device.device_data_latest.power_factor
                };
            }

            // Set creator
            validatedData.created_by = user.id;

            // Set default performed_by to current user if not specified
            if (!validatedData.performed_by) {
                validatedData.performed_by = user.id;
            }

            // Set default performed_date to now if not specified
            if (!validatedData.performed_date) {
                validatedData.performed_date = new Date();
            }

            // Set default start_time to now if not specified
            if (!validatedData.start_time) {
                validatedData.start_time = new Date();
            }

            // Create maintenance log
            const maintenanceLog = await maintenanceRepository.create(validatedData);

            return {
                success: true,
                message: 'Maintenance log created successfully',
                data: maintenanceLog
            };
        } catch (error) {
            console.error('Error creating maintenance log:', error);
            throw new AppError(
                error.message || 'Failed to create maintenance log',
                error.statusCode || 500
            );
        }
    }

    /**
     * Get maintenance log by ID
     */
    async getMaintenanceLog(id, options = {}) {
        try {
            const validatedId = maintenanceModel.validateMaintenanceId(id);

            const maintenanceLog = await maintenanceRepository.findById(validatedId, options);

            if (!maintenanceLog) {
                throw new AppError('Maintenance log not found', 404);
            }

            // Get jobs if requested
            if (options.include_jobs) {
                const jobs = await maintenanceRepository.getMaintenanceJobs(validatedId);
                maintenanceLog.jobs = jobs;
            }

            return {
                success: true,
                data: maintenanceLog
            };
        } catch (error) {
            console.error('Error fetching maintenance log:', error);
            throw new AppError(
                error.message || 'Failed to fetch maintenance log',
                error.statusCode || 500
            );
        }
    }

    /**
     * Get all maintenance logs with filters
     */
    async getAllMaintenanceLogs(query, user) {
        try {
            const validatedQuery = maintenanceModel.validateMaintenanceQuery(query);

            // Filter by user's organization if not admin
            if (!user.is_admin && !validatedQuery.organization_id) {
                validatedQuery.organization_id = user.organization_id;
            }

            const result = await maintenanceRepository.findMany(
                validatedQuery,
                {
                    page: validatedQuery.page,
                    limit: validatedQuery.limit,
                    sort_by: validatedQuery.sort_by,
                    sort_order: validatedQuery.sort_order,
                    include_jobs: validatedQuery.include_jobs,
                    include_parts: validatedQuery.include_parts
                }
            );

            return {
                success: true,
                ...result
            };
        } catch (error) {
            console.error('Error fetching maintenance logs:', error);
            throw new AppError(
                error.message || 'Failed to fetch maintenance logs',
                error.statusCode || 500
            );
        }
    }

    /**
     * Update maintenance log
     */
    async updateMaintenanceLog(id, updateData, user) {
        try {
            const validatedId = maintenanceModel.validateMaintenanceId(id);
            const validatedData = maintenanceModel.validateUpdateMaintenance(updateData);

            // Check maintenance log exists
            const existingLog = await maintenanceRepository.findById(validatedId);
            if (!existingLog) {
                throw new AppError('Maintenance log not found', 404);
            }

            // Calculate duration if end_time is provided
            if (validatedData.end_time && existingLog.start_time) {
                const startTime = new Date(existingLog.start_time);
                const endTime = new Date(validatedData.end_time);
                validatedData.duration_minutes = Math.round((endTime - startTime) / 60000);
            }

            // Update maintenance log
            const updatedLog = await maintenanceRepository.update(validatedId, validatedData);

            return {
                success: true,
                message: 'Maintenance log updated successfully',
                data: updatedLog
            };
        } catch (error) {
            console.error('Error updating maintenance log:', error);
            throw new AppError(
                error.message || 'Failed to update maintenance log',
                error.statusCode || 500
            );
        }
    }

    /**
     * Delete maintenance log
     */
    async deleteMaintenanceLog(id, user) {
        try {
            const validatedId = maintenanceModel.validateMaintenanceId(id);

            // Check maintenance log exists
            const existingLog = await maintenanceRepository.findById(validatedId);
            if (!existingLog) {
                throw new AppError('Maintenance log not found', 404);
            }

            // Check permissions (only creator or admin can delete)
            if (existingLog.created_by !== user.id && !user.is_admin) {
                throw new AppError('You do not have permission to delete this maintenance log', 403);
            }

            await maintenanceRepository.delete(validatedId);

            return {
                success: true,
                message: 'Maintenance log deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting maintenance log:', error);
            throw new AppError(
                error.message || 'Failed to delete maintenance log',
                error.statusCode || 500
            );
        }
    }

    /**
     * Create maintenance job
     */
    async createMaintenanceJob(jobData, user) {
        try {
            console.log('🔍 Service received jobData:', JSON.stringify(jobData, null, 2));
            
            const validatedData = maintenanceModel.validateCreateJob(jobData);
            
            console.log('✅ Validated data:', JSON.stringify(validatedData, null, 2));

            // Check maintenance log exists
            const maintenanceLog = await maintenanceRepository.findById(validatedData.maintenance_id);
            if (!maintenanceLog) {
                throw new AppError('Maintenance log not found', 404);
            }

            // Calculate duration if both start and end time provided
            if (validatedData.start_time && validatedData.end_time) {
                const startTime = new Date(validatedData.start_time);
                const endTime = new Date(validatedData.end_time);
                validatedData.duration_minutes = Math.round((endTime - startTime) / 60000);
            }

            // Create job
            console.log('💾 Saving to DB:', JSON.stringify(validatedData, null, 2));
            await maintenanceRepository.createJob(validatedData);

            // Get updated jobs list
            const jobs = await maintenanceRepository.getMaintenanceJobs(validatedData.maintenance_id);

            return {
                success: true,
                message: 'Maintenance job created successfully',
                data: jobs
            };
        } catch (error) {
            console.error('Error creating maintenance job:', error);
            throw new AppError(
                error.message || 'Failed to create maintenance job',
                error.statusCode || 500
            );
        }
    }

    /**
     * Get statistics
     */
    async getStatistics(filters, user) {
        try {
            // Filter by user's organization if not admin
            if (!user.is_admin && !filters.organization_id) {
                filters.organization_id = user.organization_id;
            }

            const stats = await maintenanceRepository.getStatistics(filters);

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw new AppError(
                error.message || 'Failed to fetch statistics',
                error.statusCode || 500
            );
        }
    }

    /**
     * Get device maintenance history
     */
    async getDeviceHistory(deviceId, limit = 10) {
        try {
            const validatedId = maintenanceModel.validateMaintenanceId(deviceId);

            const history = await maintenanceRepository.getDeviceMaintenanceHistory(validatedId, limit);

            return {
                success: true,
                data: history
            };
        } catch (error) {
            console.error('Error fetching device history:', error);
            throw new AppError(
                error.message || 'Failed to fetch device history',
                error.statusCode || 500
            );
        }
    }

    /**
     * Auto-capture current device metrics
     */
    async captureCurrentMetrics(deviceId) {
        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                include: {
                    device_data_latest: true
                }
            });

            if (!device) {
                throw new AppError('Device not found', 404);
            }

            if (!device.device_data_latest) {
                throw new AppError('No real-time data available for this device', 404);
            }

            return {
                success: true,
                data: {
                    voltage: device.device_data_latest.voltage,
                    current: device.device_data_latest.current,
                    power: device.device_data_latest.power,
                    frequency: device.device_data_latest.frequency,
                    power_factor: device.device_data_latest.power_factor,
                    timestamp: device.device_data_latest.updated_at
                }
            };
        } catch (error) {
            console.error('Error capturing current metrics:', error);
            throw new AppError(
                error.message || 'Failed to capture current metrics',
                error.statusCode || 500
            );
        }
    }

    /**
     * Start maintenance job (pending → in_progress)
     */
    async startMaintenanceJob(maintenanceId, jobId, data, user) {
        try {
            // Validate IDs
            const validatedMaintenanceId = maintenanceModel.validateMaintenanceId(maintenanceId);
            const validatedJobId = maintenanceModel.validateMaintenanceId(jobId);

            // Get existing job
            const job = await maintenanceRepository.getJobById(validatedJobId);
            if (!job) {
                throw new AppError('Maintenance job not found', 404);
            }

            // Verify job belongs to the maintenance log
            if (job.maintenance_id !== validatedMaintenanceId) {
                throw new AppError('Job does not belong to this maintenance log', 400);
            }

            // Validate status transition
            if (job.status !== 'pending') {
                throw new AppError(
                    `Cannot start job with status '${job.status}'. Job must be in 'pending' status.`,
                    400
                );
            }

            // Auto-capture metrics if not provided
            let beforeMetrics = data.before_metrics;
            if (!beforeMetrics || Object.keys(beforeMetrics).length === 0) {
                const maintenanceLog = await maintenanceRepository.findById(validatedMaintenanceId);
                const metricsResponse = await this.captureCurrentMetrics(maintenanceLog.device_id);
                beforeMetrics = metricsResponse.data;
                // Remove timestamp from metrics
                delete beforeMetrics.timestamp;
            }

            // Prepare update data
            const updateData = {
                before_metrics: beforeMetrics,
                status: 'in_progress',
                start_time: new Date().toISOString()
            };

            // Add optional fields if provided
            if (data.issues_found !== undefined) {
                updateData.issues_found = data.issues_found;
            }
            if (data.actions_taken !== undefined) {
                updateData.actions_taken = data.actions_taken;
            }

            // Update job
            const updatedJob = await maintenanceRepository.updateJob(validatedJobId, updateData);

            return {
                success: true,
                message: 'Maintenance job started successfully',
                data: updatedJob
            };
        } catch (error) {
            console.error('Error starting maintenance job:', error);
            throw new AppError(
                error.message || 'Failed to start maintenance job',
                error.statusCode || 500
            );
        }
    }

    /**
     * Complete maintenance job (in_progress → completed)
     */
    async completeMaintenanceJob(maintenanceId, jobId, data, user) {
        try {
            // Validate IDs
            const validatedMaintenanceId = maintenanceModel.validateMaintenanceId(maintenanceId);
            const validatedJobId = maintenanceModel.validateMaintenanceId(jobId);

            // Get existing job
            const job = await maintenanceRepository.getJobById(validatedJobId);
            if (!job) {
                throw new AppError('Maintenance job not found', 404);
            }

            // Verify job belongs to the maintenance log
            if (job.maintenance_id !== validatedMaintenanceId) {
                throw new AppError('Job does not belong to this maintenance log', 400);
            }

            // Validate status transition
            if (job.status !== 'in_progress') {
                throw new AppError(
                    `Cannot complete job with status '${job.status}'. Job must be in 'in_progress' status.`,
                    400
                );
            }

            // Validate required fields
            if (!data.after_metrics || Object.keys(data.after_metrics).length === 0) {
                throw new AppError('after_metrics is required to complete job', 400);
            }
            if (!data.result) {
                throw new AppError('result is required to complete job', 400);
            }

            // Validate result enum
            const validResults = ['success', 'failed', 'partial', 'continue'];
            if (!validResults.includes(data.result)) {
                throw new AppError(
                    `Invalid result. Must be one of: ${validResults.join(', ')}`,
                    400
                );
            }

            // Calculate duration
            const startTime = new Date(job.start_time);
            const endTime = new Date();
            const durationMinutes = Math.round((endTime - startTime) / 60000);

            // Prepare update data
            const updateData = {
                after_metrics: data.after_metrics,
                status: 'completed',
                result: data.result,
                end_time: endTime.toISOString(),
                duration_minutes: durationMinutes,
                notes: data.notes !== undefined ? data.notes : job.notes,
                issues_found: data.issues_found !== undefined ? data.issues_found : job.issues_found,
                actions_taken: data.actions_taken !== undefined ? data.actions_taken : job.actions_taken
            };

            // Update job
            const updatedJob = await maintenanceRepository.updateJob(validatedJobId, updateData);

            return {
                success: true,
                message: 'Maintenance job completed successfully',
                data: updatedJob
            };
        } catch (error) {
            console.error('Error completing maintenance job:', error);
            throw new AppError(
                error.message || 'Failed to complete maintenance job',
                error.statusCode || 500
            );
        }
    }

    /**
     * Delete maintenance job
     */
    async deleteMaintenanceJob(maintenanceId, jobId, user) {
        try {
            // Validate IDs
            const validatedMaintenanceId = maintenanceModel.validateMaintenanceId(maintenanceId);
            const validatedJobId = maintenanceModel.validateMaintenanceId(jobId);

            // Get existing job
            const job = await maintenanceRepository.getJobById(validatedJobId);
            if (!job) {
                throw new AppError('Maintenance job not found', 404);
            }

            // Verify job belongs to the maintenance log
            if (job.maintenance_id !== validatedMaintenanceId) {
                throw new AppError('Job does not belong to this maintenance log', 400);
            }

            // Prevent deletion of completed jobs (optional - remove if you want to allow)
            if (job.status === 'completed') {
                throw new AppError(
                    'Cannot delete completed job. Only pending or in-progress jobs can be deleted.',
                    400
                );
            }

            // Delete the job
            await maintenanceRepository.deleteJob(validatedJobId);

            return {
                success: true,
                message: 'Maintenance job deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting maintenance job:', error);
            throw new AppError(
                error.message || 'Failed to delete maintenance job',
                error.statusCode || 500
            );
        }
    }
}

export default new MaintenanceService();
