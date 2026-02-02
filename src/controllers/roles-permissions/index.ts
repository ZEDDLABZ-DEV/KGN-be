import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';

// Create a new role
export const createRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return error(res, 'Role already exists', 400);
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
      },
    });

    return created(res, 'Role created successfully', role);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to create role', 400);
  }
};

// Get all roles
export const getAllRoles = async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Roles fetched successfully', roles);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to fetch roles', 400);
  }
};

// Get role by ID
export const getRoleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!role) {
      return error(res, 'Role not found', 404);
    }

    return success(res, 'Role fetched successfully', role);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to fetch role', 400);
  }
};

// Update role
export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    return success(res, 'Role updated successfully', role);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to update role', 400);
  }
};

// Delete role
export const deleteRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if role is assigned to any user
    const roleAssignedToUser = await prisma.user.findFirst({
      where: { roleId: id },
    });
    if (roleAssignedToUser) return error(res, 'Role is assigned to a user', 400);
    
    // Check if role is assigned to any permission
    const roleAssignedToPermission = await prisma.rolePermission.findFirst({
      where: { roleId: id },
    });
    if (roleAssignedToPermission) return error(res, 'Role is assigned to a permission', 400);

    await prisma.role.delete({
      where: { id },
    });

    return success(res, 'Role deleted successfully');
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to delete role', 400);
  }
};

// Create a new permission
export const createPermission = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    const existingPermission = await prisma.permission.findUnique({
      where: { name },
    });

    if (existingPermission) {
      return error(res, 'Permission already exists', 400);
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        description,
      },
    });

    return created(res, 'Permission created successfully', permission);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to create permission', 400);
  }
};

// Get all permissions
export const getAllPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Permissions fetched successfully', permissions);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to fetch permissions', 400);
  }
};

// Assign permissions to role
export const assignPermissionsToRole = async (req: AuthRequest, res: Response) => {
  try {
    const { roleId, permissionIds } = req.body;

    // Delete existing permissions for the role
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Create new role-permission associations
    const rolePermissions = await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId: string) => ({
        roleId,
        permissionId,
      })),
    });

    return success(res, 'Permissions assigned to role successfully', rolePermissions);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to assign permissions to role', 400);
  }
};

// Remove permission from role
export const removePermissionFromRole = async (req: AuthRequest, res: Response) => {
  try {
    const { roleId, permissionId } = req.body;

    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });

    return success(res, 'Permission removed from role successfully');
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to remove permission from role', 400);
  }
};

// Assign role to user
export const assignRoleToUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, roleId } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        roleId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return success(res, 'Role assigned to user successfully', user);
  } catch (err: any) {
    console.log(err);
    return error(res, 'Failed to assign role to user', 400);
  }
};
