// Chỉ sử dụng Prisma cho production server
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Sử dụng DATABASE_URL trực tiếp từ environment
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Test database connection
async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    console.log('🔍 Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'));
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();

export default prisma;