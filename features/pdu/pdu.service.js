// features/pdu/pdu.service.js
import pduRepository from './pdu.repository.js';
import pduModel from './pdu.model.js';
import { AppError } from '../../shared/utils/errorHandler.js';

class PduService {
    /**
     * Get all PDUs with filtering and pagination
     */
    async getAllPDUs(queryParams, user) {
        try {
            // Validate and sanitize query parameters
            const validatedQuery = pduModel.validateQueryParams(queryParams);
            
            // Check user permissions for organization/department access
            const accessiblePDUs = await pduRepository.findAccessiblePDUs(user, validatedQuery);
            
            return {
                success: true,
                message: 'PDUs retrieved successfully',
                data: accessiblePDUs.data,
                pagination: accessiblePDUs.pagination,
                filters: accessiblePDUs.filters
            };
        } catch (error) {
            console.error('Error in getAllPDUs service:', error);
            throw new AppError(error.message || 'Failed to fetch PDUs', error.statusCode || 500);
        }
    }

    /**
     * Get PDU by ID with optional includes
     */
    async getPDUById(pduId, user, options = {}) {
        try {
            // Validate PDU ID
            const validatedId = pduModel.validatePduId(pduId);
            
            // Get PDU with access control
            const pdu = await pduRepository.findByIdWithAccess(validatedId, user, options);
            
            if (!pdu) {
                throw new AppError('PDU not found or access denied', 404);
            }

            return {
                success: true,
                message: 'PDU retrieved successfully',
                data: pdu
            };
        } catch (error) {
            console.error('Error in getPDUById service:', error);
            throw new AppError(error.message || 'Failed to fetch PDU', error.statusCode || 500);
        }
    }

    /**
     * Create new PDU
     */
    async createPDU(pduData, user) {
        try {
            // Validate PDU data
            const validatedData = pduModel.validateCreatePDU(pduData);
            
            // Check user permissions for organization/department
            await this.validateUserPDUAccess(user, validatedData.organization_id, validatedData.department_id, 'create');
            
            // Check for duplicate PDU name in organization
            await this.validatePDUUniqueness(validatedData);
            
            // Create PDU with outlets
            const newPDU = await pduRepository.create(validatedData, user.id);
            
            return {
                success: true,
                message: 'PDU created successfully',
                data: newPDU
            };
        } catch (error) {
            console.error('Error in createPDU service:', error);
            throw new AppError(error.message || 'Failed to create PDU', error.statusCode || 500);
        }
    }

    /**
     * Update PDU
     */
    async updatePDU(pduId, updateData, user) {
        try {
            // Validate inputs
            const validatedId = pduModel.validatePduId(pduId);
            const validatedData = pduModel.validateUpdatePDU(updateData);
            
            // Check PDU exists and user has access
            const existingPDU = await pduRepository.findByIdWithAccess(validatedId, user);
            if (!existingPDU) {
                throw new AppError('PDU not found or access denied', 404);
            }

            // Validate user permissions
            await this.validateUserPDUAccess(user, existingPDU.organization_id, existingPDU.department_id, 'manage');
            
            // If changing name, check uniqueness
            if (validatedData.name && validatedData.name !== existingPDU.name) {
                await this.validatePDUUniqueness({
                    name: validatedData.name,
                    organization_id: existingPDU.organization_id
                }, validatedId);
            }
            
            // Update PDU
            const updatedPDU = await pduRepository.update(validatedId, validatedData, user.id);
            
            return {
                success: true,
                message: 'PDU updated successfully',
                data: updatedPDU
            };
        } catch (error) {
            console.error('Error in updatePDU service:', error);
            throw new AppError(error.message || 'Failed to update PDU', error.statusCode || 500);
        }
    }

    /**
     * Delete PDU
     */
    async deletePDU(pduId, user) {
        try {
            // Validate PDU ID
            const validatedId = pduModel.validatePduId(pduId);
            
            // Check PDU exists and user has access
            const existingPDU = await pduRepository.findByIdWithAccess(validatedId, user);
            if (!existingPDU) {
                throw new AppError('PDU not found or access denied', 404);
            }

            // Validate user permissions
            await this.validateUserPDUAccess(user, existingPDU.organization_id, existingPDU.department_id, 'manage');
            
            // Check if PDU has active device assignments
            const hasAssignments = await pduRepository.hasActiveDeviceAssignments(validatedId);
            if (hasAssignments) {
                throw new AppError('Cannot delete PDU with active device assignments', 400);
            }
            
            // Delete PDU and its outlets
            await pduRepository.delete(validatedId, user.id);
            
            return {
                success: true,
                message: 'PDU deleted successfully'
            };
        } catch (error) {
            console.error('Error in deletePDU service:', error);
            throw new AppError(error.message || 'Failed to delete PDU', error.statusCode || 500);
        }
    }

    /**
     * Get PDU data and metrics
     */
    async getPDUData(pduId, queryParams, user) {
        try {
            // Validate inputs
            const validatedId = pduModel.validatePduId(pduId);
            const validatedQuery = pduModel.validateDataQuery(queryParams);
            
            // Check PDU access
            const pdu = await pduRepository.findByIdWithAccess(validatedId, user);
            if (!pdu) {
                throw new AppError('PDU not found or access denied', 404);
            }

            // Get PDU data and metrics
            const pduData = await pduRepository.getPDUDataMetrics(validatedId, validatedQuery);
            
            return {
                success: true,
                message: 'PDU data retrieved successfully',
                data: pduData
            };
        } catch (error) {
            console.error('Error in getPDUData service:', error);
            throw new AppError(error.message || 'Failed to fetch PDU data', error.statusCode || 500);
        }
    }

    /**
     * Get PDU outlets with status
     */
    async getPDUOutlets(pduId, user) {
        try {
            // Validate PDU ID
            const validatedId = pduModel.validatePduId(pduId);
            
            // Check PDU access
            const pdu = await pduRepository.findByIdWithAccess(validatedId, user);
            if (!pdu) {
                throw new AppError('PDU not found or access denied', 404);
            }

            // Get outlets with current status
            const outlets = await pduRepository.getPDUOutlets(validatedId);
            
            return {
                success: true,
                message: 'PDU outlets retrieved successfully',
                data: outlets
            };
        } catch (error) {
            console.error('Error in getPDUOutlets service:', error);
            throw new AppError(error.message || 'Failed to fetch PDU outlets', error.statusCode || 500);
        }
    }

    /**
     * Validate user access to PDU operations
     */
    async validateUserPDUAccess(user, organizationId, departmentId, action) {
        // System admin has full access
        if (user.permissions.includes('system.admin')) {
            return true;
        }

        // Check device permissions
        const requiredPermission = action === 'create' ? 'device.create' : 'device.manage';
        if (!user.permissions.includes(requiredPermission)) {
            throw new AppError(`Insufficient permissions for ${action} operation`, 403);
        }

        // Check organization access
        if (user.organization_id && user.organization_id !== organizationId) {
            throw new AppError('Access denied to this organization', 403);
        }

        // Check department access if specified
        if (departmentId && user.department_id && user.department_id !== departmentId) {
            throw new AppError('Access denied to this department', 403);
        }

        return true;
    }

    /**
     * Validate PDU name uniqueness
     */
    async validatePDUUniqueness(pduData, excludeId = null) {
        const existingPDU = await pduRepository.findByNameInOrganization(
            pduData.name,
            pduData.organization_id,
            excludeId
        );

        if (existingPDU) {
            throw new AppError('PDU name already exists in this organization', 400);
        }
    }

    /**
     * Get PDU status overview
     */
    async getPDUStatus(pduId, user) {
        try {
            // Validate PDU ID
            const validatedId = pduModel.validatePduId(pduId);
            
            // Check PDU access
            const pdu = await pduRepository.findByIdWithAccess(validatedId, user);
            if (!pdu) {
                throw new AppError('PDU not found or access denied', 404);
            }

            // Get comprehensive status
            const status = await pduRepository.getPDUStatus(validatedId);
            
            return {
                success: true,
                message: 'PDU status retrieved successfully',
                data: status
            };
        } catch (error) {
            console.error('Error in getPDUStatus service:', error);
            throw new AppError(error.message || 'Failed to fetch PDU status', error.statusCode || 500);
        }
    }
}

export default new PduService();