// Chỉ sử dụng Prisma, không cần kết nối trực tiếp database
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Determine database URL based on environment
const getDatabaseUrl = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'production') {
    return process.env.PROD_DATABASE_URL;
  } else {
    return process.env.DEV_DATABASE_URL;
  }
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});

export default prisma;