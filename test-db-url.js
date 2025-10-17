import dotenv from 'dotenv';
import prisma from './config/db.js';

dotenv.config();

// Test database URL detection
const getDatabaseUrl = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'production') {
    return process.env.PROD_DATABASE_URL;
  } else {
    return process.env.DEV_DATABASE_URL;
  }
};

console.log('=== DATABASE URL TEST ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Expected URL:', getDatabaseUrl());
console.log('DEV_DATABASE_URL:', process.env.DEV_DATABASE_URL);
console.log('PROD_DATABASE_URL:', process.env.PROD_DATABASE_URL);
console.log('DATABASE_URL (from .env):', process.env.DATABASE_URL);

// Test prisma connection
try {
  await prisma.$connect();
  console.log('✅ Prisma connected successfully');
  
  // Get database info
  const result = await prisma.$queryRaw`SELECT current_database() as db_name, current_user as db_user`;
  console.log('📊 Connected to database:', result[0]);
  
} catch (error) {
  console.error('❌ Prisma connection failed:', error.message);
} finally {
  await prisma.$disconnect();
}