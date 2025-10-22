/**
 * 🧪 DEVICE API TESTING SCRIPT
 * Test all device management endpoints
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3030';
const API_BASE = `${BASE_URL}/devices`;

// Test configuration
const TEST_CONFIG = {
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
};

// Test data
const TEST_DATA = {
    category: {
        name: 'Test Category',
        description: 'Test category for API testing'
    },
    model: {
        name: 'Test Model',
        model_number: 'TM-2024-TEST',
        description: 'Test model for API testing'
    },
    device: {
        serial_number: `TEST-${Date.now()}`,
        asset_tag: `TEST-ASSET-${Date.now()}`,
        location: 'Test Location',
        notes: 'Test device for API testing'
    }
};

class DeviceAPITester {
    constructor() {
        this.authToken = null;
        this.createdIds = {
            category: null,
            model: null,
            device: null
        };
    }

    // Authentication
    async login() {
        try {
            console.log('🔐 Authenticating...');
            const response = await axios.post(`${BASE_URL}/auth/login`, {
                username: 'superadmin',
                password: 'SuperAdmin@2025'
            }, TEST_CONFIG);

            this.authToken = response.data.data.tokens.access_token;
            console.log('✅ Authentication successful');
            return true;
        } catch (error) {
            console.error('❌ Authentication failed:', error.response?.data || error.message);
            return false;
        }
    }

    // Helper to make authenticated requests
    async request(method, endpoint, data = null) {
        const config = {
            ...TEST_CONFIG,
            method,
            url: `${API_BASE}${endpoint}`,
            headers: {
                ...TEST_CONFIG.headers,
                'Authorization': `Bearer ${this.authToken}`
            }
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data || error.message,
                status: error.response?.status
            };
        }
    }

    // Test Device Categories
    async testDeviceCategories() {
        console.log('\n🗂️  TESTING DEVICE CATEGORIES');
        console.log('================================');

        // GET all categories
        console.log('📋 Testing GET /device-categories');
        const getResult = await this.request('GET', '/device-categories');
        if (getResult.success) {
            console.log(`✅ Found ${getResult.data.data?.length || 0} categories`);
        } else {
            console.log('❌ Failed to get categories:', getResult.error);
        }

        // GET root categories
        console.log('📋 Testing GET /device-categories/root');
        const rootResult = await this.request('GET', '/device-categories/root');
        if (rootResult.success) {
            console.log(`✅ Found ${rootResult.data.data?.length || 0} root categories`);
        } else {
            console.log('❌ Failed to get root categories:', rootResult.error);
        }

        // CREATE category
        console.log('➕ Testing POST /device-categories');
        const createResult = await this.request('POST', '/device-categories', TEST_DATA.category);
        if (createResult.success) {
            this.createdIds.category = createResult.data.data.id;
            console.log(`✅ Created category: ${this.createdIds.category}`);
        } else {
            console.log('❌ Failed to create category:', createResult.error);
        }

        // UPDATE category
        if (this.createdIds.category) {
            console.log('✏️  Testing PUT /device-categories/:id');
            const updateData = { ...TEST_DATA.category, name: 'Updated Test Category' };
            const updateResult = await this.request('PUT', `/device-categories/${this.createdIds.category}`, updateData);
            if (updateResult.success) {
                console.log('✅ Updated category successfully');
            } else {
                console.log('❌ Failed to update category:', updateResult.error);
            }
        }

        // GET category stats
        if (this.createdIds.category) {
            console.log('📊 Testing GET /device-categories/:id/stats');
            const statsResult = await this.request('GET', `/device-categories/${this.createdIds.category}/stats`);
            if (statsResult.success) {
                console.log('✅ Retrieved category stats');
            } else {
                console.log('❌ Failed to get category stats:', statsResult.error);
            }
        }
    }

    // Test Device Models
    async testDeviceModels() {
        console.log('\n🔧 TESTING DEVICE MODELS');
        console.log('==========================');

        // GET all models
        console.log('📋 Testing GET /device-models');
        const getResult = await this.request('GET', '/device-models');
        if (getResult.success) {
            console.log(`✅ Found ${getResult.data.data?.length || 0} models`);
        } else {
            console.log('❌ Failed to get models:', getResult.error);
        }

        // GET manufacturers
        console.log('🏭 Testing GET /device-models/manufacturers');
        const mfgResult = await this.request('GET', '/device-models/manufacturers');
        if (mfgResult.success) {
            console.log(`✅ Found ${mfgResult.data.data?.length || 0} manufacturers`);
        } else {
            console.log('❌ Failed to get manufacturers:', mfgResult.error);
        }

        // CREATE model (requires category)
        if (this.createdIds.category) {
            console.log('➕ Testing POST /device-models');
            
            // Get first manufacturer for testing
            let manufacturerId = null;
            const mfgResult = await this.request('GET', '/device-models/manufacturers');
            if (mfgResult.success && mfgResult.data.data?.length > 0) {
                manufacturerId = mfgResult.data.data[0].id;
            }
            
            const modelData = {
                ...TEST_DATA.model,
                category_id: this.createdIds.category,
                manufacturer_id: manufacturerId // Use manufacturer_id instead of manufacturer
            };
            const createResult = await this.request('POST', '/device-models', modelData);
            if (createResult.success) {
                this.createdIds.model = createResult.data.data.id;
                console.log(`✅ Created model: ${this.createdIds.model}`);
            } else {
                console.log('❌ Failed to create model:', createResult.error);
            }
        }

        // GET model by ID
        if (this.createdIds.model) {
            console.log('🔍 Testing GET /device-models/:id');
            const getByIdResult = await this.request('GET', `/device-models/${this.createdIds.model}`);
            if (getByIdResult.success) {
                console.log('✅ Retrieved model details');
            } else {
                console.log('❌ Failed to get model details:', getByIdResult.error);
            }
        }

        // GET models by category
        if (this.createdIds.category) {
            console.log('📂 Testing GET /device-models/category/:categoryId');
            const categoryResult = await this.request('GET', `/device-models/category/${this.createdIds.category}`);
            if (categoryResult.success) {
                console.log(`✅ Found models in category`);
            } else {
                console.log('❌ Failed to get models by category:', categoryResult.error);
            }
        }
    }

    // Test Devices
    async testDevices() {
        console.log('\n🔌 TESTING DEVICES');
        console.log('===================');

        // GET all devices
        console.log('📋 Testing GET /devices');
        const getResult = await this.request('GET', '/devices');
        if (getResult.success) {
            console.log(`✅ Found ${getResult.data.data?.length || 0} devices`);
        } else {
            console.log('❌ Failed to get devices:', getResult.error);
        }

        // GET device statistics
        console.log('📊 Testing GET /devices/statistics');
        const statsResult = await this.request('GET', '/devices/statistics');
        if (statsResult.success) {
            console.log('✅ Retrieved device statistics');
        } else {
            console.log('❌ Failed to get device statistics:', statsResult.error);
        }

        // CREATE device (requires model and organization)
        if (this.createdIds.model) {
            console.log('➕ Testing POST /devices');
            
            // Get organizations to use existing one
            const orgResponse = await axios.get(`${BASE_URL}/actlog/organizations`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            if (orgResponse.data.success && orgResponse.data.data.length > 0) {
                const deviceData = {
                    ...TEST_DATA.device,
                    model_id: this.createdIds.model,
                    organization_id: orgResponse.data.data[0].id
                };
                
                const createResult = await this.request('POST', '/devices', deviceData);
                if (createResult.success) {
                    this.createdIds.device = createResult.data.data.id;
                    console.log(`✅ Created device: ${this.createdIds.device}`);
                } else {
                    console.log('❌ Failed to create device:', createResult.error);
                }
            } else {
                console.log('⚠️  No organizations found, skipping device creation');
            }
        }

        // GET device by ID
        if (this.createdIds.device) {
            console.log('🔍 Testing GET /devices/:id');
            const getByIdResult = await this.request('GET', `/devices/${this.createdIds.device}`);
            if (getByIdResult.success) {
                console.log('✅ Retrieved device details');
            } else {
                console.log('❌ Failed to get device details:', getByIdResult.error);
            }
        }
    }

    // Test Connectivity
    async testConnectivity() {
        console.log('\n📡 TESTING DEVICE CONNECTIVITY');
        console.log('================================');

        // GET all connectivity
        console.log('📋 Testing GET /device-connectivity');
        const getResult = await this.request('GET', '/device-connectivity');
        if (getResult.success) {
            console.log(`✅ Found connectivity configurations`);
        } else {
            console.log('❌ Failed to get connectivity:', getResult.error);
        }

        // GET connectivity statistics
        console.log('📊 Testing GET /device-connectivity/statistics');
        const statsResult = await this.request('GET', '/device-connectivity/statistics');
        if (statsResult.success) {
            console.log('✅ Retrieved connectivity statistics');
        } else {
            console.log('❌ Failed to get connectivity statistics:', statsResult.error);
        }
    }

    // Test Warranties
    async testWarranties() {
        console.log('\n📋 TESTING WARRANTIES');
        console.log('======================');

        // GET all warranties
        console.log('📋 Testing GET /warranties');
        const getResult = await this.request('GET', '/warranties');
        if (getResult.success) {
            console.log('✅ Retrieved warranties');
        } else {
            console.log('❌ Failed to get warranties:', getResult.error);
        }

        // GET warranty statistics
        console.log('📊 Testing GET /warranties/statistics');
        const statsResult = await this.request('GET', '/warranties/statistics');
        if (statsResult.success) {
            console.log('✅ Retrieved warranty statistics');
        } else {
            console.log('❌ Failed to get warranty statistics:', statsResult.error);
        }
    }

    // Cleanup created resources
    async cleanup() {
        console.log('\n🧹 CLEANING UP TEST DATA');
        console.log('==========================');

        // Delete device
        if (this.createdIds.device) {
            console.log('🗑️  Deleting test device...');
            const deleteResult = await this.request('DELETE', `/devices/${this.createdIds.device}`);
            if (deleteResult.success) {
                console.log('✅ Deleted test device');
            } else {
                console.log('❌ Failed to delete test device:', deleteResult.error);
            }
        }

        // Delete model
        if (this.createdIds.model) {
            console.log('🗑️  Deleting test model...');
            const deleteResult = await this.request('DELETE', `/device-models/${this.createdIds.model}`);
            if (deleteResult.success) {
                console.log('✅ Deleted test model');
            } else {
                console.log('❌ Failed to delete test model:', deleteResult.error);
            }
        }

        // Delete category
        if (this.createdIds.category) {
            console.log('🗑️  Deleting test category...');
            const deleteResult = await this.request('DELETE', `/device-categories/${this.createdIds.category}`);
            if (deleteResult.success) {
                console.log('✅ Deleted test category');
            } else {
                console.log('❌ Failed to delete test category:', deleteResult.error);
            }
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 DEVICE API COMPREHENSIVE TESTING');
        console.log('=====================================');
        console.log(`Base URL: ${API_BASE}`);
        console.log(`Started at: ${new Date().toLocaleString()}`);

        try {
            // Authenticate
            const authSuccess = await this.login();
            if (!authSuccess) {
                console.log('❌ Cannot proceed without authentication');
                return;
            }

            // Run tests in order
            await this.testDeviceCategories();
            await this.testDeviceModels();
            await this.testDevices();
            await this.testConnectivity();
            await this.testWarranties();

            // Cleanup
            await this.cleanup();

            console.log('\n🎉 TESTING COMPLETED!');
            console.log('======================');

        } catch (error) {
            console.error('💥 Test suite failed:', error);
        }
    }
}

// Run tests
const tester = new DeviceAPITester();
tester.runAllTests();