import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Generate unique GRN number
const generateGRNNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Get count of GRNs this month
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
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

    // Get purchase order with items
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { 
        items: true,
        materialRequest: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return error(res, 'Purchase order not found', 404);
    }

    // Validate that PO is in appropriate status
    if (!['SENT', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status)) {
      return error(res, 'Purchase order must be SENT, APPROVED, or PARTIALLY_RECEIVED to create GRN', 400);
    }

    // Generate GRN number
    const grnNumber = await generateGRNNumber();

    // Validate items and calculate pending quantities
    const grnItems = await Promise.all(
      items.map(async (item: any) => {
        const poItem = purchaseOrder.items.find((i) => i.id === item.purchaseOrderItemId);
        
        if (!poItem) {
          throw new Error(`Purchase order item ${item.purchaseOrderItemId} not found`);
        }

        // Get total received quantity from previous GRNs for this PO item
        const previousGRNItems = await prisma.gRNItem.findMany({
          where: {
            purchaseOrderItemId: item.purchaseOrderItemId,
            grn: {
              status: {
                not: 'REJECTED',
              },
            },
          },
        });

        const totalPreviousReceived = previousGRNItems.reduce(
          (sum, grnItem) => sum + grnItem.receivedQuantity,
          0
        );

        const receivedQuantity = parseFloat(item.receivedQuantity) || 0;
        const damagedQuantity = parseFloat(item.damagedQuantity) || 0;
        const orderedQuantity = poItem.quantity;

        // Calculate pending quantity
        const totalReceived = totalPreviousReceived + receivedQuantity;
        const pendingQuantity = orderedQuantity - totalReceived;

        if (pendingQuantity < 0) {
          throw new Error(
            `Cannot receive more than ordered quantity for item ${poItem.itemName}. Ordered: ${orderedQuantity}, Already Received: ${totalPreviousReceived}, Current: ${receivedQuantity}`
          );
        }

        return {
          purchaseOrderItemId: item.purchaseOrderItemId,
          orderedQuantity,
          receivedQuantity,
          damagedQuantity,
          pendingQuantity,
          remarks: item.remarks,
        };
      })
    );

    // Create GRN with items
    const grn = await prisma.gRN.create({
      data: {
        grnNumber,
        purchaseOrderId,
        receivedBy,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        remarks,
        status: 'PENDING',
        items: {
          create: grnItems,
        },
      },
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            materialRequest: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectId: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Check if all items are fully received
    const allFullyReceived = grnItems.every((item) => item.pendingQuantity === 0);

    // Update purchase order status
    if (allFullyReceived) {
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: 'RECEIVED' },
      });
    } else {
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: 'PARTIALLY_RECEIVED' },
      });
    }

    return created(res, 'GRN created successfully', grn);
  } catch (err: any) {
    logger.error(err);
    return error(res, err.message || 'Failed to create GRN', 500);
  }
};

// Get all GRNs
export const getAllGRNs = async (req: AuthRequest, res: Response) => {
  try {
    const { status, purchaseOrderId, projectId } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId as string;
    }

    if (projectId) {
      where.purchaseOrder = {
        materialRequest: {
          projectId: projectId as string,
        },
      };
    }

    const grns = await prisma.gRN.findMany({
      where,
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            materialRequest: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectId: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            items: true,
            materialRequest: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectId: true,
                    location: true,
                  },
                },
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
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
        purchaseOrder: {
          materialRequest: {
            projectId: projectId as string,
          },
        },
      },
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            materialRequest: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'GRNs fetched successfully', grns);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch GRNs', 500);
  }
};

// Update GRN status
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

    const existingGRN = await prisma.gRN.findUnique({
      where: { id: id as string },
      include: {
        purchaseOrder: true,
      },
    });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    const updatedGRN = await prisma.gRN.update({
      where: { id: id as string },
      data: { status },
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: true,
      },
    });

    // If GRN is rejected, we need to recalculate PO status
    if (status === 'REJECTED') {
      // Get all non-rejected GRNs for this PO
      const validGRNs = await prisma.gRN.findMany({
        where: {
          purchaseOrderId: existingGRN.purchaseOrderId,
          status: { not: 'REJECTED' },
        },
        include: {
          items: true,
        },
      });

      // Check if PO should still be in RECEIVED status
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: existingGRN.purchaseOrderId },
        include: { items: true },
      });

      if (purchaseOrder) {
        // Calculate total received for each item
        const hasAnyPartiallyReceived = purchaseOrder.items.some((poItem) => {
          const totalReceived = validGRNs.reduce((sum, grn) => {
            const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
            return sum + (grnItem?.receivedQuantity || 0);
          }, 0);

          return totalReceived > 0 && totalReceived < poItem.quantity;
        });

        const allFullyReceived = purchaseOrder.items.every((poItem) => {
          const totalReceived = validGRNs.reduce((sum, grn) => {
            const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
            return sum + (grnItem?.receivedQuantity || 0);
          }, 0);

          return totalReceived >= poItem.quantity;
        });

        let newStatus = 'SENT';
        if (allFullyReceived) {
          newStatus = 'RECEIVED';
        } else if (hasAnyPartiallyReceived) {
          newStatus = 'PARTIALLY_RECEIVED';
        }

        await prisma.purchaseOrder.update({
          where: { id: existingGRN.purchaseOrderId },
          data: { status: newStatus as any },
        });
      }
    }

    return success(res, 'GRN status updated successfully', updatedGRN);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update GRN status', 500);
  }
};

// Update GRN
export const updateGRN = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedBy, receivedDate, remarks, items } = req.body;

    logger.info({ id, body: req.body }, 'Update GRN request received');
    logger.info({ items, itemsType: typeof items, isArray: Array.isArray(items), length: items?.length }, 'Items in request');

    const existingGRN = await prisma.gRN.findUnique({
      where: { id: id as string },
      include: {
        items: true,
        purchaseOrder: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    // Only allow updates if status is PENDING
    if (existingGRN.status !== 'PENDING') {
      return error(res, 'Can only update GRN in PENDING status', 400);
    }

    const updateData: any = {};

    if (receivedBy) updateData.receivedBy = receivedBy;
    if (receivedDate) updateData.receivedDate = new Date(receivedDate);
    if (remarks !== undefined) updateData.remarks = remarks;

    // Handle items update if provided
    if (items && Array.isArray(items) && items.length > 0) {
      logger.info({ itemsCount: items.length }, 'Processing items update...');
      // Validate items and calculate pending quantities
      const grnItems = await Promise.all(
        items.map(async (item: any) => {
          const poItem = existingGRN.purchaseOrder.items.find((i) => i.id === item.purchaseOrderItemId);
          
          if (!poItem) {
            throw new Error(`Purchase order item ${item.purchaseOrderItemId} not found`);
          }

          // Get total received quantity from previous GRNs (excluding current GRN)
          const previousGRNItems = await prisma.gRNItem.findMany({
            where: {
              purchaseOrderItemId: item.purchaseOrderItemId,
              grnId: { not: id as string }, // Exclude current GRN
              grn: {
                status: {
                  not: 'REJECTED',
                },
              },
            },
          });

          const totalPreviousReceived = previousGRNItems.reduce(
            (sum, grnItem) => sum + grnItem.receivedQuantity,
            0
          );

          const receivedQuantity = parseFloat(item.receivedQuantity) || 0;
          const damagedQuantity = parseFloat(item.damagedQuantity) || 0;
          const orderedQuantity = poItem.quantity;

          // Calculate pending quantity
          const totalReceived = totalPreviousReceived + receivedQuantity;
          const pendingQuantity = orderedQuantity - totalReceived;

          if (pendingQuantity < 0) {
            throw new Error(
              `Cannot receive more than ordered quantity for item ${poItem.itemName}. Ordered: ${orderedQuantity}, Already Received: ${totalPreviousReceived}, Current: ${receivedQuantity}`
            );
          }

          return {
            purchaseOrderItemId: item.purchaseOrderItemId,
            orderedQuantity,
            receivedQuantity,
            damagedQuantity,
            pendingQuantity,
            remarks: item.remarks,
          };
        })
      );

      // Delete existing items and create new ones
      await prisma.gRNItem.deleteMany({
        where: { grnId: id as string },
      });

      updateData.items = {
        create: grnItems,
      };

      // Update purchase order status based on new quantities
      const allFullyReceived = grnItems.every((item) => item.pendingQuantity === 0);
      const anyReceived = grnItems.some((item) => item.receivedQuantity > 0);

      if (allFullyReceived) {
        await prisma.purchaseOrder.update({
          where: { id: existingGRN.purchaseOrderId },
          data: { status: 'RECEIVED' },
        });
      } else if (anyReceived) {
        await prisma.purchaseOrder.update({
          where: { id: existingGRN.purchaseOrderId },
          data: { status: 'PARTIALLY_RECEIVED' },
        });
      }
    }

    const updatedGRN = await prisma.gRN.update({
      where: { id: id as string },
      data: updateData,
      include: {
        items: {
          include: {
            purchaseOrderItem: true,
          },
        },
        purchaseOrder: {
          include: {
            materialRequest: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    return success(res, 'GRN updated successfully', updatedGRN);
  } catch (err: any) {
    logger.error(err);
    return error(res, err.message || 'Failed to update GRN', 500);
  }
};

// Delete GRN
export const deleteGRN = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingGRN = await prisma.gRN.findUnique({
      where: { id: id as string },
      include: {
        items: true,
        purchaseOrder: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingGRN) {
      return error(res, 'GRN not found', 404);
    }

    // Only allow deletion if status is PENDING or REJECTED
    if (!['PENDING', 'REJECTED'].includes(existingGRN.status)) {
      return error(res, 'Can only delete GRN in PENDING or REJECTED status', 400);
    }

    await prisma.gRN.delete({
      where: { id: id as string },
    });

    // Recalculate PO status
    const validGRNs = await prisma.gRN.findMany({
      where: {
        purchaseOrderId: existingGRN.purchaseOrderId,
        status: { not: 'REJECTED' },
      },
      include: {
        items: true,
      },
    });

    if (validGRNs.length === 0) {
      // No more valid GRNs, set PO back to SENT
      await prisma.purchaseOrder.update({
        where: { id: existingGRN.purchaseOrderId },
        data: { status: 'SENT' },
      });
    } else {
      // Recalculate status based on remaining GRNs
      const purchaseOrder = existingGRN.purchaseOrder;
      const allFullyReceived = purchaseOrder.items.every((poItem) => {
        const totalReceived = validGRNs.reduce((sum, grn) => {
          const grnItem = grn.items.find((i) => i.purchaseOrderItemId === poItem.id);
          return sum + (grnItem?.receivedQuantity || 0);
        }, 0);

        return totalReceived >= poItem.quantity;
      });

      await prisma.purchaseOrder.update({
        where: { id: existingGRN.purchaseOrderId },
        data: { status: allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });
    }

    return success(res, 'GRN deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete GRN', 500);
  }
};

// Get GRN summary for a purchase order
export const getGRNSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseOrderId } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId as string },
      include: {
        items: true,
        grns: {
          where: {
            status: { not: 'REJECTED' },
          },
          include: {
            items: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return error(res, 'Purchase order not found', 404);
    }

    // Calculate summary for each item
    const summary = purchaseOrder.items.map((poItem: any) => {
      const totalReceived = purchaseOrder.grns.reduce((sum: number, grn: any) => {
        const grnItem = grn.items.find((i: any) => i.purchaseOrderItemId === poItem.id);
        return sum + (grnItem?.receivedQuantity || 0);
      }, 0);

      const totalDamaged = purchaseOrder.grns.reduce((sum: number, grn: any) => {
        const grnItem = grn.items.find((i: any) => i.purchaseOrderItemId === poItem.id);
        return sum + (grnItem?.damagedQuantity || 0);
      }, 0);

      const pending = poItem.quantity - totalReceived;

      return {
        itemId: poItem.id,
        itemName: poItem.itemName,
        description: poItem.description,
        unit: poItem.unit,
        orderedQuantity: poItem.quantity,
        receivedQuantity: totalReceived,
        damagedQuantity: totalDamaged,
        pendingQuantity: pending,
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
