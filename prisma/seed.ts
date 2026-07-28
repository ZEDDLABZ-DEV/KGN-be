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
      { name: 'mark_attendance' },
      { name: 'view_attendance' },
      { name: 'create_purchase_orders' },
      { name: 'update_purchase_orders' },
      { name: 'delete_purchase_orders' },
      { name: 'create_grn' },
      { name: 'update_grn' },
      { name: 'delete_grn' },
      { name: 'view_inventory' },
      { name: 'issue_inventory' },
      { name: 'create_units' },
      { name: 'update_units' },
      { name: 'delete_units' },
      { name: 'manage_vendors' },
    ],
    skipDuplicates: true,
  });

  await prisma.role.createMany({
    data: [
      { name: 'user' },
      { name: 'admin' },
      { name: 'manager' },
      { name: 'team_lead' },
      { name: 'accountant' },
      { name: 'supervisor' },
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

  // GRN mutations and inventory reads are allowed for admin OR accountant;
  // inventory reads/issue are allowed for admin OR supervisor. Admin already
  // has every permission above, so only wire up the non-admin roles here.
  const grantPermissionsToRole = async (roleName: string, permissionNames: string[]) => {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return;

    const perms = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { in: perms.map((p) => p.id) } },
    });
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  };

  await grantPermissionsToRole('accountant', [
    'create_grn',
    'update_grn',
    'delete_grn',
    'view_inventory',
  ]);

  await grantPermissionsToRole('supervisor', ['view_inventory', 'issue_inventory']);

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
