import {
  uploadFiles,
  getFilesByProject,
  getFileById,
  downloadFile,
  deleteFile,
  deleteMultipleFiles,
} from '@/controllers/files';
import { upload } from '@/Utils';
import { Router } from 'express';

const filesRouter: any = Router();

// Upload multiple files to a project
filesRouter.post('/upload', upload.array('files', 10), uploadFiles);

// Get all files for a project
filesRouter.get('/project/:projectId', getFilesByProject);

// Download file (returns signed URL)
filesRouter.get('/download/:id', downloadFile);

// Get single file by ID
filesRouter.get('/:id', getFileById);

// Delete a single file
filesRouter.delete('/:id', deleteFile);

// Delete multiple files
filesRouter.delete('/', deleteMultipleFiles);

export { filesRouter };

