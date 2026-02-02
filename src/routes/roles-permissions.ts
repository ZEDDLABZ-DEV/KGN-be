import { Router } from "express";
import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  createPermission,
  getAllPermissions,
  assignPermissionsToRole,
  removePermissionFromRole,
  assignRoleToUser,
} from "@/controllers/roles-permissions";

const rolePermissionRouter: any = Router();

// Role routes
rolePermissionRouter.post("/roles", createRole);
rolePermissionRouter.get("/roles", getAllRoles);
rolePermissionRouter.get("/roles/:id", getRoleById);
rolePermissionRouter.put("/roles/:id", updateRole);
rolePermissionRouter.delete("/roles/:id", deleteRole);

// Permission routes
rolePermissionRouter.post("/permissions", createPermission);
rolePermissionRouter.get("/permissions", getAllPermissions);

// Role-Permission assignment routes
rolePermissionRouter.post("/roles/assign-permissions", assignPermissionsToRole);
rolePermissionRouter.delete("/roles/remove-permission", removePermissionFromRole);

// User-Role assignment route
rolePermissionRouter.post("/users/assign-role", assignRoleToUser);

export { rolePermissionRouter };