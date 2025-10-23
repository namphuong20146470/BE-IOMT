import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3030/specifications';
const AUTH_URL = 'http://localhost:3030/auth';

class SpecificationAPITester {
    constructor() {
        this.authToken = null;
        this.createdFields = [];
        this.createdSpecifications = [];
        this.testDeviceModelId = null;
    }

    async authenticate() {
        try {
            console.log('🔐 Authenticating...');
            const response = await axios.post(`${AUTH_URL}/login`, {
                username: 'superadmin',
                password: 'SuperAdmin@2025'
            });

            if (response.data.success) {
                this.authToken = response.data.data.tokens.access_token;
                console.log('✅ Authentication successful');
                console.log('🔑 Token length:', this.authToken?.length || 0);
                return true;
            } else {
                console.error('❌ Auth response not successful:', response.data);
                return false;
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error.response?.data || error.message);
            return false;
        }
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    async request(method, endpoint, data = null) {
        try {
            const config = {
                method,
                url: `${BASE_URL}${endpoint}`,
                headers: this.getHeaders()
            };

            if (data) {
                config.data = data;
            }

            if (process.env.DEBUG_API === 'true') {
                console.log('🔍 Request debug:', {
                    method,
                    url: config.url,
                    hasToken: !!this.authToken,
                    tokenLength: this.authToken?.length
                });
            }

            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            if (process.env.DEBUG_API === 'true') {
                console.log('❌ Request error debug:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    hasAuthHeader: !!config.headers.Authorization
                });
            }
            return { 
                success: false, 
                error: error.response?.data || { message: error.message },
                status: error.response?.status
            };
        }
    }

    async getTestDeviceModel() {
        try {
            const response = await axios.get('http://localhost:3030/devices/device-models', {
                headers: this.getHeaders()
            });
            
            if (response.data.success && response.data.data.length > 0) {
                this.testDeviceModelId = response.data.data[0].id;
                console.log(`📋 Using test device model: ${this.testDeviceModelId}`);
                return true;
            }
        } catch (error) {
            console.error('⚠️  Could not get device model:', error.response?.data || error.message);
        }
        return false;
    }

    // Test Specification Field Templates
    async testSpecificationFieldTemplates() {
        console.log('\n🏗️  TESTING SPECIFICATION FIELD TEMPLATES');
        console.log('==========================================');

        // Test GET /fields/templates
        console.log('📋 Testing GET /fields/templates');
        const getResult = await this.request('GET', '/fields/templates');
        if (getResult.success) {
            console.log(`✅ Retrieved ${getResult.data.data?.length || 0} field templates`);
        } else {
            console.log('❌ Failed to get field templates:', getResult.error);
        }

        // Test GET with search
        console.log('🔍 Testing GET /fields/templates?search=màn');
        const searchResult = await this.request('GET', '/fields/templates?search=màn');
        if (searchResult.success) {
            console.log(`✅ Search returned ${searchResult.data.data?.length || 0} results`);
        } else {
            console.log('❌ Search failed:', searchResult.error);
        }

        // Test CREATE/UPDATE field template
        console.log('➕ Testing PUT /fields/templates (CREATE)');
        const newField = {
            field_name: 'test_screen_size',
            field_name_vi: 'Kích thước màn hình test',
            field_name_en: 'Test Screen Size',
            unit: 'inch',
            category: 'display',
            data_type: 'numeric',
            placeholder: 'Nhập kích thước màn hình',
            help_text: 'Kích thước đường chéo của màn hình tính bằng inch',
            sort_order: 100
        };

        const createResult = await this.request('PUT', '/fields/templates', newField);
        if (createResult.success) {
            this.createdFields.push(createResult.data.data);
            console.log(`✅ Created field template: ${createResult.data.data.field_name}`);
        } else {
            console.log('❌ Failed to create field template:', createResult.error);
        }

        // Test UPDATE existing field
        console.log('✏️  Testing PUT /fields/templates (UPDATE)');
        const updateField = {
            ...newField,
            field_name_vi: 'Kích thước màn hình test (đã sửa)',
            help_text: 'Updated help text for screen size'
        };

        const updateResult = await this.request('PUT', '/fields/templates', updateField);
        if (updateResult.success) {
            console.log(`✅ Updated field template: ${updateResult.data.data.field_name}`);
        } else {
            console.log('❌ Failed to update field template:', updateResult.error);
        }

        // Test validation errors
        console.log('🚫 Testing validation (missing required fields)');
        const invalidField = {
            field_name: 'invalid_field'
            // Missing field_name_vi
        };

        const validationResult = await this.request('PUT', '/fields/templates', invalidField);
        if (!validationResult.success) {
            console.log('✅ Validation error caught correctly:', validationResult.error.message);
        } else {
            console.log('⚠️  Validation should have failed');
        }
    }

    // Test Categories
    async testSpecificationCategories() {
        console.log('\n📂 TESTING SPECIFICATION CATEGORIES');
        console.log('===================================');

        const categoriesResult = await this.request('GET', '/categories');
        if (categoriesResult.success) {
            console.log(`✅ Retrieved categories:`, categoriesResult.data.data);
        } else {
            console.log('❌ Failed to get categories:', categoriesResult.error);
        }
    }

    // Test Device Model Specifications
    async testModelSpecifications() {
        console.log('\n🔧 TESTING DEVICE MODEL SPECIFICATIONS');
        console.log('=====================================');

        if (!this.testDeviceModelId) {
            console.log('⚠️  No device model available for testing');
            return;
        }

        // Test GET model specifications
        console.log(`📋 Testing GET /models/${this.testDeviceModelId}`);
        const getModelResult = await this.request('GET', `/models/${this.testDeviceModelId}`);
        if (getModelResult.success) {
            console.log(`✅ Retrieved ${getModelResult.data.data?.length || 0} specifications for model`);
        } else {
            console.log('❌ Failed to get model specifications:', getModelResult.error);
        }

        // Test CREATE/UPDATE model specifications
        console.log(`➕ Testing PUT /models/${this.testDeviceModelId}`);
        const specifications = [
            {
                field_name: 'test_screen_size',
                field_name_vi: 'Kích thước màn hình test',
                value: '27',
                unit: 'inch',
                description: 'Màn hình LED 27 inch độ phân giải cao',
                display_order: 1
            },
            {
                field_name: 'test_battery_capacity',
                field_name_vi: 'Dung lượng pin test',
                value: '5000',
                unit: 'mAh',
                description: 'Pin lithium-ion dung lượng cao',
                display_order: 2
            },
            {
                field_name: 'test_field',
                field_name_vi: 'Test field example',
                value: 'sample_value',
                unit: 'unit',
                description: 'Trường test mẫu',
                display_order: 3
            }
        ];

        const createSpecsResult = await this.request('PUT', `/models/${this.testDeviceModelId}`, {
            specifications
        });

        if (createSpecsResult.success) {
            this.createdSpecifications = createSpecsResult.data.data.specifications;
            console.log(`✅ Created/Updated ${createSpecsResult.data.data.updated_count} specifications`);
        } else {
            console.log('❌ Failed to create model specifications:', createSpecsResult.error);
        }

        // Test Enhanced model specifications
        console.log(`🔍 Testing GET /models/${this.testDeviceModelId}/enhanced`);
        const enhancedResult = await this.request('GET', `/models/${this.testDeviceModelId}/enhanced`);
        if (enhancedResult.success) {
            console.log(`✅ Retrieved enhanced specifications with templates`);
        } else {
            console.log('❌ Failed to get enhanced specifications:', enhancedResult.error);
        }

        // Test invalid device model ID
        console.log('🚫 Testing with invalid device model ID');
        const invalidModelResult = await this.request('GET', '/models/invalid-uuid');
        if (!invalidModelResult.success && invalidModelResult.status === 400) {
            console.log('✅ Invalid UUID error caught correctly');
        } else {
            console.log('⚠️  Should have failed with invalid UUID');
        }

        // Test validation errors for specifications
        console.log('🚫 Testing specification validation');
        const invalidSpecs = {
            specifications: [
                {
                    // Missing required fields
                    value: '27'
                }
            ]
        };

        const specValidationResult = await this.request('PUT', `/models/${this.testDeviceModelId}`, invalidSpecs);
        if (!specValidationResult.success) {
            console.log('✅ Specification validation error caught:', specValidationResult.error.message);
        } else {
            console.log('⚠️  Specification validation should have failed');
        }
    }

    // Test Statistics
    async testSpecificationStats() {
        console.log('\n📊 TESTING SPECIFICATION STATISTICS');
        console.log('===================================');

        const statsResult = await this.request('GET', '/stats');
        if (statsResult.success) {
            const { field_usage, unit_usage } = statsResult.data.data;
            console.log(`✅ Retrieved stats - Fields: ${field_usage?.length || 0}, Units: ${unit_usage?.length || 0}`);
            
            if (field_usage?.length > 0) {
                console.log(`   Top field: ${field_usage[0].name} (${field_usage[0].count} uses)`);
            }
            if (unit_usage?.length > 0) {
                console.log(`   Top unit: ${unit_usage[0].name} (${unit_usage[0].count} uses)`);
            }
        } else {
            console.log('❌ Failed to get statistics:', statsResult.error);
        }
    }

    // Test Legacy Routes
    async testLegacyRoutes() {
        console.log('\n🔄 TESTING LEGACY ROUTES');
        console.log('========================');

        const legacyFieldsResult = await this.request('GET', '/fields');
        if (legacyFieldsResult.success) {
            console.log(`✅ Legacy fields endpoint returned ${legacyFieldsResult.data.data?.length || 0} results`);
        } else {
            console.log('❌ Legacy fields endpoint failed:', legacyFieldsResult.error);
        }
    }

    // Delete test specifications
    async testDeleteSpecification() {
        console.log('\n🗑️  TESTING DELETE SPECIFICATION');
        console.log('================================');

        if (this.createdSpecifications.length > 0) {
            const specToDelete = this.createdSpecifications[0];
            console.log(`🗑️  Testing DELETE /${specToDelete.id}`);
            
            const deleteResult = await this.request('DELETE', `/${specToDelete.id}`);
            if (deleteResult.success) {
                console.log(`✅ Deleted specification: ${specToDelete.field_name}`);
            } else {
                console.log('❌ Failed to delete specification:', deleteResult.error);
            }
        } else {
            console.log('⚠️  No specifications to delete');
        }

        // Test delete non-existent specification
        console.log('🚫 Testing DELETE with invalid ID');
        const invalidDeleteResult = await this.request('DELETE', '/99999');
        if (!invalidDeleteResult.success && invalidDeleteResult.status === 404) {
            console.log('✅ Delete non-existent specification error caught correctly');
        } else {
            console.log('⚠️  Should have failed to delete non-existent specification');
        }
    }

    // Performance test
    async testPerformance() {
        console.log('\n⚡ TESTING PERFORMANCE');
        console.log('=====================');

        const startTime = Date.now();
        const promises = [];

        // Run multiple requests concurrently
        for (let i = 0; i < 5; i++) {
            promises.push(this.request('GET', '/fields/templates'));
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const successCount = results.filter(r => r.success).length;

        console.log(`✅ Performance test: ${successCount}/5 requests successful in ${endTime - startTime}ms`);
    }

    // Main test runner
    async runAllTests() {
        console.log('🧪 SPECIFICATION API COMPREHENSIVE TESTING');
        console.log('==========================================');
        console.log('Base URL:', BASE_URL);
        console.log('Started at:', new Date().toLocaleString());
        console.log('');

        // Authenticate
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
            console.log('❌ Cannot proceed without authentication');
            return;
        }

        // Test auth immediately
        console.log('\n🧪 Testing authentication...');
        const authTest = await this.request('GET', '/fields/templates?limit=1');
        if (authTest.success) {
            console.log('✅ Authentication working correctly');
        } else {
            console.log('❌ Authentication test failed:', authTest.error);
            console.log('🔧 Token being used:', this.authToken?.substring(0, 50) + '...');
            return;
        }

        // Get test device model
        await this.getTestDeviceModel();

        try {
            // Run all tests
            await this.testSpecificationFieldTemplates();
            await this.testSpecificationCategories();
            await this.testModelSpecifications();
            await this.testSpecificationStats();
            await this.testLegacyRoutes();
            await this.testDeleteSpecification();
            await this.testPerformance();

        } catch (error) {
            console.error('❌ Test execution error:', error);
        }

        console.log('\n🎉 TESTING COMPLETED!');
        console.log('====================');
    }
}

// Run tests
const tester = new SpecificationAPITester();
tester.runAllTests();