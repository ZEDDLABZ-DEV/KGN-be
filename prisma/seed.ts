import { PrismaClient, LoginMethod } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'super@admin.com';
const ADMIN_PASSWORD = '12345';
/** Must stay unique in `User.phone` for this seeded account */
const ADMIN_PHONE = '+919999000001';

async function main() {
  await prisma.permission.createMany({
    data: [
      { name: 'view_users' },
      { name: 'create_users' },
      { name: 'delete_users' },
      { name: 'view_projects' },
      { name: 'create_projects' },
      { name: 'update_projects' },
      { name: 'view_teams' },
      { name: 'create_teams' },
      { name: 'create_tasks' },
      { name: 'edit_tasks' },
      { name: 'delete_tasks' },
      { name: 'view_tasks' },
      { name: 'manage_roles' },
      { name: 'view_material_requests' },
      { name: 'create_material_requests' },
      { name: 'update_material_requests' },
      { name: 'delete_material_requests' },
      { name: 'view_boqs' },
      { name: 'create_boqs' },
      { name: 'update_boqs' },
      { name: 'delete_boqs' },
      { name: 'view_project_files' },
      { name: 'create_project_files' },
      { name: 'update_project_files' },
      { name: 'delete_project_files' },
    ],
    skipDuplicates: true,
  });

  await prisma.role.createMany({
    data: [
      { name: 'user' },
      { name: 'admin' },
      { name: 'manager' },
      { name: 'team_lead' },
    ],
    skipDuplicates: true,
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'admin' },
  });

  const allPerms = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  if (allPerms.length > 0) {
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    });
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { Auth: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: 'Super Admin',
        phone: ADMIN_PHONE,
        gender: 'OTHER',
        roleId: adminRole.id,
        Auth: {
          create: {
            login: ADMIN_EMAIL,
            password: hashed,
            loginWith: LoginMethod.EMAIL,
          },
        },
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: 'Super Admin',
        roleId: adminRole.id,
        Auth: existing.Auth
          ? {
              update: {
                login: ADMIN_EMAIL,
                password: hashed,
                loginWith: LoginMethod.EMAIL,
              },
            }
          : {
              create: {
                login: ADMIN_EMAIL,
                password: hashed,
                loginWith: LoginMethod.EMAIL,
              },
            },
      },
    });
  }

  console.log(`Seed OK — admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
