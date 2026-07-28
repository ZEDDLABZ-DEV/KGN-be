import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';

// Create unit (admin only) — name must be unique, case-insensitive
export const createUnit = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return error(res, 'Unit name is required', 400);
    }

    const existing = await prisma.unit.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      return error(res, 'A unit with this name already exists', 400);
    }

    const unit = await prisma.unit.create({ data: { name } });

    return created(res, 'Unit created successfully', unit);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to create unit', 500);
  }
};

// List units — defaults to ACTIVE only; ?status=ACTIVE|INACTIVE|ALL
export const getAllUnits = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const filter = (status as string | undefined)?.toUpperCase() || 'ACTIVE';

    const where: any = {};
    if (filter !== 'ALL') {
      where.status = filter;
    }

    const units = await prisma.unit.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return success(res, 'Units fetched successfully', units);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch units', 500);
  }
};

// Rename unit (admin only)
export const updateUnit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 'Unit name is required', 400);
    }

    const existingUnit = await prisma.unit.findUnique({ where: { id: id as string } });

    if (!existingUnit) {
      return error(res, 'Unit not found', 404);
    }

    const duplicate = await prisma.unit.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: id as string } },
    });

    if (duplicate) {
      return error(res, 'A unit with this name already exists', 400);
    }

    const updatedUnit = await prisma.unit.update({
      where: { id: id as string },
      data: { name },
    });

    return success(res, 'Unit updated successfully', updatedUnit);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update unit', 500);
  }
};

// Set unit status ACTIVE/INACTIVE (admin only)
export const updateUnitStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return error(res, 'Status must be ACTIVE or INACTIVE', 400);
    }

    const existingUnit = await prisma.unit.findUnique({ where: { id: id as string } });

    if (!existingUnit) {
      return error(res, 'Unit not found', 404);
    }

    const updatedUnit = await prisma.unit.update({
      where: { id: id as string },
      data: { status },
    });

    return success(res, 'Unit status updated successfully', updatedUnit);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update unit status', 500);
  }
};

// Hard delete unit (admin only)
export const deleteUnit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingUnit = await prisma.unit.findUnique({ where: { id: id as string } });

    if (!existingUnit) {
      return error(res, 'Unit not found', 404);
    }

    await prisma.unit.delete({ where: { id: id as string } });

    return success(res, 'Unit deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete unit', 500);
  }
};
