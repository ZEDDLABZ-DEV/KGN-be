import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';
import { Prisma } from '@prisma/client';
import { findOrCreateInventoryItem } from '@/controllers/inventory';

type TxClient = Prisma.TransactionClient;

// Generate unique GRN number: GRN-{YY}{MM}-{sequence}, sequence resets every calendar month
const generateGRNNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  const count = await prisma.gRN.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `GRN-${year}${month}-${sequence}`;
};

const grnDetailInclude = {
  items: { include: { purchaseOrderItem: true } },
  purchaseOrder: {
    include: {
      materialRequest: {
        include: {
          project: {
            select: { id: true, name: true, projectId: true, location: true },
          },
        },
      },
    },
  },
} as const;

// Reverse (delete) all stock movements this GRN generated.
const reverseGRNStockMovements = (tx: TxClient, grnId: string) =>
  tx.stockMovement.deleteMany({ where: { referenceType: 'GRN', referenceId: grnId } });

// Record stock-IN movements for the "good" received quantity of each GRN item.
// Damaged quantity is tracked on the GRNItem but never contributes to stock.
const recordGRNStockMovements = async (
  tx: TxClient,
  grnId: string,
  projectId: string,
  createdById: string | undefined,
  grnItems: { purchaseOrderItemId: string; receivedQuantity: number; itemName: string; unit: string }[]
) => {
  for (const item of grnItems) {
    if (item.receivedQuantity <= 0) continue;

    const inventoryItem = await findOrCreateInventoryItem(tx, item.itemName, item.unit);

    await tx.stockMovement.create({
      data: {
        projectId,
        inventoryItemId: inventoryItem.id,
        type: 'IN',
        quantity: item.receivedQuantity,
        referenceType: 'GRN',
        referenceId: grnId,
        unit: item.unit,
        createdById,
      },
    });
  }
};

// Recompute a PO's status from its remaining non-rejected GRNs:
// RECEIVED if every item is fully covered, PARTIALLY_RECEIVED if some coverage
// exists, otherwise back down to SENT.
const recomputePurchaseOrderStatus = async (tx: TxClient, purchaseOrderId: string) => {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      items: true,
      grns: { where: { status: { not: 'REJECTED' } }, include: { items: true } },
    },
  });

  if (!po || po.status === 'CANCELLED') return;

  if (po.grns.length === 0) {
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: 'SENT' } });
    return;
  }

  let anyReceived = false;
  let allFullyReceived = true;

  for (const poItem of po.items) {
    const totalReceived = po.grns.reduce((sum, grn) => {
      const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
      return sum + (grnItem?.receivedQuantity || 0);
    }, 0);

    if (totalReceived > 0) anyReceived = true;
    if (totalReceived < poItem.quantity) allFullyReceived = false;
  }

  const newStatus = allFullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'SENT';
  await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: newStatus } });
};

// Create GRN from Purchase Order
export const createGRN = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseOrderId, receivedBy, receivedDate, remarks, items } = req.body;

    if (!purchaseOrderId || !receivedBy) {
      return error(res, 'Purchase order ID and received by are required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'At least one item is required', 400);
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
        materialRequest: { include: { project: true } },
      },
    });

    if (!purchaseOrder) {
      return error(res, 'Purchase order not found', 404);
    }

    if (!['SENT', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status)) {
      return error(res, 'Purchase order must be SENT, APPROVED, or PARTIALLY_RECEIVED to create a GRN', 400);
    }

    const grnItemsData: {
      purchaseOrderItemId: string;
      orderedQuantity: number;
      receivedQuantity: number;
      damagedQuantity: number;
      pendingQuantity: number;
      remarks?: string;
      itemName: string;
      unit: string;
    }[] = [];

    for (const item of items) {
      const poItem = purchaseOrder.items.find((i) => i.id === item.purchaseOrderItemId);

      if (!poItem) {
        return error(res, `Purchase order item ${item.purchaseOrderItemId} not found`, 400);
      }

      const previousGRNItems = await prisma.gRNItem.findMany({
        where: {
          purchaseOrderItemId: item.purchaseOrderItemId,
          grn: { status: { not: 'REJECTED' } },
        },
      });

      const totalPreviousReceived = previousGRNItems.reduce((sum, g) => sum + g.receivedQuantity, 0);

      const receivedQuantity = parseFloat(item.receivedQuantity) || 0;
      const damagedQuantity = parseFloat(item.damagedQuantity) || 0;
      const orderedQuantity = poItem.quantity;
      const pendingQuantity = orderedQuantity - (totalPreviousReceived + receivedQuantity);

      if (pendingQuantity < 0) {
        return error(
          res,
          `Cannot receive more than ordered quantity for item ${poItem.itemName}. Ordered: ${orderedQuantity}, Already received: ${totalPreviousReceived}, Current: ${receivedQuantity}`,
          400
        );
      }

      grnItemsData.push({
        purchaseOrderItemId: item.purchaseOrderItemId,
        orderedQuantity,
        receivedQuantity,
        damagedQuantity,
        pendingQuantity,
        remarks: item.remarks,
        itemName: poItem.itemName,
        unit: poItem.unit,
      });
    }

    const grnNumber = await generateGRNNumber();
    const projectId = purchaseOrder.materialRequest.projectId;

    const grn = await prisma.$transaction(async (tx) => {
      const createdGRN = await tx.gRN.create({
        data: {
          grnNumber,
          purchaseOrderId,
          receivedBy,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          remarks,
          status: 'PENDING',
          items: {
            create: grnItemsData.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              orderedQuantity: item.orderedQuantity,
              receivedQuantity: item.receivedQuantity,
              damagedQuantity: item.damagedQuantity,
              pendingQuantity: item.pendingQuantity,
              remarks: item.remarks,
            })),
          },
        },
      });

      await recordGRNStockMovements(tx, createdGRN.id, projectId, req.userId, grnItemsData);
      await recomputePurchaseOrderStatus(tx, purchaseOrderId);

      return tx.gRN.findUniqueOrThrow({
        where: { id: createdGRN.id },
        include: grnDetailInclude,
      });
    });

    return created(res, 'GRN created successfully', grn);
  } catch (err: any) {
    logger.error(err);
    return error(res, err.message || 'Failed to create GRN', 500);
  }
};

// Get all GRNs (filterable by status, purchaseOrderId, projectId)
export const getAllGRNs = async (req: AuthRequest, res: Response) => {
  try {
    const { status, purchaseOrderId, projectId } = req.query;

    const where: any = {};

    if (status) where.status = status as string;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId as string;
    if (projectId) {
      where.purchaseOrder = {
        materialRequest: { projectId: projectId as string },
      };
    }

    const grns = await prisma.gRN.findMany({
      where,
      include: grnDetailInclude,
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'GRNs fetched successfully', grns);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRNs', 500);
  }
};

// Get GRN by ID
export const getGRNById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const grn = await prisma.gRN.findUnique({
      where: { id: id as string },
      include: {
        items: { include: { purchaseOrderItem: true } },
        purchaseOrder: {
          include: {
            items: true,
            materialRequest: {
              include: {
                project: { select: { id: true, name: true, projectId: true, location: true } },
              },
            },
          },
        },
      },
    });

    if (!grn) {
      return error(res, 'GRN not found', 404);
    }

    return success(res, 'GRN fetched successfully', grn);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRN', 500);
  }
};

// Get GRNs by Purchase Order
export const getGRNsByPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseOrderId } = req.params;

    const grns = await prisma.gRN.findMany({
      where: { purchaseOrderId: purchaseOrderId as string },
      include: { items: { include: { purchaseOrderItem: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'GRNs fetched successfully', grns);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRNs', 500);
  }
};

// Get GRNs by Project
export const getGRNsByProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const grns = await prisma.gRN.findMany({
      where: {
        purchaseOrder: { materialRequest: { projectId: projectId as string } },
      },
      include: {
        items: { include: { purchaseOrderItem: true } },
        purchaseOrder: { include: { materialRequest: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'GRNs fetched successfully', grns);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRNs', 500);
  }
};

// Update GRN status. REJECTED reverses this GRN's stock movements and
// recomputes the parent PO's status from the remaining valid GRNs.
export const updateGRNStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return error(res, 'Status is required', 400);
    }

    const validStatuses = ['PENDING', 'COMPLETED', 'PARTIALLY_RECEIVED', 'REJECTED'];

    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const existingGRN = await prisma.gRN.findUnique({ where: { id: id as string } });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    const updatedGRN = await prisma.$transaction(async (tx) => {
      const grn = await tx.gRN.update({
        where: { id: id as string },
        data: { status },
        include: grnDetailInclude,
      });

      if (status === 'REJECTED' && existingGRN.status !== 'REJECTED') {
        await reverseGRNStockMovements(tx, existingGRN.id);
        await recomputePurchaseOrderStatus(tx, existingGRN.purchaseOrderId);
      }

      return grn;
    });

    return success(res, 'GRN status updated successfully', updatedGRN);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update GRN status', 500);
  }
};

// Update GRN — only while status is PENDING. If items are replaced, quantities are
// revalidated (excluding this GRN's own previous contribution), stock movements are
// reversed then re-recorded, and the parent PO's status is recomputed.
export const updateGRN = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedBy, receivedDate, remarks, items } = req.body;

    const existingGRN = await prisma.gRN.findUnique({
      where: { id: id as string },
      include: {
        items: true,
        purchaseOrder: { include: { items: true, materialRequest: true } },
      },
    });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    if (existingGRN.status !== 'PENDING') {
      return error(res, 'Can only update a GRN while it is PENDING', 400);
    }

    const updateData: any = {};
    if (receivedBy) updateData.receivedBy = receivedBy;
    if (receivedDate) updateData.receivedDate = new Date(receivedDate);
    if (remarks !== undefined) updateData.remarks = remarks;

    let grnItemsData:
      | {
          purchaseOrderItemId: string;
          orderedQuantity: number;
          receivedQuantity: number;
          damagedQuantity: number;
          pendingQuantity: number;
          remarks?: string;
          itemName: string;
          unit: string;
        }[]
      | null = null;

    if (items && Array.isArray(items) && items.length > 0) {
      grnItemsData = [];

      for (const item of items) {
        const poItem = existingGRN.purchaseOrder.items.find((i) => i.id === item.purchaseOrderItemId);

        if (!poItem) {
          return error(res, `Purchase order item ${item.purchaseOrderItemId} not found`, 400);
        }

        const previousGRNItems = await prisma.gRNItem.findMany({
          where: {
            purchaseOrderItemId: item.purchaseOrderItemId,
            grnId: { not: id as string },
            grn: { status: { not: 'REJECTED' } },
          },
        });

        const totalPreviousReceived = previousGRNItems.reduce((sum, g) => sum + g.receivedQuantity, 0);

        const receivedQuantity = parseFloat(item.receivedQuantity) || 0;
        const damagedQuantity = parseFloat(item.damagedQuantity) || 0;
        const orderedQuantity = poItem.quantity;
        const pendingQuantity = orderedQuantity - (totalPreviousReceived + receivedQuantity);

        if (pendingQuantity < 0) {
          return error(
            res,
            `Cannot receive more than ordered quantity for item ${poItem.itemName}. Ordered: ${orderedQuantity}, Already received: ${totalPreviousReceived}, Current: ${receivedQuantity}`,
            400
          );
        }

        grnItemsData.push({
          purchaseOrderItemId: item.purchaseOrderItemId,
          orderedQuantity,
          receivedQuantity,
          damagedQuantity,
          pendingQuantity,
          remarks: item.remarks,
          itemName: poItem.itemName,
          unit: poItem.unit,
        });
      }
    }

    const projectId = existingGRN.purchaseOrder.materialRequest.projectId;

    const updatedGRN = await prisma.$transaction(async (tx) => {
      if (grnItemsData) {
        // Reverse this GRN's previous stock contribution before re-recording it
        await reverseGRNStockMovements(tx, existingGRN.id);
        await tx.gRNItem.deleteMany({ where: { grnId: id as string } });

        updateData.items = {
          create: grnItemsData.map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            orderedQuantity: item.orderedQuantity,
            receivedQuantity: item.receivedQuantity,
            damagedQuantity: item.damagedQuantity,
            pendingQuantity: item.pendingQuantity,
            remarks: item.remarks,
          })),
        };
      }

      await tx.gRN.update({ where: { id: id as string }, data: updateData });

      if (grnItemsData) {
        await recordGRNStockMovements(tx, existingGRN.id, projectId, req.userId, grnItemsData);
        await recomputePurchaseOrderStatus(tx, existingGRN.purchaseOrderId);
      }

      return tx.gRN.findUniqueOrThrow({ where: { id: id as string }, include: grnDetailInclude });
    });

    return success(res, 'GRN updated successfully', updatedGRN);
  } catch (err: any) {
    logger.error(err);
    return error(res, err.message || 'Failed to update GRN', 500);
  }
};

// Delete GRN — only while status is PENDING or REJECTED. Reverses its stock
// movements and recomputes the parent PO's status the same way as a rejection.
export const deleteGRN = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingGRN = await prisma.gRN.findUnique({ where: { id: id as string } });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    if (!['PENDING', 'REJECTED'].includes(existingGRN.status)) {
      return error(res, 'Can only delete a GRN while it is PENDING or REJECTED', 400);
    }

    await prisma.$transaction(async (tx) => {
      await reverseGRNStockMovements(tx, existingGRN.id);
      await tx.gRN.delete({ where: { id: id as string } });
      await recomputePurchaseOrderStatus(tx, existingGRN.purchaseOrderId);
    });

    return success(res, 'GRN deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete GRN', 500);
  }
};

// Get GRN summary for a purchase order (aggregated per PO item, excludes REJECTED GRNs)
export const getGRNSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseOrderId } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId as string },
      include: {
        items: true,
        grns: {
          where: { status: { not: 'REJECTED' } },
          include: { items: true },
        },
      },
    });

    if (!purchaseOrder) {
      return error(res, 'Purchase order not found', 404);
    }

    const summary = purchaseOrder.items.map((poItem) => {
      const totalReceived = purchaseOrder.grns.reduce((sum, grn) => {
        const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
        return sum + (grnItem?.receivedQuantity || 0);
      }, 0);

      const totalDamaged = purchaseOrder.grns.reduce((sum, grn) => {
        const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
        return sum + (grnItem?.damagedQuantity || 0);
      }, 0);

      return {
        itemId: poItem.id,
        itemName: poItem.itemName,
        description: poItem.description,
        unit: poItem.unit,
        orderedQuantity: poItem.quantity,
        receivedQuantity: totalReceived,
        damagedQuantity: totalDamaged,
        pendingQuantity: poItem.quantity - totalReceived,
        unitPrice: poItem.unitPrice,
        totalPrice: poItem.totalPrice,
      };
    });

    return success(res, 'GRN summary fetched successfully', {
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vendorName: purchaseOrder.vendorName,
        status: purchaseOrder.status,
        totalAmount: purchaseOrder.totalAmount,
      },
      summary,
      totalGRNs: purchaseOrder.grns.length,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRN summary', 500);
  }
};
