import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const permissions = await prisma.permission.createMany({
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
      { name: 'view_tasks' },
      { name: 'manage_roles' },
      { name: 'view_material_requests' },
      { name: 'create_material_requests' },
      { name: 'update_material_requests' },
      { name: 'delete_material_requests' },
      { name: 'view_boqs' },
      { name: 'create_boqs' },
      { name: 'view_boqs' },
      { name: 'update_boqs' },
      { name: 'delete_boqs' },
      { name: 'view_project_files' },
      { name: 'create_project_files' },
      { name: 'update_project_files' },
      { name: 'delete_project_files' },
    ],
    skipDuplicates: true,
  });

  const adminRole = await prisma.role.create({
    data: { name: 'admin' },
  });

  const allPerms = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPerms.map(p => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  await prisma.role.createMany({
    data: [{ name: 'user' }, { name: 'admin' }, { name: 'manager' }, { name: 'team_lead' }],
    skipDuplicates: true,
  });
}

main().finally(() => prisma.$disconnect());
