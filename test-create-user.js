const axios = require('axios');

async function testCreateUser() {
    try {
        const response = await axios.post('http://localhost:3000/actlog/users', {
            username: 'testuser001',
            password: 'Test123!',
            full_name: 'Test User 001',
            email: 'testuser001@example.com',
            phone: '+84123456789',
            organization_id: '550e8400-e29b-41d4-a716-446655440000', // Example UUID
            // role_id: '550e8400-e29b-41d4-a716-446655440001' // Example role UUID
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your-test-token' // Replace with valid token
            }
        });

        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testCreateUser();