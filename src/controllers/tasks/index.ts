import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { Response } from 'express';
import logger from '@/config/logger';
import { uploadToS3 } from '@/Utils/aws';

// Create a new task
export const createTask = async (req: AuthRequest, res: Response) => {
  try {

    
    // Extract fields from req.body (form-data sends fields as strings)
    const name = req.body.name;
    const description = req.body.description;
    const assignedToId = req.body.assignedToId;
    const dueDate = req.body.dueDate;
    const priority = req.body.priority;
    const taskProgress = req.body.taskProgress ? parseInt(req.body.taskProgress) : undefined;
    const status = req.body.status;
    const projectId = req.body.projectId;

    // Validate required fields
    if (!name || !description || !assignedToId || !dueDate || !projectId) {
      return error(res, 'Missing required fields: name, description, assignedToId, dueDate, projectId', 400);
    }

    // Verify that the project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }



    const taskData: any = {
      name,
      description,
      assignedToId,
      dueDate: new Date(dueDate),
      priority: priority || 'LOW',
      status: status || 'NOTSTARTED',
      createdById: req.userId as string,
      projectId,
    };

    // Only include taskProgress if explicitly provided
    if (taskProgress !== undefined) {
      taskData.taskProgress = taskProgress;
    }

    const task = await prisma.tasks.create({
      data: taskData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
    });

    return created(res, 'Task created successfully', task);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to create task', 400);
  }
};

// Get all tasks
export const getAllTasks = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await prisma.tasks.findMany({
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Tasks fetched successfully', tasks);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch tasks', 400);
  }
};

// Get task by ID
export const getTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.tasks.findUnique({
      where: { id: id as string },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
    });

    if (!task) {
      return error(res, 'Task not found', 404);
    }

    return success(res, 'Task fetched successfully', task);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch task', 400);
  }
};

// Update task
export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      assignedToId,
      dueDate,
      priority,
      taskProgress,
      status,
      attachments,
    } = req.body;

    // Check if task exists
    const existingTask = await prisma.tasks.findUnique({
      where: { id: id as string },
    });

    if (!existingTask) {
      return error(res, 'Task not found', 404);
    }

    // If assignedToId is being updated, verify the user exists
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      });

      if (!assignedUser) {
        return error(res, 'Assigned user not found', 404);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (priority !== undefined) updateData.priority = priority;
    if (taskProgress !== undefined) updateData.taskProgress = taskProgress;
    if (status !== undefined) updateData.status = status;
    if (attachments !== undefined) updateData.attachments = attachments;

    const task = await prisma.tasks.update({
      where: { id: id as string },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
    });

    return success(res, 'Task updated successfully', task);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to update task', 400);
  }
};

// Delete task
export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if task exists
    const existingTask = await prisma.tasks.findUnique({
      where: { id: id as string },
    });

    if (!existingTask) {
      return error(res, 'Task not found', 404);
    }

    await prisma.tasks.delete({
      where: { id: id as string },
    });

    return success(res, 'Task deleted successfully', null);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to delete task', 400);
  }
};

// Get tasks assigned to the current user
export const getMyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await prisma.tasks.findMany({
      where: {
        assignedToId: req.userId as string,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'My tasks fetched successfully', tasks);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch my tasks', 400);
  }
};

// Get tasks created by the current user
export const getTasksCreatedByMe = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await prisma.tasks.findMany({
      where: {
        createdById: req.userId as string,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        // createdBy: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   },
        // },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Tasks created by me fetched successfully', tasks);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch tasks created by me', 400);
  }
};

export const getTasksByProjectId = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const tasks = await prisma.tasks.findMany({
      where: { projectId: projectId as string },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return success(res, 'Tasks fetched successfully', tasks);
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch tasks by project id', 400);
  }
};