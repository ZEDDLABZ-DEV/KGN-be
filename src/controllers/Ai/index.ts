import { AuthRequest } from '@/middleware/Auth';
import { error, prisma, success } from '@/Utils';
import { uploadToS3 } from '@/Utils/aws';
import {
  convertExcelToJson,
  generateTasksFromBoq,
  groupBoqRows,
} from '@/Utils/openAI';
import { BOQStatus } from '@prisma/client';
import { Response } from 'express';

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

   

    const boq = await prisma.bOQ.create({
      data: {
        projectId,
        fileName: file.originalname,
        fileUrl,
        uploadedById: req.userId as any,
        status: BOQStatus.PROCESSING,
      },
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