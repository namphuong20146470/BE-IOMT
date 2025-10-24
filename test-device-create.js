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
    console.log('✅ Found active organization:', orgs[0].name, '(' + orgId + ')');

    // First authenticate
    const authResponse = await axios.post('http://localhost:3030/auth/login', {
      username: 'superadmin',
      password: 'SuperAdmin@2025'
    });
    
    const token = authResponse.data.data.tokens.access_token;
    console.log('✅ Authentication successful');
    
    // Get device models
    const modelsResponse = await axios.get('http://localhost:3030/devices/device-models', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (modelsResponse.data.data && modelsResponse.data.data.length > 0) {
      const modelId = modelsResponse.data.data[0].id;
      console.log('✅ Found model:', modelId);
      
      // Test create device
      const deviceData = {
        model_id: modelId,
        serial_number: 'TEST-' + Date.now(),
        organization_id: orgId
      };
      
      const deviceResponse = await axios.post('http://localhost:3030/devices/devices', deviceData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Device created successfully:', deviceResponse.data.data.id);
    } else {
      console.log('❌ No device models found');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
})();