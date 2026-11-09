/**
 * Idempotent seed: roles, blood groups, leave types, a default shift, and
 * (optionally) the first ADMIN login in Supabase Auth.
 *
 *   SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='Str0ngPassw0rd' npm run prisma:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL) as string }),
});

const ROLES = [
  { name: 'ADMIN', description: 'Full access' },
  { name: 'HR', description: 'Manage employees, leave, attendance' },
  { name: 'MANAGER', description: 'View team, approve team leave' },
  { name: 'EMPLOYEE', description: 'Self service' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LEAVE_TYPES = [
  { code: 'CL', name: 'Casual Leave', maxDaysYear: 12, isPaid: true },
  { code: 'SL', name: 'Sick Leave', maxDaysYear: 12, isPaid: true },
  { code: 'PL', name: 'Privilege Leave', maxDaysYear: 15, isPaid: true },
  { code: 'LOP', name: 'Loss Of Pay', maxDaysYear: 0, isPaid: false },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('• SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set – skipping admin login');
    return;
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('• Supabase env missing – skipping admin login');
    return;
  }
  const admin = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  if (await prisma.userAccount.findUnique({ where: { email } })) {
    console.log(`• Admin ${email} already exists`);
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Supabase createUser failed: ${error?.message}`);
  await prisma.userAccount.create({ data: { id: data.user.id, email, roleId: admin.id } });
  console.log(`• Admin login created: ${email}`);
}

async function main() {
  for (const r of ROLES) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: { ...r, isSystem: true } });
  }
  for (const name of BLOOD_GROUPS) {
    await prisma.bloodGroup.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const lt of LEAVE_TYPES) {
    await prisma.leaveType.upsert({ where: { code: lt.code }, update: {}, create: lt });
  }
  await prisma.workShift.upsert({
    where: { name: 'General Shift' },
    update: {},
    create: { name: 'General Shift', startTime: '09:00', endTime: '18:00', durationMin: 540, graceMin: 10 },
  });
  console.log('• Roles, blood groups, leave types and default shift seeded');
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
