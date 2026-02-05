import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Generate unique PO number
const generatePONumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Get count of POs this month
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
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

// Create purchase order from material request
export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { materialRequestId, vendorId, vendorName, vendorContact, vendorEmail, vendorAddress, notes, expectedDelivery, items } = req.body;

    if (!materialRequestId) {
      return error(res, 'Material request ID is required', 400);
    }

    // Validate vendor - either vendorId or vendorName must be provided
    if (!vendorId && !vendorName) {
      return error(res, 'Either vendorId or vendor details are required', 400);
    }

    // If vendorId is provided, verify vendor exists
    if (vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        return error(res, 'Vendor not found', 404);
      }

      if (vendor.status !== 'ACTIVE') {
        return error(res, 'Vendor is not active', 400);
      }
    }

    // Get material request with items
    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: materialRequestId },
      include: { items: true },
    });

    if (!materialRequest) {
      return error(res, 'Material request not found', 404);
    }

    // Generate PO number
    const poNumber = await generatePONumber();

    // If items are provided, use them; otherwise create from material request items
    let poItems: any[] = [];
    
    if (items && Array.isArray(items) && items.length > 0) {
      // Use provided items with unit prices
      poItems = items.map((item: any) => ({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
      }));
    } else {
      // Create items from material request items
      poItems = materialRequest.items.map((item) => ({
        itemName: item.itemName,
        description: item.remarks,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.estimatedCost || 0,
        totalPrice: item.quantity * (item.estimatedCost || 0),
      }));
    }

    // Calculate total amount
    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Create purchase order with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        materialRequestId,
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
      include: {
        items: true,
        vendor: true,
        materialRequest: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectId: true,
              },
            },
          },
        },
      },
    });

    // Update material request status to ORDERED
    await prisma.materialRequest.update({
      where: { id: materialRequestId },
      data: { status: 'ORDERED' },
    });

    return created(res, 'Purchase order created successfully', purchaseOrder);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to create purchase order', 500);
  }
};

// Get all purchase orders
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
        {
          vendorName: {
            contains: vendorName as string,
            mode: 'insensitive',
          },
        },
        {
          vendor: {
            name: {
              contains: vendorName as string,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: true,
        vendor: true,
        materialRequest: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Purchase orders fetched successfully', purchaseOrders);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch purchase orders', 500);
  }
};

// Get purchase order by ID
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
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Purchase orders fetched successfully', purchaseOrders);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch purchase orders', 500);
  }
};

// Update purchase order
export const updatePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorId, vendorName, vendorContact, vendorEmail, vendorAddress, notes, expectedDelivery, status } = req.body;

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    // Only allow updates if status is DRAFT or PENDING
    if (!['DRAFT', 'PENDING'].includes(existingPO.status)) {
      return error(res, 'Cannot update purchase order in current status', 400);
    }

    // If vendorId is provided, verify vendor exists
    if (vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        return error(res, 'Vendor not found', 404);
      }

      if (vendor.status !== 'ACTIVE') {
        return error(res, 'Vendor is not active', 400);
      }
    }

    const updateData: any = {};

    if (vendorId !== undefined) {
      updateData.vendorId = vendorId;
      // Clear old vendor fields if switching to vendorId
      updateData.vendorName = null;
      updateData.vendorContact = null;
      updateData.vendorEmail = null;
      updateData.vendorAddress = null;
    } else {
      if (vendorName !== undefined) updateData.vendorName = vendorName;
      if (vendorContact !== undefined) updateData.vendorContact = vendorContact;
      if (vendorEmail !== undefined) updateData.vendorEmail = vendorEmail;
      if (vendorAddress !== undefined) updateData.vendorAddress = vendorAddress;
    }
    
    if (notes !== undefined) updateData.notes = notes;
    if (expectedDelivery) updateData.expectedDelivery = new Date(expectedDelivery);
    if (status) updateData.status = status;

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: id as string },
      data: updateData,
      include: {
        items: true,
        vendor: true,
        materialRequest: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectId: true,
              },
            },
          },
        },
      },
    });

    return success(res, 'Purchase order updated successfully', updatedPO);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update purchase order', 500);
  }
};

// Update purchase order status
export const updatePurchaseOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return error(res, 'Status is required', 400);
    }

    const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

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
      include: {
        items: true,
        materialRequest: true,
      },
    });

    // If PO is received, update material request status to DELIVERED
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

// Delete purchase order
export const deletePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id: id as string },
    });

    if (!existingPO) {
      return error(res, 'Purchase order not found', 404);
    }

    // Only allow deletion if status is DRAFT
    if (existingPO.status !== 'DRAFT') {
      return error(res, 'Only draft purchase orders can be deleted', 400);
    }

    await prisma.purchaseOrder.delete({
      where: { id: id as string },
    });

    return success(res, 'Purchase order deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete purchase order', 500);
  }
};

// Add item to purchase order
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

    if (!['DRAFT', 'PENDING'].includes(existingPO.status)) {
      return error(res, 'Cannot add items to purchase order in current status', 400);
    }

    const totalPrice = quantity * unitPrice;

    const newItem = await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: id as string,
        itemName,
        description,
        quantity,
        unit,
        unitPrice,
        totalPrice,
      },
    });

    // Update total amount
    await prisma.purchaseOrder.update({
      where: { id: id as string },
      data: {
        totalAmount: existingPO.totalAmount + totalPrice,
      },
    });

    return created(res, 'Item added successfully', newItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to add item', 500);
  }
};

// Update purchase order item
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

    if (!['DRAFT', 'PENDING'].includes(existingItem.purchaseOrder.status)) {
      return error(res, 'Cannot update items in purchase order with current status', 400);
    }

    const updateData: any = {};
    let newTotalPrice = existingItem.totalPrice;

    if (itemName) updateData.itemName = itemName;
    if (description !== undefined) updateData.description = description;
    if (unit) updateData.unit = unit;

    // Recalculate total price if quantity or unit price changes
    const newQuantity = quantity !== undefined ? quantity : existingItem.quantity;
    const newUnitPrice = unitPrice !== undefined ? unitPrice : existingItem.unitPrice;
    
    if (quantity !== undefined || unitPrice !== undefined) {
      newTotalPrice = newQuantity * newUnitPrice;
      updateData.quantity = newQuantity;
      updateData.unitPrice = newUnitPrice;
      updateData.totalPrice = newTotalPrice;
    }

    const updatedItem = await prisma.purchaseOrderItem.update({
      where: { id: itemId as string },
      data: updateData,
    });

    // Update purchase order total amount
    const priceDifference = newTotalPrice - existingItem.totalPrice;
    if (priceDifference !== 0) {
      await prisma.purchaseOrder.update({
        where: { id: existingItem.purchaseOrderId },
        data: {
          totalAmount: existingItem.purchaseOrder.totalAmount + priceDifference,
        },
      });
    }

    return success(res, 'Item updated successfully', updatedItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update item', 500);
  }
};

// Delete purchase order item
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

    if (!['DRAFT', 'PENDING'].includes(existingItem.purchaseOrder.status)) {
      return error(res, 'Cannot delete items from purchase order with current status', 400);
    }

    await prisma.purchaseOrderItem.delete({
      where: { id: itemId as string },
    });

    // Update purchase order total amount
    await prisma.purchaseOrder.update({
      where: { id: existingItem.purchaseOrderId },
      data: {
        totalAmount: existingItem.purchaseOrder.totalAmount - existingItem.totalPrice,
      },
    });

    return success(res, 'Item deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete item', 500);
  }
};

