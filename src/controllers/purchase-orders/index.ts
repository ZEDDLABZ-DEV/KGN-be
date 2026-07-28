import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Generate unique PO number: PO-{YY}{MM}-{sequence}, sequence resets every calendar month
const generatePONumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  const count = await prisma.purchaseOrder.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `PO-${year}${month}-${sequence}`;
};

const poDetailInclude = {
  items: true,
  vendor: true,
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
} as const;

// Create purchase order from an approved material request.
// POs have no draft/pending stage — they are created directly as APPROVED.
export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const {
      materialRequestId,
      vendorId,
      vendorName,
      vendorContact,
      vendorEmail,
      vendorAddress,
      notes,
      expectedDelivery,
      items,
    } = req.body;

    if (!materialRequestId) {
      return error(res, 'Material request ID is required', 400);
    }

    if (!vendorId && !vendorName) {
      return error(res, 'Either vendorId or vendorName (with vendor details) is required', 400);
    }

    if (vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

      if (!vendor) {
        return error(res, 'Vendor not found', 404);
      }

      if (vendor.status !== 'ACTIVE' || vendor.approvalStatus !== 'APPROVED') {
        return error(res, 'Vendor must be ACTIVE and APPROVED to be used on a purchase order', 400);
      }
    }

    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: materialRequestId },
      include: { items: true },
    });

    if (!materialRequest) {
      return error(res, 'Material request not found', 404);
    }

    let poItems: {
      itemName: string;
      description?: string | null;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
    }[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      poItems = items.map((item: any) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return {
          itemName: item.itemName,
          description: item.description,
          quantity,
          unit: item.unit,
          unitPrice,
          totalPrice: quantity * unitPrice,
        };
      });
    } else {
      poItems = materialRequest.items.map((item) => ({
        itemName: item.itemName,
        description: item.remarks,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.estimatedCost || 0,
        totalPrice: item.quantity * (item.estimatedCost || 0),
      }));
    }

    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const poNumber = await generatePONumber();

    const [purchaseOrder] = await prisma.$transaction([
      prisma.purchaseOrder.create({
        data: {
          poNumber,
          materialRequestId,
          status: 'APPROVED',
          vendorId: vendorId || null,
          vendorName: vendorId ? null : vendorName,
          vendorContact: vendorId ? null : vendorContact,
          vendorEmail: vendorId ? null : vendorEmail,
          vendorAddress: vendorId ? null : vendorAddress,
          notes,
          expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
          totalAmount,
          createdById: req.userId,
          items: {
            create: poItems,
          },
        },
        include: poDetailInclude,
      }),
      prisma.materialRequest.update({
        where: { id: materialRequestId },
        data: { status: 'ORDERED' },
      }),
    ]);

    return created(res, 'Purchase order created successfully', purchaseOrder);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to create purchase order', 500);
  }
};

// Get all purchase orders (filterable by status, vendorId, vendorName)
export const getAllPurchaseOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { status, vendorName, vendorId } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (vendorId) {
      where.vendorId = vendorId as string;
    }

    if (vendorName) {
      where.OR = [
        { vendorName: { contains: vendorName as string, mode: 'insensitive' } },
        { vendor: { name: { contains: vendorName as string, mode: 'insensitive' } } },
      ];
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: poDetailInclude,
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'Purchase orders fetched successfully', purchaseOrders);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch purchase orders', 500);
  }
};

// Get purchase order by ID — full detail including items, vendor, and MR + its project
export const getPurchaseOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
      include: {
        items: true,
        vendor: true,
        materialRequest: {
          include: {
            items: true,
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
    });

    if (!purchaseOrder) {
      return error(res, 'Purchase order not found', 404);
    }

    return success(res, 'Purchase order fetched successfully', purchaseOrder);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch purchase order', 500);
  }
};

// Get purchase orders by material request
export const getPurchaseOrdersByMaterialRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { materialRequestId } = req.params;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { materialRequestId: materialRequestId as string },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'Purchase orders fetched successfully', purchaseOrders);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch purchase orders', 500);
  }
};

// Update purchase order — only allowed while status is APPROVED
export const updatePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorId, vendorName, vendorContact, vendorEmail, vendorAddress, notes, expectedDelivery } = req.body;

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    if (existingPO.status !== 'APPROVED') {
      return error(res, 'Purchase order can only be edited while it is APPROVED', 400);
    }

    const updateData: any = {};

    if (vendorId !== undefined) {
      if (vendorId) {
        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

        if (!vendor) {
          return error(res, 'Vendor not found', 404);
        }

        if (vendor.status !== 'ACTIVE' || vendor.approvalStatus !== 'APPROVED') {
          return error(res, 'Vendor must be ACTIVE and APPROVED to be used on a purchase order', 400);
        }
      }

      // vendorId and the free-text vendor snapshot are mutually exclusive
      updateData.vendorId = vendorId || null;
      updateData.vendorName = null;
      updateData.vendorContact = null;
      updateData.vendorEmail = null;
      updateData.vendorAddress = null;
    } else if (
      vendorName !== undefined ||
      vendorContact !== undefined ||
      vendorEmail !== undefined ||
      vendorAddress !== undefined
    ) {
      updateData.vendorId = null;
      if (vendorName !== undefined) updateData.vendorName = vendorName;
      if (vendorContact !== undefined) updateData.vendorContact = vendorContact;
      if (vendorEmail !== undefined) updateData.vendorEmail = vendorEmail;
      if (vendorAddress !== undefined) updateData.vendorAddress = vendorAddress;
    }

    if (notes !== undefined) updateData.notes = notes;
    if (expectedDelivery !== undefined) {
      updateData.expectedDelivery = expectedDelivery ? new Date(expectedDelivery) : null;
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: id as string },
      data: updateData,
      include: poDetailInclude,
    });

    return success(res, 'Purchase order updated successfully', updatedPO);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update purchase order', 500);
  }
};

// Update purchase order status. RECEIVED cascades the parent MR to DELIVERED.
export const updatePurchaseOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return error(res, 'Status is required', 400);
    }

    const validStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: id as string },
      data: { status },
      include: { items: true, materialRequest: true },
    });

    if (status === 'RECEIVED') {
      await prisma.materialRequest.update({
        where: { id: updatedPO.materialRequestId },
        data: { status: 'DELIVERED' },
      });
    }

    return success(res, 'Purchase order status updated successfully', updatedPO);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update purchase order status', 500);
  }
};

// Delete purchase order — only allowed while it has not been sent yet (status APPROVED)
export const deletePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    if (existingPO.status !== 'APPROVED') {
      return error(res, 'Only purchase orders that have not been sent yet can be deleted', 400);
    }

    await prisma.purchaseOrder.delete({ where: { id: id as string } });

    return success(res, 'Purchase order deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete purchase order', 500);
  }
};

// Add item to purchase order — only allowed while status is APPROVED
export const addItemToPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { itemName, description, quantity, unit, unitPrice } = req.body;

    if (!itemName || !quantity || !unit || unitPrice === undefined) {
      return error(res, 'Item name, quantity, unit, and unit price are required', 400);
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    if (existingPO.status !== 'APPROVED') {
      return error(res, 'Items can only be added while the purchase order is APPROVED', 400);
    }

    const totalPrice = parseFloat(quantity) * parseFloat(unitPrice);

    const [newItem] = await prisma.$transaction([
      prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: id as string,
          itemName,
          description,
          quantity: parseFloat(quantity),
          unit,
          unitPrice: parseFloat(unitPrice),
          totalPrice,
        },
      }),
      prisma.purchaseOrder.update({
        where: { id: id as string },
        data: { totalAmount: existingPO.totalAmount + totalPrice },
      }),
    ]);

    return created(res, 'Item added successfully', newItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to add item', 500);
  }
};

// Update purchase order item — only allowed while the parent PO status is APPROVED
export const updatePurchaseOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const { itemName, description, quantity, unit, unitPrice } = req.body;

    const existingItem = await prisma.purchaseOrderItem.findUnique({
      where: { id: itemId as string },
      include: { purchaseOrder: true },
    });

    if (!existingItem) {
      return error(res, 'Item not found', 404);
    }

    if (existingItem.purchaseOrder.status !== 'APPROVED') {
      return error(res, 'Items can only be updated while the purchase order is APPROVED', 400);
    }

    const updateData: any = {};

    if (itemName) updateData.itemName = itemName;
    if (description !== undefined) updateData.description = description;
    if (unit) updateData.unit = unit;

    const newQuantity = quantity !== undefined ? parseFloat(quantity) : existingItem.quantity;
    const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : existingItem.unitPrice;
    const newTotalPrice = newQuantity * newUnitPrice;

    if (quantity !== undefined || unitPrice !== undefined) {
      updateData.quantity = newQuantity;
      updateData.unitPrice = newUnitPrice;
      updateData.totalPrice = newTotalPrice;
    }

    const priceDifference = newTotalPrice - existingItem.totalPrice;

    const [updatedItem] = await prisma.$transaction([
      prisma.purchaseOrderItem.update({
        where: { id: itemId as string },
        data: updateData,
      }),
      prisma.purchaseOrder.update({
        where: { id: existingItem.purchaseOrderId },
        data: { totalAmount: existingItem.purchaseOrder.totalAmount + priceDifference },
      }),
    ]);

    return success(res, 'Item updated successfully', updatedItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update item', 500);
  }
};

// Delete purchase order item — only allowed while the parent PO status is APPROVED
export const deletePurchaseOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const existingItem = await prisma.purchaseOrderItem.findUnique({
      where: { id: itemId as string },
      include: { purchaseOrder: true },
    });

    if (!existingItem) {
      return error(res, 'Item not found', 404);
    }

    if (existingItem.purchaseOrder.status !== 'APPROVED') {
      return error(res, 'Items can only be removed while the purchase order is APPROVED', 400);
    }

    await prisma.$transaction([
      prisma.purchaseOrderItem.delete({ where: { id: itemId as string } }),
      prisma.purchaseOrder.update({
        where: { id: existingItem.purchaseOrderId },
        data: { totalAmount: existingItem.purchaseOrder.totalAmount - existingItem.totalPrice },
      }),
    ]);

    return success(res, 'Item deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete item', 500);
  }
};
