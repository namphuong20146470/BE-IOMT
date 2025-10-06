// scripts/setup-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';

const prisma = new PrismaClient();

async function setupAdmin() {
  // Tạo mật khẩu ngẫu nhiên mạnh
  const password = crypto.randomBytes(16).toString('base64');
  const username = `admin_${crypto.randomBytes(4).toString('hex')}`;
  
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.users.create({
    data: {
      username,
      full_name: 'Super Administrator',
      email: 'admin@hoangphucthanh.com',
      password_hash: hashedPassword,
      phone: '0901234500',
      is_active: true,
      organization_id: null,
      department_id: null,
    }
  });

  // Assign role...
  const role = await prisma.roles.findFirst({
    where: { name: 'Super Admin' }
  });

  await prisma.user_roles.create({
    data: {
      user_id: admin.id,
      role_id: role!.id,
      organization_id: null,
      department_id: null,
      assigned_by: admin.id,
      is_active: true,
      notes: 'Initial Super Admin'
    }
  });

  // Lưu thông tin vào file an toàn
  const credentials = `
╔════════════════════════════════════════════╗
║   🔐 SUPER ADMIN CREDENTIALS               ║
╠════════════════════════════════════════════╣
║ Username: ${username.padEnd(30)} ║
║ Password: ${password.padEnd(30)} ║
║ Email:    ${admin.email.padEnd(30)} ║
╠════════════════════════════════════════════╣
║ ⚠️  SAVE THIS INFORMATION SECURELY         ║
║ ⚠️  DELETE THIS FILE AFTER SAVING          ║
╚════════════════════════════════════════════╝
`;

  fs.writeFileSync('ADMIN_CREDENTIALS.txt', credentials, { mode: 0o600 });

  console.log(credentials);
  console.log('\n✅ Credentials saved to ADMIN_CREDENTIALS.txt');
  console.log('⚠️  Please save this information in a password manager and DELETE the file!');
}

setupAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());