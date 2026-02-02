import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Create vendor
export const createVendor = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      city,
      state,
      country,
      zipCode,
      gstNumber,
      panNumber,
      notes,
    } = req.body;

    if (!name) {
      return error(res, 'Vendor name is required', 400);
    }

    // Check for duplicate vendor name
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingVendor) {
      return error(res, 'Vendor with this name already exists', 400);
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        contactPerson,
        phone,
        email,
        address,
        city,
        state,
        country,
        zipCode,
        gstNumber,
        panNumber,
        notes,
        status: 'ACTIVE',
      },
    });

    return created(res, 'Vendor created successfully', vendor);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to create vendor', 500);
  }
};

// Get all vendors
export const getAllVendors = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};

    if (status) {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          contactPerson: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Vendors fetched successfully', vendors);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch vendors', 500);
  }
};

// Get vendor by ID
export const getVendorById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            materialRequest: {
              select: {
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
        },
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!vendor) {
      return error(res, 'Vendor not found', 404);
    }

    return success(res, 'Vendor fetched successfully', vendor);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch vendor', 500);
  }
};

// Update vendor
export const updateVendor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      city,
      state,
      country,
      zipCode,
      gstNumber,
      panNumber,
      rating,
      notes,
    } = req.body;

    const existingVendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!existingVendor) {
      return error(res, 'Vendor not found', 404);
    }

    // Check for duplicate vendor name if name is being changed
    if (name && name !== existingVendor.name) {
      const duplicateVendor = await prisma.vendor.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: {
            not: id,
          },
        },
      });

      if (duplicateVendor) {
        return error(res, 'Vendor with this name already exists', 400);
      }
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;
    if (zipCode !== undefined) updateData.zipCode = zipCode;
    if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
    if (panNumber !== undefined) updateData.panNumber = panNumber;
    if (rating !== undefined) updateData.rating = rating;
    if (notes !== undefined) updateData.notes = notes;

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    return success(res, 'Vendor updated successfully', updatedVendor);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update vendor', 500);
  }
};

// Update vendor status
export const updateVendorStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return error(res, 'Status is required', 400);
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const existingVendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!existingVendor) {
      return error(res, 'Vendor not found', 404);
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: { status },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    return success(res, 'Vendor status updated successfully', updatedVendor);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update vendor status', 500);
  }
};

// Delete vendor
export const deleteVendor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingVendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!existingVendor) {
      return error(res, 'Vendor not found', 404);
    }

    // Check if vendor has any purchase orders
    if (existingVendor._count.purchaseOrders > 0) {
      return error(
        res,
        'Cannot delete vendor with existing purchase orders. Set status to INACTIVE instead.',
        400
      );
    }

    await prisma.vendor.delete({
      where: { id },
    });

    return success(res, 'Vendor deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete vendor', 500);
  }
};

// Get vendor statistics
export const getVendorStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: {
            items: true,
            grns: {
              where: {
                status: {
                  not: 'REJECTED',
                },
              },
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return error(res, 'Vendor not found', 404);
    }

    // Calculate statistics
    const totalPOs = vendor.purchaseOrders.length;
    const totalAmount = vendor.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    
    const completedPOs = vendor.purchaseOrders.filter((po) => po.status === 'RECEIVED').length;
    const pendingPOs = vendor.purchaseOrders.filter(
      (po) => po.status === 'SENT' || po.status === 'APPROVED'
    ).length;
    const partiallyReceivedPOs = vendor.purchaseOrders.filter(
      (po) => po.status === 'PARTIALLY_RECEIVED'
    ).length;

    // Calculate on-time delivery percentage
    const receivedPOs = vendor.purchaseOrders.filter((po) => po.status === 'RECEIVED');
    const onTimeDeliveries = receivedPOs.filter((po) => {
      if (!po.expectedDelivery) return true;
      
      // Find the last GRN for this PO
      const lastGRN = po.grns.reduce((latest, grn) => {
        return !latest || new Date(grn.receivedDate) > new Date(latest.receivedDate)
          ? grn
          : latest;
      }, null as any);

      if (!lastGRN) return true;
      
      return new Date(lastGRN.receivedDate) <= new Date(po.expectedDelivery);
    }).length;

    const onTimePercentage = receivedPOs.length > 0
      ? Math.round((onTimeDeliveries / receivedPOs.length) * 100)
      : 0;

    // Calculate total items and damaged items
    let totalItemsDelivered = 0;
    let totalDamagedItems = 0;

    vendor.purchaseOrders.forEach((po) => {
      po.grns.forEach((grn) => {
        grn.items.forEach((item) => {
          totalItemsDelivered += item.receivedQuantity;
          totalDamagedItems += item.damagedQuantity;
        });
      });
    });

    const damageRate = totalItemsDelivered > 0
      ? ((totalDamagedItems / totalItemsDelivered) * 100).toFixed(2)
      : '0.00';

    const stats = {
      vendor: {
        id: vendor.id,
        name: vendor.name,
        status: vendor.status,
        rating: vendor.rating,
      },
      purchaseOrders: {
        total: totalPOs,
        completed: completedPOs,
        partiallyReceived: partiallyReceivedPOs,
        pending: pendingPOs,
      },
      financial: {
        totalAmount,
        averageOrderValue: totalPOs > 0 ? Math.round(totalAmount / totalPOs) : 0,
      },
      performance: {
        onTimeDeliveryPercentage: onTimePercentage,
        damageRate: parseFloat(damageRate),
        totalItemsDelivered,
        totalDamagedItems,
      },
    };

    return success(res, 'Vendor statistics fetched successfully', stats);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch vendor statistics', 500);
  }
};

// Get active vendors (for dropdowns)
export const getActiveVendors = async (req: AuthRequest, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return success(res, 'Active vendors fetched successfully', vendors);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch active vendors', 500);
  }
};
