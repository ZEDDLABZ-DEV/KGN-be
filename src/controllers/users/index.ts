import { Request, Response } from 'express';
import { prisma, success, created, error } from '@/Utils';
import { AuthRequest } from '@/middleware/Auth';
import logger from '@/config/logger';

export const getUsers = async (
  _req: AuthRequest,
  res: Response
): Promise<any> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        Auth: {
          select: {
            id: true,
            loginWith: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
    return success(res, 'Users fetched successfully', users);
  } catch (err) {
    return error(res, 'Failed to fetch users');
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {

    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: id as string }
    });
    if (!user) return error(res, 'User not found', 404);
    return success(res, 'User fetched', user);
  } catch (err) {
    console.log(err);
    return error(res, 'Error fetching user');
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {

    const { id } = req.params;
    
    const user = await prisma.user.update({
      where: { id: id as string },
      data: req.body,
    });
    return created(res, 'User updated successfully', user);
  } catch (err) {
    logger.error(err)
    return error(res, 'Failed to update user');
  }
};

export const addLabour = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, skills, experience } = req.body;
    const labour = await prisma.labours.create({
      data: { name, phone, email, skills, experience, addedbyId: req.userId as any },
    });
    return created(res, 'Labour added successfully', labour);
  } catch (err) {
    logger.error(err)
    return error(res, 'Failed to add labour');
  }
};

export const getLabours = async (req: AuthRequest, res: Response) => {
  try {
    const labours = await prisma.labours.findMany({
      include: {
        addedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
    return success(res, 'Labours fetched successfully', labours);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch labours');
  }
};

export const getUserByRole = async (req: AuthRequest, res: Response) => {
  try {
    const { roleId } = req.params;
    const users = await prisma.user.findMany({
      where: { roleId: roleId as string },
    });
    return success(res, 'Users fetched successfully', users);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch users');
  }
};

export const getAllManagers = async (req: AuthRequest, res: Response) => {
  try {
    const managers = await prisma.user.findMany({
      where: { role: { name: 'manager' } },
    });
    return success(res, 'Managers fetched successfully', managers);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch managers');
  }
};

export const updateLabour = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const labour = await prisma.labours.update({
      where: { id: id as string },
      data: {...req.body, addedbyId: req.userId as any },
    });
    return success(res, 'Labour updated successfully', labour);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to update labour');
  }
};



export const deleteLabour = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if labour is in any team
    const labourInTeam = await prisma.teamPeoples.findFirst({
      where: { labourId: id as string },
    });
    
    if (labourInTeam) {
      return error(res, 'Cannot delete labour. Labour is assigned to a team', 400);
    }
    
    const labour = await prisma.labours.delete({
      where: { id: id as string },
    });
    return success(res, 'Labour deleted successfully', labour);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete labour');
  }
};