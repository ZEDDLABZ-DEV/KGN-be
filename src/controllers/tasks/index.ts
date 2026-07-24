import { AuthRequest } from '@/middleware/Auth';
import { created, error, prisma, success } from '@/Utils';
import { uploadToS3, getSignedViewUrl } from '@/Utils/aws';
import { Preiority, TaskStatus } from '@prisma/client';
import { Response } from 'express';
import logger from '@/config/logger';

/** Normalize assignedToIds from JSON body or form-data (string / JSON array). Accepts legacy assignedToId as a single id. */
function parseAssignedToIds(body: Record<string, unknown>): string[] | null {
  const raw = body.assignedToIds ?? body.assignedToId;
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(String).filter(Boolean))];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map(String).filter(Boolean))];
      }
    } catch {
      /* single id string */
    }
    return [trimmed];
  }
  return [String(raw)];
}

async function assertLabourIdsExist(ids: string[], res: Response): Promise<boolean> {
  if (ids.length === 0) return true;
  const count = await prisma.labours.count({ where: { id: { in: ids } } });
  if (count !== ids.length) {
    error(res, 'One or more assignee ids are invalid', 404);
    return false;
  }
  return true;
}

// Create a new task
export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const name = req.body.name;
    const description = req.body.description;
    const dueDate = req.body.dueDate;
    const priority = req.body.priority;
    const taskProgress = req.body.taskProgress ? parseInt(req.body.taskProgress) : undefined;
    const status = req.body.status;
    const projectId = req.body.projectId;

    const assignedToIds = parseAssignedToIds(req.body);

    if (!name || !description || !dueDate || !projectId) {
      return error(res, 'Missing required fields: name, description, dueDate, projectId', 400);
    }
    if (!assignedToIds || assignedToIds.length === 0) {
      return error(res, 'assignedToIds must include at least one valid labour id', 400);
    }

    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    if (!(await assertLabourIdsExist(assignedToIds, res))) return;

    const taskData = {
      name,
      description,
      dueDate: new Date(dueDate),
      priority: (priority as Preiority) || Preiority.LOW,
      status: (status as TaskStatus) || TaskStatus.NOTSTARTED,
      createdById: req.userId as string,
      projectId,
      assignedTo: { connect: assignedToIds.map((id) => ({ id })) },
      ...(taskProgress !== undefined ? { taskProgress } : {}),
    };

    const task = await prisma.tasks.create({
      data: taskData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
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
    const { name, description, dueDate, priority, taskProgress, status, attachments, updates } = req.body;

    const existingTask = await prisma.tasks.findUnique({
      where: { id: id as string },
    });

    if (!existingTask) {
      return error(res, 'Task not found', 404);
    }

    const assignedToIds = parseAssignedToIds(req.body);

    if (assignedToIds !== null) {
      if (!(await assertLabourIdsExist(assignedToIds, res))) return;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (priority !== undefined) updateData.priority = priority;
    if (taskProgress !== undefined) updateData.taskProgress = taskProgress;
    if (status !== undefined) updateData.status = status;
    if (attachments !== undefined) updateData.attachments = attachments;
    if (updates !== undefined) {
      if (typeof updates !== 'string' || !updates.trim()) {
        return error(res, 'updates must be a non-empty string', 400);
      }
      updateData.updates = { push: updates.trim() };
    }
    if (assignedToIds !== null) {
      updateData.assignedTo = { set: assignedToIds.map((lid) => ({ id: lid })) };
    }

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

// Get tasks assigned to the current user (match if user id equals any assigned labour id)
export const getMyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.userId as string;
    const tasks = await prisma.tasks.findMany({
      where: {
        assignedTo: {
          some: { id: uid },
        },
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

/** Replace stored S3 image URLs with short-lived signed URLs for client display. */
const withSignedImages = <T extends { images: string[] }>(update: T): T => ({
  ...update,
  images: update.images.map((url) => getSignedViewUrl(url)),
});

// Add a daily progress report for a task
export const addTaskUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reportDate, progressUpdate } = req.body;

    if (!reportDate || !progressUpdate || typeof progressUpdate !== 'string' || !progressUpdate.trim()) {
      return error(res, 'Missing required fields: reportDate and progressUpdate', 400);
    }

    const parsedDate = new Date(reportDate);
    if (isNaN(parsedDate.getTime())) {
      return error(res, 'reportDate must be a valid date', 400);
    }

    const existingTask = await prisma.tasks.findUnique({
      where: { id: id as string },
    });

    if (!existingTask) {
      return error(res, 'Task not found', 404);
    }

    // Optional image uploads (multipart field: "images")
    const files = (req.files as Express.Multer.File[]) || [];
    const nonImage = files.find((f) => !f.mimetype.startsWith('image/'));
    if (nonImage) {
      return error(res, `Only image files are allowed, got: ${nonImage.originalname}`, 400);
    }

    const imageUrls = await Promise.all(files.map((file) => uploadToS3(file, 'task-updates')));

    const update = await prisma.taskUpdate.create({
      data: {
        taskId: id as string,
        reportDate: parsedDate,
        progressUpdate: progressUpdate.trim(),
        images: imageUrls,
        createdById: req.userId ?? null,
      },
    });

    return created(res, 'Daily report added successfully', withSignedImages(update));
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to add daily report', 400);
  }
};

// Get all daily progress reports for a task
export const getTaskUpdates = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingTask = await prisma.tasks.findUnique({
      where: { id: id as string },
    });

    if (!existingTask) {
      return error(res, 'Task not found', 404);
    }

    const updates = await prisma.taskUpdate.findMany({
      where: { taskId: id as string },
      orderBy: { reportDate: 'desc' },
    });

    return success(res, 'Task daily reports fetched successfully', updates.map(withSignedImages));
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch task daily reports', 400);
  }
};

// Get all daily progress reports for every task in a project
export const getProjectTaskUpdates = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const updates = await prisma.taskUpdate.findMany({
      where: { task: { projectId: projectId as string } },
      orderBy: { reportDate: 'desc' },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            status: true,
            taskProgress: true,
          },
        },
      },
    });

    return success(res, 'Project daily reports fetched successfully', updates.map(withSignedImages));
  } catch (err: any) {
    logger.error(err);
    return error(res, 'Failed to fetch project daily reports', 400);
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
