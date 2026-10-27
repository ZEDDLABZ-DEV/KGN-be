import { LoginMethod, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

/**
 * Creates one admin user from environment variables.
 * Also ensures the admin role and the permissions the API checks for exist.
 * Safe to run more than once: an existing user is left unchanged.
 */

const BCRYPT_ROUNDS = 10;

const REQUIRED_PERMISSIONS = [
  'create_projects',
  'view_projects',
  'update_projects',
  'create_material_requests',
  'view_material_requests',
  'update_material_requests',
  'delete_material_requests',
  'mark_attendance',
  'view_attendance',
  'create_purchase_orders',
  'update_purchase_orders',
  'delete_purchase_orders',
  'create_grn',
  'update_grn',
  'delete_grn',
  'view_inventory',
  'issue_inventory',
  'create_units',
  'update_units',
  'delete_units',
  'manage_vendors',
] as const;

const WEAK_PASSWORDS = new Set([
  '12345',
  '123456',
  '12345678',
  'password',
  'password123',
  'admin',
  'admin123',
  'qwerty',
  'letmein',
]);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function assertStrongPassword(password: string, email: string): void {
  const problems: string[] = [];
  if (password.length < 12) problems.push('be at least 12 characters');
  if (!/[A-Za-z]/.test(password)) problems.push('include a letter');
  if (!/[0-9]/.test(password)) problems.push('include a number');
  if (
    password.toLowerCase() === email.toLowerCase() ||
    WEAK_PASSWORDS.has(password.toLowerCase())
  ) {
    problems.push('not be a common or default password');
  }
  if (problems.length > 0) {
    fail(`ADMIN_PASSWORD is too weak. It must ${problems.join(', ')}.`);
  }
}

async function ensureAdminRole(prisma: PrismaClient) {
  const role = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  await prisma.permission.createMany({
    data: REQUIRED_PERMISSIONS.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();
  const existingLinks = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permissionId: true },
  });
  const linked = new Set(existingLinks.map((row) => row.permissionId));
  const missing = permissions.filter((permission) => !linked.has(permission.id));

  if (missing.length > 0) {
    await prisma.rolePermission.createMany({
      data: missing.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });
  }

  return role;
}

async function main() {
  const email = readRequired('ADMIN_EMAIL');
  const password = readRequired('ADMIN_PASSWORD');
  const name = readRequired('ADMIN_NAME');
  const phone = readRequired('ADMIN_PHONE');
  const gender = process.env.ADMIN_GENDER?.trim() || 'OTHER';

  if (!email.includes('@')) {
    fail('ADMIN_EMAIL must be an email address.');
  }
  assertStrongPassword(password, email);

  const prisma = new PrismaClient();
  try {
    const adminRole = await ensureAdminRole(prisma);

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { role: true, Auth: true },
    });

    if (existing) {
      if (existing.role?.name === 'admin') {
        console.log(`Admin user already exists for ${email}. No duplicate was created.`);
        return;
      }
      throw new Error(
        `A user already exists for ${email} with role "${existing.role?.name ?? 'none'}". No changes were made.`
      );
    }

    const phoneOwner = await prisma.user.findUnique({ where: { phone } });
    if (phoneOwner) {
      throw new Error('ADMIN_PHONE is already used by another user. No user was created.');
    }

    const loginOwner = await prisma.auth.findUnique({ where: { login: email } });
    if (loginOwner) {
      throw new Error('An auth login already exists for this email. No user was created.');
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.user.create({
      data: {
        email,
        name,
        phone,
        gender,
        roleId: adminRole.id,
        Auth: {
          create: {
            login: email,
            password: hashed,
            loginWith: LoginMethod.EMAIL,
          },
        },
      },
    });

    console.log(`Admin user created for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Admin creation failed';
  console.error(message);
  process.exit(1);
});
