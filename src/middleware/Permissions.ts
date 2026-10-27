import {  Response, NextFunction } from "express";
import { AuthRequest } from "./Auth";
import { prisma } from "@/Utils";

export const authorize =
  (requiredPermissions: string[]) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId; // Assume JWT sets this
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    const userPerms = user?.role?.permissions.map(
      (rp) => rp.permission.name
    ) || [];

    const hasAccess = requiredPermissions.every((perm) =>
      userPerms.includes(perm)
    );

    if (!hasAccess) return res.status(403).json({ message: "Insufficient Permissions" });

    next();
  };
