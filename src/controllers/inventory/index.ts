import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';
import { InventoryTransactionType } from '@prisma/client';

// Get all inventory items
export const getAllInventory = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, category, lowStock, search } = req.query;

    const where: any = {};

    if (projectId) {
      where.projectId = projectId as string;
    }

    if (category) {
      where.category = category as string;
    }

    if (lowStock === 'true') {
      where.quantity = {
        lte: where.minimumQuantity,
      };
    }

    if (search) {
      where.OR = [
        {
          itemName: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return success(res, 'Inventory items fetched successfully', inventory);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch inventory items', 500);
  }
};

// Get inventory item by ID
export const getInventoryById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const inventoryItem = await prisma.inventory.findUnique({
      where: { id: id as string },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
            location: true,
          },
        },
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50, // Latest 50 transactions
        },
      },
    });

    if (!inventoryItem) {
      return error(res, 'Inventory item not found', 404);
    }

    return success(res, 'Inventory item fetched successfully', inventoryItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch inventory item', 500);
  }
};

// Get inventory by project
export const getInventoryByProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const inventory = await prisma.inventory.findMany({
      where: { projectId: projectId as string },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: {
        itemName: 'asc',
      },
    });

    return success(res, 'Project inventory fetched successfully', inventory);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch project inventory', 500);
  }
};

// Create inventory item manually
export const createInventoryItem = async (req: AuthRequest, res: Response) => {
  try {
    const {
      itemName,
      description,
      category,
      unit,
      quantity,
      minimumQuantity,
      location,
      projectId,
      remarks,
    } = req.body;

    if (!itemName || !unit || quantity === undefined) {
      return error(res, 'Item name, unit, and quantity are required', 400);
    }

    // Check if project exists if projectId is provided
    if (projectId) {
      const project = await prisma.projects.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return error(res, 'Project not found', 404);
      }
    }

    // Create inventory item with transaction
    const inventoryItem = await prisma.inventory.create({
      data: {
        itemName,
        description,
        category,
        unit,
        quantity: parseFloat(quantity),
        minimumQuantity: minimumQuantity ? parseFloat(minimumQuantity) : null,
        location,
        projectId,
        remarks,
        transactions: {
          create: {
            transactionType: InventoryTransactionType.MANUAL_ADD,
            quantity: parseFloat(quantity),
            previousQuantity: 0,
            newQuantity: parseFloat(quantity),
            remarks: 'Initial inventory creation',
            performedBy: req.userId as string,
          },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
        transactions: true,
      },
    });

    return created(res, 'Inventory item created successfully', inventoryItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to create inventory item', 500);
  }
};

// Update inventory item (details only, not quantity)
export const updateInventoryItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      itemName,
      description,
      category,
      unit,
      minimumQuantity,
      location,
      projectId,
      remarks,
    } = req.body;

    const existingItem = await prisma.inventory.findUnique({
      where: { id: id as string },
    });

    if (!existingItem) {
      return error(res, 'Inventory item not found', 404);
    }

    // Verify project if projectId is being updated
    if (projectId && projectId !== existingItem.projectId) {
      const project = await prisma.projects.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return error(res, 'Project not found', 404);
      }
    }

    const updateData: any = {};

    if (itemName !== undefined) updateData.itemName = itemName;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (unit !== undefined) updateData.unit = unit;
    if (minimumQuantity !== undefined)
      updateData.minimumQuantity = parseFloat(minimumQuantity);
    if (location !== undefined) updateData.location = location;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (remarks !== undefined) updateData.remarks = remarks;

    const updatedItem = await prisma.inventory.update({
      where: { id: id as string },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
    });

    return success(res, 'Inventory item updated successfully', updatedItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update inventory item', 500);
  }
};

// Adjust inventory quantity (add/subtract/adjust)
export const adjustInventoryQuantity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { transactionType, quantity, remarks } = req.body;

    if (!transactionType || quantity === undefined) {
      return error(res, 'Transaction type and quantity are required', 400);
    }

    const validTypes = [
      'MANUAL_ADD',
      'MANUAL_SUBTRACT',
      'MANUAL_ADJUST',
      'DAMAGE',
      'USAGE',
      'RETURN',
      'TRANSFER',
    ];

    if (!validTypes.includes(transactionType)) {
      return error(res, 'Invalid transaction type', 400);
    }

    const existingItem = await prisma.inventory.findUnique({
      where: { id: id as string },
    });

    if (!existingItem) {
      return error(res, 'Inventory item not found', 404);
    }

    const previousQuantity = existingItem.quantity;
    let newQuantity = previousQuantity;
    const adjustmentQuantity = parseFloat(quantity);

    // Calculate new quantity based on transaction type
    switch (transactionType) {
      case 'MANUAL_ADD':
      case 'RETURN':
        newQuantity = previousQuantity + adjustmentQuantity;
        break;
      case 'MANUAL_SUBTRACT':
      case 'DAMAGE':
      case 'USAGE':
      case 'TRANSFER':
        newQuantity = previousQuantity - adjustmentQuantity;
        break;
      case 'MANUAL_ADJUST':
        newQuantity = adjustmentQuantity; // Set to exact quantity
        break;
    }

    if (newQuantity < 0) {
      return error(res, 'Insufficient quantity in inventory', 400);
    }

    // Update inventory and create transaction
    const updatedItem = await prisma.inventory.update({
      where: { id: id as string },
      data: {
        quantity: newQuantity,
        transactions: {
          create: {
            transactionType: transactionType as InventoryTransactionType,
            quantity: adjustmentQuantity,
            previousQuantity,
            newQuantity,
            remarks,
            performedBy: req.userId as string,
          },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    return success(res, 'Inventory quantity adjusted successfully', updatedItem);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to adjust inventory quantity', 500);
  }
};

// Delete inventory item
export const deleteInventoryItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.inventory.findUnique({
      where: { id: id as string },
    });

    if (!existingItem) {
      return error(res, 'Inventory item not found', 404);
    }

    await prisma.inventory.delete({
      where: { id: id as string },
    });

    return success(res, 'Inventory item deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete inventory item', 500);
  }
};

// Get inventory transactions
export const getInventoryTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100', offset = '0' } = req.query;

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { inventoryId: id as string },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.inventoryTransaction.count({
      where: { inventoryId: id as string },
    });

    return success(res, 'Inventory transactions fetched successfully', {
      transactions,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch inventory transactions', 500);
  }
};

// Get low stock items
export const getLowStockItems = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const where: any = {
      minimumQuantity: {
        not: null,
      },
    };

    if (projectId) {
      where.projectId = projectId as string;
    }

    const items = await prisma.inventory.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
    });

    // Filter items where quantity <= minimumQuantity
    const lowStockItems = items.filter(
      (item) => item.minimumQuantity && item.quantity <= item.minimumQuantity
    );

    return success(res, 'Low stock items fetched successfully', lowStockItems);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch low stock items', 500);
  }
};

// Get inventory summary
export const getInventorySummary = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const where: any = {};
    if (projectId) {
      where.projectId = projectId as string;
    }

    const totalItems = await prisma.inventory.count({ where });

    const totalValue = await prisma.inventory.aggregate({
      where,
      _sum: {
        quantity: true,
      },
    });

    const lowStockItems = await prisma.inventory.count({
      where: {
        ...where,
        minimumQuantity: {
          not: null,
        },
      },
    });

    const categories = await prisma.inventory.groupBy({
      by: ['category'],
      where,
      _count: true,
    });

    const recentTransactions = await prisma.inventoryTransaction.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        inventory: {
          select: {
            itemName: true,
            unit: true,
          },
        },
      },
    });

    return success(res, 'Inventory summary fetched successfully', {
      totalItems,
      totalQuantity: totalValue._sum.quantity || 0,
      lowStockItemsCount: lowStockItems,
      categoriesBreakdown: categories,
      recentTransactions,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch inventory summary', 500);
  }
};

// Helper function to add GRN items to inventory (called from GRN controller)
export const addGRNToInventory = async (
  grnId: string,
  grnNumber: string,
  purchaseOrderId: string,
  performedBy: string
) => {
  try {
    // Get GRN with items and purchase order details
    const grn = await prisma.gRN.findUnique({
      where: { id: grnId },
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

    if (!grn) {
      throw new Error('GRN not found');
    }

    const projectId = grn.purchaseOrder.materialRequest.projectId;

    // Process each GRN item
    for (const grnItem of grn.items) {
      const receivedQty = grnItem.receivedQuantity;
      const itemName = grnItem.purchaseOrderItem.itemName;
      const unit = grnItem.purchaseOrderItem.unit;
      const description = grnItem.purchaseOrderItem.description;

      // Check if item already exists in inventory for this project
      let inventoryItem = await prisma.inventory.findFirst({
        where: {
          itemName: {
            equals: itemName,
            mode: 'insensitive',
          },
          unit,
          projectId,
        },
      });

      if (inventoryItem) {
        // Update existing inventory item
        const previousQuantity = inventoryItem.quantity;
        const newQuantity = previousQuantity + receivedQty;

        await prisma.inventory.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: newQuantity,
            transactions: {
              create: {
                transactionType: InventoryTransactionType.GRN_RECEIPT,
                quantity: receivedQty,
                previousQuantity,
                newQuantity,
                reference: grnNumber,
                referenceId: grnId,
                remarks: `Received from GRN ${grnNumber} - PO Item: ${itemName}`,
                performedBy,
              },
            },
          },
        });
      } else {
        // Create new inventory item
        await prisma.inventory.create({
          data: {
            itemName,
            description,
            unit,
            quantity: receivedQty,
            projectId,
            transactions: {
              create: {
                transactionType: InventoryTransactionType.GRN_RECEIPT,
                quantity: receivedQty,
                previousQuantity: 0,
                newQuantity: receivedQty,
                reference: grnNumber,
                referenceId: grnId,
                remarks: `Received from GRN ${grnNumber} - PO Item: ${itemName}`,
                performedBy,
              },
            },
          },
        });
      }
    }

    logger.info(`Successfully added GRN ${grnNumber} items to inventory`);
    return true;
  } catch (err) {
    logger.error(`Failed to add GRN to inventory: ${err}`);
    throw err;
  }
};
