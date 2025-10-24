import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

(async () => {
  try {
    // Get active organization from database
    const orgs = await prisma.organizations.findMany({
      where: { is_active: true },
      select: { id: true, name: true }
    });
    
    if (orgs.length === 0) {
      console.log('❌ No active organizations found');
      return;
    }
    
    const orgId = orgs[0].id;
    console.log('✅ Using organization:', orgs[0].name);

    // Authenticate
    console.log('🔐 Authenticating...');
    const authResponse = await axios.post('http://localhost:3030/auth/login', {
      username: 'superadmin',
      password: 'SuperAdmin@2025'
    });
    
    const token = authResponse.data.data.tokens.access_token;
    console.log('✅ Authentication successful');

    // Test 1: Validate available asset tag
    console.log('\n📋 Test 1: Validate available asset tag');
    const availableAssetTag = 'ASSET-TEST-' + Date.now();
    
    const validateResponse1 = await axios.get('http://localhost:3030/devices/devices/validate/asset-tag', {
      params: {
        asset_tag: availableAssetTag,
        organization_id: orgId
      },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Available asset tag result:', {
      asset_tag: validateResponse1.data.data.asset_tag,
      is_available: validateResponse1.data.data.is_available,
      message: validateResponse1.data.message
    });

    // Test 2: Create device with asset tag
    console.log('\n📋 Test 2: Create device with asset tag');
    const modelsResponse = await axios.get('http://localhost:3030/devices/device-models', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (modelsResponse.data.data && modelsResponse.data.data.length > 0) {
      const modelId = modelsResponse.data.data[0].id;
      
      const deviceData = {
        model_id: modelId,
        serial_number: 'SN-TEST-' + Date.now(),
        asset_tag: availableAssetTag,
        organization_id: orgId
      };
      
      const deviceResponse = await axios.post('http://localhost:3030/devices/devices', deviceData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Device created with asset tag:', deviceResponse.data.data.asset_tag);

      // Test 3: Validate duplicate asset tag
      console.log('\n📋 Test 3: Validate duplicate asset tag');
      
      const validateResponse2 = await axios.get('http://localhost:3030/devices/devices/validate/asset-tag', {
        params: {
          asset_tag: availableAssetTag,
          organization_id: orgId
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Duplicate asset tag result:', {
        asset_tag: validateResponse2.data.data.asset_tag,
        is_available: validateResponse2.data.data.is_available,
        conflict: validateResponse2.data.data.conflict,
        message: validateResponse2.data.message
      });

      // Test 4: Validate asset tag for update (exclude current device)
      console.log('\n📋 Test 4: Validate asset tag for update (exclude current device)');
      
      const validateResponse3 = await axios.get('http://localhost:3030/devices/devices/validate/asset-tag', {
        params: {
          asset_tag: availableAssetTag,
          organization_id: orgId,
          device_id: deviceResponse.data.data.id
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Update validation result:', {
        asset_tag: validateResponse3.data.data.asset_tag,
        is_available: validateResponse3.data.data.is_available,
        message: validateResponse3.data.message
      });
    }

    // Test 5: Validate with invalid parameters
    console.log('\n📋 Test 5: Validate error handling');
    
    try {
      await axios.get('http://localhost:3030/devices/devices/validate/asset-tag', {
        params: {
          asset_tag: 'TEST-ASSET',
          organization_id: 'invalid-uuid'
        },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.log('✅ Invalid UUID error caught:', error.response.data.message);
    }

    try {
      await axios.get('http://localhost:3030/devices/devices/validate/asset-tag', {
        params: {
          organization_id: orgId
          // missing asset_tag
        },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.log('✅ Missing asset_tag error caught:', error.response.data.message);
    }

    console.log('\n🎉 All asset tag validation tests completed!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
})();