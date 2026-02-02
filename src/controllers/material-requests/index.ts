import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';

// Create a new material request
export const createMaterialRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { projectId, title, description, priority, items } = req.body;

    // Validate required fields
    if (!projectId || !title || !items || !Array.isArray(items)) {
      return error(res, 'Missing required fields', 400);
    }

    // Validate items array
    if (items.length === 0) {
      return error(res, 'At least one item is required', 400);
    }

    // Check if project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    // Create material request with items
    const materialRequest = await prisma.materialRequest.create({
      data: {
        projectId,
        requestedBy: req.userId as string,
        title,
        description,
        priority: priority || 'MEDIUM',
        items: {
          create: items.map((item: any) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            estimatedCost: item.estimatedCost,
            remarks: item.remarks,
          })),
        },
      },
      include: {
        items: true,
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
    });

    return created(res, 'Material request created successfully', materialRequest);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to create material request', 500);
  }
};

// Get all material requests
export const getAllMaterialRequests = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { projectId, status, priority } = req.query;

    const where: any = {};

    if (projectId) {
      where.projectId = projectId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (priority) {
      where.priority = priority as string;
    }

    const materialRequests = await prisma.materialRequest.findMany({
      where,
      include: {
        items: true,
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Material requests fetched successfully', materialRequests);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch material requests', 500);
  }
};

// Get a single material request by ID
export const getMaterialRequestById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id },
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
    });

    if (!materialRequest) {
      return error(res, 'Material request not found', 404);
    }

    return success(res, 'Material request fetched successfully', materialRequest);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch material request', 500);
  }
};

// Get material requests by project ID
export const getMaterialRequestsByProject = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { projectId } = req.params;

    const materialRequests = await prisma.materialRequest.findMany({
      where: { projectId },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(
      res,
      'Material requests fetched successfully',
      materialRequests
    );
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to fetch material requests', 500);
  }
};

// Update material request
export const updateMaterialRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { title, description, priority, status } = req.body;

    // Check if material request exists
    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return error(res, 'Material request not found', 404);
    }

    const updateData: any = {};

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    const updatedRequest = await prisma.materialRequest.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
    });

    return success(res, 'Material request updated successfully', updatedRequest);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to update material request', 500);
  }
};

// Update material request status
export const updateMaterialRequestStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return error(res, 'Status is required', 400);
    }

    const validStatuses = [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'ORDERED',
      'DELIVERED',
      'CANCELLED',
    ];

    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const updatedRequest = await prisma.materialRequest.update({
      where: { id },
      data: { status },
      include: {
        items: true,
        project: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
    });

    return success(
      res,
      'Material request status updated successfully',
      updatedRequest
    );
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to update material request status', 500);
  }
};

// Delete material request
export const deleteMaterialRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    // Check if material request exists
    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return error(res, 'Material request not found', 404);
    }

    // Delete material request (items will be cascade deleted)
    await prisma.materialRequest.delete({
      where: { id },
    });

    return success(res, 'Material request deleted successfully', null);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to delete material request', 500);
  }
};

// Add item to material request
export const addItemToMaterialRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { itemName, quantity, unit, estimatedCost, remarks } = req.body;

    if (!itemName || !quantity || !unit) {
      return error(res, 'Item name, quantity, and unit are required', 400);
    }

    // Check if material request exists
    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return error(res, 'Material request not found', 404);
    }

    const newItem = await prisma.materialRequestItem.create({
      data: {
        materialRequestId: id,
        itemName,
        quantity,
        unit,
        estimatedCost,
        remarks,
      },
    });

    return created(res, 'Item added successfully', newItem);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to add item', 500);
  }
};

// Update material request item
export const updateMaterialRequestItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { itemId } = req.params;
    const { itemName, quantity, unit, estimatedCost, remarks } = req.body;

    // Check if item exists
    const existingItem = await prisma.materialRequestItem.findUnique({
      where: { id: itemId },
    });

    if (!existingItem) {
      return error(res, 'Item not found', 404);
    }

    const updateData: any = {};

    if (itemName) updateData.itemName = itemName;
    if (quantity) updateData.quantity = quantity;
    if (unit) updateData.unit = unit;
    if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;
    if (remarks !== undefined) updateData.remarks = remarks;

    const updatedItem = await prisma.materialRequestItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return success(res, 'Item updated successfully', updatedItem);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to update item', 500);
  }
};

// Delete material request item
export const deleteMaterialRequestItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { itemId } = req.params;

    // Check if item exists
    const existingItem = await prisma.materialRequestItem.findUnique({
      where: { id: itemId },
    });

    if (!existingItem) {
      return error(res, 'Item not found', 404);
    }

    await prisma.materialRequestItem.delete({
      where: { id: itemId },
    });

    return success(res, 'Item deleted successfully', null);
  } catch (err) {
    console.log(err);
    return error(res, 'Failed to delete item', 500);
  }
};

