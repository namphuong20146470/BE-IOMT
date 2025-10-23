import axios from 'axios';

// Performance and stress test for specification endpoints
const BASE_URL = 'http://localhost:3030';

async function performanceTest() {
    console.log('⚡ SPECIFICATION API PERFORMANCE TEST');
    console.log('====================================');
    
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

    // Test 1: Single request latency
    console.log('\n📏 Testing single request latency...');
    const singleStart = Date.now();
    await axios.get(`${BASE_URL}/specifications/fields/templates`, { headers });
    const singleEnd = Date.now();
    console.log(`✅ Single request: ${singleEnd - singleStart}ms`);

    // Test 2: Concurrent requests
    console.log('\n🚀 Testing 10 concurrent requests...');
    const concurrentStart = Date.now();
    const promises = Array(10).fill().map(() => 
        axios.get(`${BASE_URL}/specifications/fields/templates`, { headers })
    );
    
    try {
        const results = await Promise.all(promises);
        const concurrentEnd = Date.now();
        console.log(`✅ 10 concurrent requests: ${concurrentEnd - concurrentStart}ms`);
        console.log(`   Success rate: ${results.length}/10`);
    } catch (error) {
        console.log('❌ Some concurrent requests failed');
    }

    // Test 3: Bulk create performance
    console.log('\n📦 Testing bulk field creation (5 fields)...');
    const bulkStart = Date.now();
    
    const bulkFields = [
        { field_name: 'perf_test_1', field_name_vi: 'Test field 1', category: 'test', data_type: 'text' },
        { field_name: 'perf_test_2', field_name_vi: 'Test field 2', category: 'test', data_type: 'numeric' },
        { field_name: 'perf_test_3', field_name_vi: 'Test field 3', category: 'test', data_type: 'boolean' },
        { field_name: 'perf_test_4', field_name_vi: 'Test field 4', category: 'test', data_type: 'text' },
        { field_name: 'perf_test_5', field_name_vi: 'Test field 5', category: 'test', data_type: 'numeric' }
    ];

    const bulkPromises = bulkFields.map(field =>
        axios.put(`${BASE_URL}/specifications/fields/templates`, field, { headers })
    );

    try {
        await Promise.all(bulkPromises);
        const bulkEnd = Date.now();
        console.log(`✅ Bulk create 5 fields: ${bulkEnd - bulkStart}ms`);
    } catch (error) {
        console.log('❌ Bulk create failed:', error.response?.data);
    }

    // Test 4: Search performance with different queries
    console.log('\n🔍 Testing search performance...');
    const searchQueries = ['test', 'màn', 'pin', 'kích', 'độ'];
    
    for (const query of searchQueries) {
        const searchStart = Date.now();
        try {
            const response = await axios.get(`${BASE_URL}/specifications/fields/templates?search=${query}`, { headers });
            const searchEnd = Date.now();
            console.log(`   Search "${query}": ${searchEnd - searchStart}ms (${response.data.data?.length || 0} results)`);
        } catch (error) {
            console.log(`   Search "${query}": FAILED`);
        }
    }

    // Test 5: Statistics endpoint performance
    console.log('\n📊 Testing statistics performance...');
    const statsStart = Date.now();
    try {
        await axios.get(`${BASE_URL}/specifications/stats`, { headers });
        const statsEnd = Date.now();
        console.log(`✅ Statistics: ${statsEnd - statsStart}ms`);
    } catch (error) {
        console.log('❌ Statistics failed');
    }

    // Test 6: Memory usage simulation (many requests)
    console.log('\n🧠 Testing memory usage (50 requests)...');
    const memoryStart = Date.now();
    const memoryPromises = Array(50).fill().map((_, index) =>
        axios.get(`${BASE_URL}/specifications/fields/templates?search=test${index % 10}`, { headers })
    );

    try {
        const memoryResults = await Promise.all(memoryPromises);
        const memoryEnd = Date.now();
        const successCount = memoryResults.filter(r => r.status === 200).length;
        console.log(`✅ 50 requests: ${memoryEnd - memoryStart}ms (${successCount}/50 successful)`);
        console.log(`   Avg per request: ${(memoryEnd - memoryStart) / 50}ms`);
    } catch (error) {
        console.log('❌ Memory test failed');
    }

    console.log('\n🎯 Performance test completed!');
}

// Run performance test
performanceTest().catch(console.error);