import { AuthRequest } from '@/middleware/Auth';
import { error, prisma, success } from '@/Utils';
import { getSignedDownloadUrl } from '@/Utils/aws';
import { Response } from 'express';
import logger from '@/config/logger';
import AWS from 'aws-sdk';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;
const FOLDER_NAME = 'project_docs';

// Sanitize file name for S3 key
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_'); // Remove consecutive underscores
};

// Upload file to construction-docs bucket
const uploadToProjectDocs = async (file: Express.Multer.File): Promise<string> => {
  const sanitizedName = sanitizeFileName(file.originalname);
  const fileKey = `${FOLDER_NAME}/${uuidv4()}_${sanitizedName}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3.upload(params).promise();

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
};

// Delete file from S3
const deleteFromS3 = async (fileUrl: string): Promise<void> => {
  const baseUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  const key = fileUrl.replace(baseUrl, '');

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  await s3.deleteObject(params).promise();
};

// Get signed download URL for project docs bucket
const getProjectDocsDownloadUrl = (fileUrl: string, fileName: string, expiresIn = 3600): string => {
  const baseUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  const key = fileUrl.replace(baseUrl, '');

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  };

  return s3.getSignedUrl('getObject', params);
};

// Upload multiple files to a project
export const uploadFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return error(res, 'At least one file is required', 400);
    }

    if (!projectId) {
      return error(res, 'Project ID is required', 400);
    }

    // Verify project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const uploadedFiles = [];

    // Upload each file
    for (const file of files) {
      const fileUrl = await uploadToProjectDocs(file);

      const fileData: any = {
        projectId,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      };

      if (req.userId) {
        fileData.uploadedById = req.userId;
      }

      const savedFile = await prisma.projectFiles.create({
        data: fileData,
      });

      uploadedFiles.push(savedFile);
    }

    return success(res, `${uploadedFiles.length} file(s) uploaded successfully`, uploadedFiles);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to upload files', 500);
  }
};

// Get all files for a project
export const getFilesByProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return error(res, 'Project ID is required', 400);
    }

    // Verify project exists
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return error(res, 'Project not found', 404);
    }

    const files = await prisma.projectFiles.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, 'Files fetched successfully', files);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch files', 500);
  }
};

// Get single file by ID with download URL
export const getFileById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return error(res, 'File ID is required', 400);
    }

    const file = await prisma.projectFiles.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!file) {
      return error(res, 'File not found', 404);
    }

    const downloadUrl = getProjectDocsDownloadUrl(file.fileUrl, file.fileName);

    return success(res, 'File fetched successfully', {
      ...file,
      downloadUrl,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to fetch file', 500);
  }
};

// Download file (returns signed URL)
export const downloadFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return error(res, 'File ID is required', 400);
    }

    const file = await prisma.projectFiles.findUnique({
      where: { id },
    });

    if (!file) {
      return error(res, 'File not found', 404);
    }

    const downloadUrl = getProjectDocsDownloadUrl(file.fileUrl, file.fileName);

    return success(res, 'Download URL generated successfully', {
      downloadUrl,
      fileName: file.fileName,
    });
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to generate download URL', 500);
  }
};

// Delete a file
export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return error(res, 'File ID is required', 400);
    }

    const file = await prisma.projectFiles.findUnique({
      where: { id },
    });

    if (!file) {
      return error(res, 'File not found', 404);
    }

    // Delete from S3
    await deleteFromS3(file.fileUrl);

    // Delete from database
    await prisma.projectFiles.delete({
      where: { id },
    });

    return success(res, 'File deleted successfully');
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete file', 500);
  }
};

// Delete multiple files
export const deleteMultipleFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return error(res, 'File IDs array is required', 400);
    }

    const files = await prisma.projectFiles.findMany({
      where: { id: { in: fileIds } },
    });

    if (files.length === 0) {
      return error(res, 'No files found', 404);
    }

    // Delete from S3
    for (const file of files) {
      await deleteFromS3(file.fileUrl);
    }

    // Delete from database
    await prisma.projectFiles.deleteMany({
      where: { id: { in: fileIds } },
    });

    return success(res, `${files.length} file(s) deleted successfully`);
  } catch (err) {
    logger.error(err);
    return error(res, 'Failed to delete files', 500);
  }
};

