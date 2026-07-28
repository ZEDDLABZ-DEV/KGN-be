import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

// Find an inventory item by case-insensitive name, creating it if it doesn't exist yet.
// Called from the GRN controller (within a transaction) the first time a GRN item
// with that name is received — this is how the catalogue grows organically.
export const findOrCreateInventoryItem = async (tx: TxClient, name: string, unit?: string | null) => {
  const trimmedName = name.trim();

  const existing = await tx.inventoryItem.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  });

  if (existing) return existing;

  return tx.inventoryItem.create({
    data: { name: trimmedName, unit: unit || null },
  });
};

// Current stock for a project + item = sum(IN) - sum(OUT) over the ledger. Never a
// stored/mutable counter.
export const getCurrentStock = async (
  client: TxClient | typeof prisma,
  projectId: string,
  inventoryItemId: string
): Promise<number> => {
  const [inSum, outSum] = await Promise.all([
    client.stockMovement.aggregate({
      where: { projectId, inventoryItemId, type: 'IN' },
      _sum: { quantity: true },
    }),
    client.stockMovement.aggregate({
      where: { projectId, inventoryItemId, type: 'OUT' },
      _sum: { quantity: true },
    }),
  ]);

  return (inSum._sum.quantity || 0) - (outSum._sum.quantity || 0);
};

// GET /inventory/items — list the InventoryItem master catalogue
export const getAllInventoryItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
    });

    return success(res, 'Inventory items fetched successfully', items);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch inventory items', 500);
  }
};

// GET /inventory/stock/project/:projectId — current stock of every material for one project
export const getProjectStock = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.projects.findUnique({ where: { id: projectId as string } });
    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const movements = await prisma.stockMovement.groupBy({
      by: ['inventoryItemId', 'type'],
      where: { projectId: projectId as string },
      _sum: { quantity: true },
    });

    const totalsByItem = new Map<string, { in: number; out: number }>();
    for (const row of movements) {
      const totals = totalsByItem.get(row.inventoryItemId) || { in: 0, out: 0 };
      if (row.type === 'IN') totals.in += row._sum.quantity || 0;
      else totals.out += row._sum.quantity || 0;
      totalsByItem.set(row.inventoryItemId, totals);
    }

    const itemIds = [...totalsByItem.keys()];
    const items = await prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const stock = itemIds
      .map((itemId) => {
        const totals = totalsByItem.get(itemId)!;
        const item = itemsById.get(itemId);
        return {
          inventoryItemId: itemId,
          name: item?.name,
          unit: item?.unit,
          currentStock: totals.in - totals.out,
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return success(res, 'Project stock fetched successfully', {
      project: { id: project.id, name: project.name, projectId: project.projectId },
      stock,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch project stock', 500);
  }
};

// GET /inventory/stock/material/:inventoryItemId — current stock for one item, by project
export const getMaterialStock = async (req: AuthRequest, res: Response) => {
  try {
    const { inventoryItemId } = req.params;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId as string },
    });

    if (!inventoryItem) {
      return error(res, 'Inventory item not found', 404);
    }

    const movements = await prisma.stockMovement.groupBy({
      by: ['projectId', 'type'],
      where: { inventoryItemId: inventoryItemId as string },
      _sum: { quantity: true },
    });

    const totalsByProject = new Map<string, { in: number; out: number }>();
    for (const row of movements) {
      const totals = totalsByProject.get(row.projectId) || { in: 0, out: 0 };
      if (row.type === 'IN') totals.in += row._sum.quantity || 0;
      else totals.out += row._sum.quantity || 0;
      totalsByProject.set(row.projectId, totals);
    }

    const projectIds = [...totalsByProject.keys()];
    const projects = await prisma.projects.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, projectId: true },
    });
    const projectsById = new Map(projects.map((p) => [p.id, p]));

    const stock = projectIds
      .map((projectId) => {
        const totals = totalsByProject.get(projectId)!;
        const project = projectsById.get(projectId);
        return {
          projectId,
          projectName: project?.name,
          currentStock: totals.in - totals.out,
        };
      })
      .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));

    return success(res, 'Material stock fetched successfully', {
      inventoryItem: { id: inventoryItem.id, name: inventoryItem.name, unit: inventoryItem.unit },
      stock,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch material stock', 500);
  }
};

// GET /inventory/movements — raw ledger / audit trail, filterable by projectId, inventoryItemId, type
export const getMovements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, inventoryItemId, type } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (inventoryItemId) where.inventoryItemId = inventoryItemId as string;
    if (type) where.type = type as string;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
        project: { select: { id: true, name: true, projectId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'Stock movements fetched successfully', movements);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch stock movements', 500);
  }
};

// POST /inventory/issue — records material usage on a project (stock OUT). Never
// lets stock go negative and never transfers across projects.
export const issueStock = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, inventoryItemId, quantity, notes } = req.body;

    if (!projectId || !inventoryItemId) {
      return error(res, 'projectId and inventoryItemId are required', 400);
    }

    const parsedQuantity = parseFloat(quantity);
    if (!(parsedQuantity > 0)) {
      return error(res, 'quantity must be greater than 0', 400);
    }

    const project = await prisma.projects.findUnique({ where: { id: projectId } });
    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const inventoryItem = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!inventoryItem) {
      return error(res, 'Inventory item not found', 404);
    }

    const currentStock = await getCurrentStock(prisma, projectId, inventoryItemId);
    if (parsedQuantity > currentStock) {
      return error(
        res,
        `Cannot issue more than available stock. Available: ${currentStock} ${inventoryItem.unit || ''}`.trim(),
        400
      );
    }

    const movement = await prisma.stockMovement.create({
      data: {
        projectId,
        inventoryItemId,
        type: 'OUT',
        quantity: parsedQuantity,
        unit: inventoryItem.unit,
        referenceType: 'MATERIAL_ISSUE',
        notes,
        createdById: req.userId,
      },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
        project: { select: { id: true, name: true, projectId: true } },
      },
    });

    return created(res, 'Stock issued successfully', movement);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to issue stock', 500);
  }
};
