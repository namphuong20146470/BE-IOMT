import axios from 'axios';

// Validation and error handling tests for specification endpoints
const BASE_URL = 'http://localhost:3030';

async function validationTests() {
    console.log('🛡️  SPECIFICATION API VALIDATION TESTS');
    console.log('=====================================');
    
    // Get auth token
    const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
        username: 'superadmin',
        password: 'SuperAdmin@2025'
    });
    const token = authResponse.data.data.tokens.access_token;
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('\n1️⃣  Testing field template validation errors');
    console.log('--------------------------------------------');

    // Test cases for field template validation
    const invalidFieldTests = [
        {
            name: 'Missing field_name',
            data: { field_name_vi: 'Test field' },
            expectedError: 'field_name and field_name_vi are required'
        },
        {
            name: 'Missing field_name_vi',
            data: { field_name: 'test_field' },
            expectedError: 'field_name and field_name_vi are required'
        },
        {
            name: 'Empty object',
            data: {},
            expectedError: 'field_name and field_name_vi are required'
        },
        {
            name: 'Invalid data type',
            data: {
                field_name: 'test_field',
                field_name_vi: 'Test field',
                data_type: 'invalid_type'
            },
            expectedError: null // Should be handled by DB constraints
        }
    ];

    for (const test of invalidFieldTests) {
        try {
            const response = await axios.put(`${BASE_URL}/specifications/fields/templates`, test.data, { headers });
            console.log(`❌ ${test.name}: Should have failed but got:`, response.data);
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Unknown error';
            if (test.expectedError && errorMsg.includes(test.expectedError)) {
                console.log(`✅ ${test.name}: Correctly rejected - ${errorMsg}`);
            } else {
                console.log(`⚠️  ${test.name}: Error message differs - ${errorMsg}`);
            }
        }
    }

    console.log('\n2️⃣  Testing model specification validation errors');
    console.log('------------------------------------------------');

    // Get a device model for testing
    let deviceModelId = null;
    try {
        const response = await axios.get(`${BASE_URL}/devices/device-models`, { headers });
        if (response.data.data?.length > 0) {
            deviceModelId = response.data.data[0].id;
        }
    } catch (error) {
        console.log('⚠️  Could not get device model for validation tests');
    }

    if (deviceModelId) {
        const invalidSpecTests = [
            {
                name: 'Empty specifications array',
                data: { specifications: [] },
                expectedError: 'Specifications array cannot be empty'
            },
            {
                name: 'Missing specifications property',
                data: {},
                expectedError: 'Specifications array is required'
            },
            {
                name: 'Invalid specifications format',
                data: { specifications: 'not_an_array' },
                expectedError: 'Specifications array is required'
            },
            {
                name: 'Missing required fields in specification',
                data: {
                    specifications: [
                        { value: '100' } // Missing field_name, field_name_vi
                    ]
                },
                expectedError: 'Validation failed'
            },
            {
                name: 'Field name too long',
                data: {
                    specifications: [
                        {
                            field_name: 'a'.repeat(101),
                            field_name_vi: 'Test field',
                            value: '100'
                        }
                    ]
                },
                expectedError: 'field_name must not exceed 100 characters'
            },
            {
                name: 'Value too long',
                data: {
                    specifications: [
                        {
                            field_name: 'test_field',
                            field_name_vi: 'Test field',
                            value: 'a'.repeat(256)
                        }
                    ]
                },
                expectedError: 'value must not exceed 255 characters'
            }
        ];

        for (const test of invalidSpecTests) {
            try {
                const response = await axios.put(`${BASE_URL}/specifications/models/${deviceModelId}`, test.data, { headers });
                console.log(`❌ ${test.name}: Should have failed but got:`, response.data);
            } catch (error) {
                const errorMsg = error.response?.data?.message || 'Unknown error';
                if (test.expectedError && errorMsg.includes(test.expectedError)) {
                    console.log(`✅ ${test.name}: Correctly rejected - ${errorMsg}`);
                } else {
                    console.log(`⚠️  ${test.name}: Error message differs - ${errorMsg}`);
                }
            }
        }
    }

    console.log('\n3️⃣  Testing invalid UUIDs and IDs');
    console.log('---------------------------------');

    // Test invalid device model UUID
    const invalidUUIDs = [
        'invalid-uuid',
        '12345',
        '',
        'not-a-uuid-at-all',
        '123e4567-e89b-12d3-a456-42661417400' // Missing last digit
    ];

    for (const invalidId of invalidUUIDs) {
        try {
            const response = await axios.get(`${BASE_URL}/specifications/models/${invalidId}`, { headers });
            console.log(`❌ Invalid UUID "${invalidId}": Should have failed but got:`, response.data);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log(`✅ Invalid UUID "${invalidId}": Correctly rejected (400)`);
            } else {
                console.log(`⚠️  Invalid UUID "${invalidId}": Unexpected error (${error.response?.status})`);
            }
        }
    }

    // Test invalid specification IDs for delete
    const invalidSpecIds = [-1, 0, 'abc', '12.5', ''];
    
    for (const invalidId of invalidSpecIds) {
        try {
            const response = await axios.delete(`${BASE_URL}/specifications/${invalidId}`, { headers });
            console.log(`❌ Invalid spec ID "${invalidId}": Should have failed but got:`, response.data);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log(`✅ Invalid spec ID "${invalidId}": Correctly rejected (400)`);
            } else {
                console.log(`⚠️  Invalid spec ID "${invalidId}": Unexpected error (${error.response?.status})`);
            }
        }
    }

    console.log('\n4️⃣  Testing authentication errors');
    console.log('---------------------------------');

    // Test without authorization header
    try {
        const response = await axios.get(`${BASE_URL}/specifications/fields/templates`);
        console.log('❌ No auth: Should have failed but got:', response.data);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ No auth: Correctly rejected (401)');
        } else {
            console.log(`⚠️  No auth: Unexpected status (${error.response?.status})`);
        }
    }

    // Test with invalid token
    try {
        const response = await axios.get(`${BASE_URL}/specifications/fields/templates`, {
            headers: { 'Authorization': 'Bearer invalid-token' }
        });
        console.log('❌ Invalid token: Should have failed but got:', response.data);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Invalid token: Correctly rejected (401)');
        } else {
            console.log(`⚠️  Invalid token: Unexpected status (${error.response?.status})`);
        }
    }

    console.log('\n5️⃣  Testing edge cases');
    console.log('----------------------');

    // Test very long search queries
    const longSearch = 'a'.repeat(1000);
    try {
        const response = await axios.get(`${BASE_URL}/specifications/fields/templates?search=${longSearch}`, { headers });
        console.log(`✅ Long search query: Handled gracefully (${response.data.data?.length || 0} results)`);
    } catch (error) {
        console.log(`⚠️  Long search query failed: ${error.response?.status}`);
    }

    // Test special characters in search
    const specialChars = ['<script>', '"; DROP TABLE;', '\'\'', '&&', '||'];
    for (const chars of specialChars) {
        try {
            const response = await axios.get(`${BASE_URL}/specifications/fields/templates?search=${encodeURIComponent(chars)}`, { headers });
            console.log(`✅ Special chars "${chars}": Handled safely (${response.data.data?.length || 0} results)`);
        } catch (error) {
            console.log(`⚠️  Special chars "${chars}" failed: ${error.response?.status}`);
        }
    }

    console.log('\n🛡️  Validation tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Test invalid field template data ✓');
    console.log('- Test invalid model specification data ✓');
    console.log('- Test invalid UUIDs and IDs ✓');
    console.log('- Test authentication errors ✓');
    console.log('- Test edge cases with special characters ✓');
}

// Run validation tests
validationTests().catch(console.error);