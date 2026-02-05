import { AuthRequest } from '@/middleware/Auth';
import { error, prisma, success } from '@/Utils';
import { getSignedDownloadUrl, uploadToS3 } from '@/Utils/aws';
import {
  convertExcelToJson,
  generateTasksFromBoq,
  groupBoqRows,
} from '@/Utils/openAI';
import { BOQStatus } from '@prisma/client';
import { Response } from 'express';
import logger from '@/config/logger';

export const uploadBoq = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const file = req.file as Express.Multer.File;
    
    if (!file || !projectId) {
      return error(res, 'File and projectId are required', 400);
    }

    // Verify project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    // Step 1: Upload file to S3
    const fileUrl = await uploadToS3(file, 'boq');

    // Step 2: Save BOQ record

   

    const boqData: any = {
      projectId,
      fileName: file.originalname,
      fileUrl,
      status: BOQStatus.PROCESSING,
    };

    // Only add uploadedById if userId exists
    if (req.userId) {
      boqData.uploadedById = req.userId;
    }

    const boq = await prisma.bOQ.create({
      data: boqData,
    });

    // Step 3: Process BOQ and create tasks
    const buffer = file.buffer;
    const boqJson = convertExcelToJson(buffer);
    const groupedBoq = groupBoqRows(boqJson);
    const tasks = await generateTasksFromBoq(groupedBoq);
    
    const createdTasks = [];
    const tasksList = tasks.result || tasks || [];

    for (const taskItem of tasksList) {
      const taskData: any = {
        name: taskItem.task,
        description: taskItem.description || taskItem.task,
        projectId: projectId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        priority: 'MEDIUM',
        status: 'NOTSTARTED',
      };

      // Only add createdById if userId exists
      if (req.userId) {
        taskData.createdById = req.userId;
      }

      const task = await prisma.tasks.create({
        data: taskData,
      });

      // Create subtasks with new structure
      const subTasks = await Promise.all(
        (taskItem.subTasks || []).map((subTask: any) =>
          prisma.subTasks.create({
            data: {
              taskId: task.id,
              name: subTask.taskTitle || subTask,
              description: subTask.description || subTask.taskTitle || subTask,
              status: 'NOTSTARTED',
              progress: 0,
            },
          })
        )
      );

      createdTasks.push({
        ...task,
        subTasks,
      });
    }

    // Update BOQ status
    await prisma.bOQ.update({
      where: { id: boq.id },
      data: {
        status: BOQStatus.PROCESSED,
        tasksGenerated: createdTasks.length,
      },
    });

    return success(res, 'BOQ uploaded and tasks created successfully');
  } catch (err) {
    console.log('Error uploading BOQ:', err);
    return error(res, 'Failed to upload BOQ', 500);
  }
};

// Download BOQ file
export const downloadBoq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return error(res, 'BOQ ID is required', 400);
    }

    // Find BOQ record
    const boq = await prisma.bOQ.findUnique({
      where: { id: id as string },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!boq) {
      return error(res, 'BOQ not found', 404);
    }

    // Generate signed URL for download
    const downloadUrl = getSignedDownloadUrl(boq.fileUrl, boq.fileName);

    return success(res, 'Download URL generated successfully', {
      downloadUrl,
      fileName: boq.fileName,
      project: boq.project,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to generate download URL', 500);
  }
};

// Get all BOQs for a project
export const getBoqsByProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return error(res, 'Project ID is required', 400);
    }

    const boqs = await prisma.bOQ.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return success(res, 'BOQs fetched successfully', boqs);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch BOQs', 500);
  }
};

// Get single BOQ by ID
export const getBoqById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return error(res, 'BOQ ID is required', 400);
    }

    const boq = await prisma.bOQ.findUnique({
      where: { id: id as string },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!boq) {
      return error(res, 'BOQ not found', 404);
    }

    return success(res, 'BOQ fetched successfully', boq);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch BOQ', 500);
  }
};

// Get BOQ file from project (returns latest BOQ with download URL)
export const getBoqFileByProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return error(res, 'Project ID is required', 400);
    }

    // Verify project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId as string },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    // Get the latest BOQ for this project
    const boq = await prisma.bOQ.findFirst({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
    });

    if (!boq) {
      return error(res, 'No BOQ file found for this project', 404);
    }

    // Generate signed URL for download
    const downloadUrl = getSignedDownloadUrl(boq.fileUrl, boq.fileName);

    return success(res, 'BOQ file retrieved successfully', {
      id: boq.id,
      fileName: boq.fileName,
      status: boq.status,
      tasksGenerated: boq.tasksGenerated,
      createdAt: boq.createdAt,
      downloadUrl,
      project: {
        id: project.id,
        name: project.name,
      },
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to get BOQ file', 500);
  }
};