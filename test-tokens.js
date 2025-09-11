// Token Verification Test
// Run with: node test-tokens.js

const BASE_URL = 'http://localhost:3005/actlog';

// Your tokens
const TOKENS = {
    user_v1: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTYsInJvbGUiOiJTVVBQTElFUl9HUCIsImlhdCI6MTc1NzU1NjMyOCwiZXhwIjoxNzU3NjQyNzI4fQ.-vP0Xgpaje51ilVzPpW9FBgPKzPJfSxdSzXgFaPKUf8',
    user_v2: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc3Yzk5MTk2LTE2N2UtNDA4ZC05YjkzLWJlMTg2MGM4NTMzZiIsInVzZXJuYW1lIjoiYWRtaW5fYnZka3RwIiwiZW1haWwiOiJhZG1pbkBidmRha2hvYXRwLnZuIiwib3JnYW5pemF0aW9uX2lkIjoiN2U5ODNhNzMtYzJiMi00NzVkLWExZGQtODViNzIyYWI0NTgxIiwiZGVwYXJ0bWVudF9pZCI6bnVsbCwiaWF0IjoxNzU3NTU2MTkyLCJleHAiOjE3NTc2NDI1OTJ9.ejCmR9Q37PDsa0iLolVUdfstQrbIaiVjAWLkEq1Mozs'
};

async function testToken(tokenName, token) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING ${tokenName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    // Test 1: Decode token
    console.log('\n1️⃣  Decoding token...');
    try {
        const decodeResponse = await fetch(`${BASE_URL}/auth/decode`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const decodeData = await decodeResponse.json();
        if (decodeResponse.ok) {
            console.log('✅ Token decoded successfully');
            console.log('   Type:', decodeData.token_type);
            console.log('   User ID:', decodeData.decoded.id);
            console.log('   Username:', decodeData.decoded.username || 'N/A');
            console.log('   Expires:', decodeData.expires_at);
            console.log('   Issued:', decodeData.issued_at);
        } else {
            console.log('❌ Token decode failed:', decodeData.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Network error during decode:', error.message);
        return false;
    }

    // Test 2: Verify token with middleware
    console.log('\n2️⃣  Testing token with auth middleware...');
    try {
        const testResponse = await fetch(`${BASE_URL}/auth/test`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const testData = await testResponse.json();
        if (testResponse.ok) {
            console.log('✅ Token verification successful');
            console.log('   User:', testData.user.username || testData.user.full_name);
            console.log('   Table:', testData.user.table);
            console.log('   Role:', testData.user.role);
            console.log('   Active:', testData.user.is_active);
            if (testData.user.organization_name) {
                console.log('   Organization:', testData.user.organization_name);
            }
            return true;
        } else {
            console.log('❌ Token verification failed:', testData.message);
            console.log('   Status:', testResponse.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Network error during verification:', error.message);
        return false;
    }
}

async function testCreateDevice(token) {
    console.log('\n3️⃣  Testing device creation with authenticated token...');
    
    // Test creating a device category
    const categoryData = {
        name: "Test Category - " + Date.now(),
        description: "Test category created with token authentication"
    };
    
    try {
        const response = await fetch(`${BASE_URL}/devices/device-categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(categoryData)
        });
        
        const result = await response.json();
        if (response.ok) {
            console.log('✅ Device category creation successful');
            console.log('   Category ID:', result.data.id);
            console.log('   Name:', result.data.name);
            return result.data.id;
        } else {
            console.log('❌ Device category creation failed:', result.message);
            console.log('   Status:', response.status);
            return null;
        }
    } catch (error) {
        console.log('❌ Network error during device creation:', error.message);
        return null;
    }
}

async function runTokenTests() {
    console.log('🔐 Starting Token Verification Tests...\n');
    
    const results = {};
    
    // Test both tokens
    for (const [tokenName, token] of Object.entries(TOKENS)) {
        const isValid = await testToken(tokenName, token);
        results[tokenName] = isValid;
        
        // If token is valid, test creating a device
        if (isValid) {
            await testCreateDevice(token);
        }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('TEST SUMMARY');
    console.log(`${'='.repeat(60)}`);
    
    Object.entries(results).forEach(([tokenName, isValid]) => {
        const status = isValid ? '✅ VALID' : '❌ INVALID';
        console.log(`${tokenName.toUpperCase()}: ${status}`);
    });
    
    const validTokens = Object.values(results).filter(Boolean).length;
    console.log(`\nTotal valid tokens: ${validTokens}/${Object.keys(TOKENS).length}`);
    
    if (validTokens > 0) {
        console.log('\n🎉 You can now use the valid tokens for API testing!');
        
        // Show usage examples
        console.log('\n📝 Usage Examples:');
        if (results.user_v2) {
            console.log('curl -H "Authorization: Bearer ' + TOKENS.user_v2.substring(0, 50) + '..." \\');
            console.log('     -X GET http://localhost:3005/actlog/devices/statistics');
        }
    } else {
        console.log('\n⚠️  No valid tokens found. Please check:');
        console.log('   - Server is running');
        console.log('   - Database connection');
        console.log('   - Token expiration');
        console.log('   - User status in database');
    }
}

// Run the tests
runTokenTests().catch(console.error);
